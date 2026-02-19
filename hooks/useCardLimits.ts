import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import { useWorkspace } from '@/hooks/useFirestore';
import type { CardStatement, CreditCard, Transaction } from '@/types';
import { normalizeLegacyDateOnlyTimestamp } from '@/lib/dateInput';
import { resolveCardStatementReference } from '@/lib/cardStatementCycle';

export interface CardLimitSummary {
    outstanding: number;
    available: number;
    usedPercent: number;
    currentCycleAmount: number;
}

function statementKey(month: number, year: number) {
    return `${year}-${String(month).padStart(2, '0')}`;
}

function pickPreferredStatement(existing: CardStatement | undefined, candidate: CardStatement) {
    if (!existing) return candidate;

    const existingUnpaid = existing.status !== 'paid';
    const candidateUnpaid = candidate.status !== 'paid';
    if (existingUnpaid !== candidateUnpaid) {
        return candidateUnpaid ? candidate : existing;
    }

    const existingManual = existing.amountMode === 'manual';
    const candidateManual = candidate.amountMode === 'manual';
    if (existingManual !== candidateManual) {
        return candidateManual ? candidate : existing;
    }

    const existingRank = existing.paidAt || existing.dueDate || existing.closingDate || 0;
    const candidateRank = candidate.paidAt || candidate.dueDate || candidate.closingDate || 0;
    return candidateRank >= existingRank ? candidate : existing;
}

function toPositiveAmount(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, value);
}

function buildCardSummary(
    card: CreditCard,
    cardTransactions: Transaction[],
    cardStatements: CardStatement[]
): CardLimitSummary {
    const txTotalsByStatement = new Map<string, number>();

    cardTransactions.forEach((transaction) => {
        const reference = resolveCardStatementReference(transaction.date, card.closingDay);
        const key = statementKey(reference.month, reference.year);
        txTotalsByStatement.set(key, (txTotalsByStatement.get(key) || 0) + toPositiveAmount(transaction.amount));
    });

    const statementsByKey = new Map<string, CardStatement>();
    cardStatements.forEach((statement) => {
        const key = statementKey(statement.month, statement.year);
        const preferred = pickPreferredStatement(statementsByKey.get(key), statement);
        statementsByKey.set(key, preferred);
    });

    const keys = new Set<string>([
        ...txTotalsByStatement.keys(),
        ...statementsByKey.keys(),
    ]);

    let outstanding = 0;
    keys.forEach((key) => {
        const statement = statementsByKey.get(key);
        const txAmount = txTotalsByStatement.get(key) || 0;

        if (statement) {
            if (statement.status !== 'paid') {
                outstanding += toPositiveAmount(statement.totalAmount);
            }
            return;
        }

        outstanding += txAmount;
    });

    const nowReference = resolveCardStatementReference(Date.now(), card.closingDay);
    const currentKey = statementKey(nowReference.month, nowReference.year);
    const currentStatement = statementsByKey.get(currentKey);
    const currentCycleAmount = currentStatement
        ? toPositiveAmount(currentStatement.totalAmount)
        : toPositiveAmount(txTotalsByStatement.get(currentKey) || 0);

    const available = card.limit - outstanding;
    const usedPercent = card.limit > 0
        ? Math.min((toPositiveAmount(outstanding) / card.limit) * 100, 100)
        : 0;

    return {
        outstanding,
        available,
        usedPercent,
        currentCycleAmount,
    };
}

export function useCardsLimitSummary(cards: CreditCard[]) {
    const { workspace } = useWorkspace();
    const [cardTransactions, setCardTransactions] = useState<Transaction[]>([]);
    const [cardStatements, setCardStatements] = useState<CardStatement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workspace?.id) {
            setCardTransactions([]);
            setCardStatements([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        let hasTransactionsSnapshot = false;
        let hasStatementsSnapshot = false;

        const finishIfReady = () => {
            if (hasTransactionsSnapshot && hasStatementsSnapshot) {
                setLoading(false);
            }
        };

        const transactionsUnsubscribe = onSnapshot(
            collection(db, `workspaces/${workspace.id}/transactions`),
            (snapshot) => {
                const items = snapshot.docs
                    .map((docSnap) => {
                        const transaction = {
                            id: docSnap.id,
                            ...docSnap.data(),
                        } as Transaction;

                        return {
                            ...transaction,
                            date: normalizeLegacyDateOnlyTimestamp(transaction.date),
                        } as Transaction;
                    })
                    .filter((transaction) => Boolean(transaction.cardId));

                setCardTransactions(items);
                hasTransactionsSnapshot = true;
                finishIfReady();
            },
            () => {
                hasTransactionsSnapshot = true;
                finishIfReady();
            }
        );

        const statementsUnsubscribe = onSnapshot(
            collection(db, `workspaces/${workspace.id}/card_statements`),
            (snapshot) => {
                const items = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                })) as CardStatement[];

                setCardStatements(items);
                hasStatementsSnapshot = true;
                finishIfReady();
            },
            () => {
                hasStatementsSnapshot = true;
                finishIfReady();
            }
        );

        return () => {
            transactionsUnsubscribe();
            statementsUnsubscribe();
        };
    }, [workspace?.id]);

    const summaryByCard = useMemo(() => {
        const summaries: Record<string, CardLimitSummary> = {};

        cards.forEach((card) => {
            const transactionsForCard = cardTransactions.filter((transaction) => transaction.cardId === card.id);
            const statementsForCard = cardStatements.filter((statement) => statement.cardId === card.id);
            summaries[card.id] = buildCardSummary(card, transactionsForCard, statementsForCard);
        });

        return summaries;
    }, [cards, cardTransactions, cardStatements]);

    const totals = useMemo(() => {
        const totalLimit = cards.reduce((acc, card) => acc + card.limit, 0);
        const totalOutstanding = cards.reduce(
            (acc, card) => acc + (summaryByCard[card.id]?.outstanding || 0),
            0
        );
        const totalAvailable = totalLimit - totalOutstanding;

        return {
            totalLimit,
            totalOutstanding,
            totalAvailable,
        };
    }, [cards, summaryByCard]);

    return { summaryByCard, totals, loading };
}
