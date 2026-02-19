import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import { useWorkspace } from '@/hooks/useFirestore';
import type { CardStatement, CreditCard, Transaction } from '@/types';
import { normalizeLegacyDateOnlyTimestamp } from '@/lib/dateInput';
import { resolveCardStatementReference } from '@/lib/cardStatementCycle';
import {
    getTransactionInvoiceId,
    isTransactionExcludedFromTotals,
    resolveTransactionStatementReference,
    statementMonthYearKey,
} from '@/lib/cardInvoiceReference';

export interface CardLimitSummary {
    outstanding: number;
    available: number;
    usedPercent: number;
    currentCycleAmount: number;
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

function getStatementIdentifiers(statement: CardStatement | (CardStatement & Record<string, unknown>)) {
    const source = statement as CardStatement & Record<string, unknown>;
    const candidates: unknown[] = [
        source.id,
        source.invoiceId,
        source.invoice_id,
        source.statementId,
        source.statement_id,
        source.faturaId,
        source.fatura_id,
    ];

    const ids = new Set<string>();
    candidates.forEach((value) => {
        if (typeof value === 'string' && value.trim()) {
            ids.add(value.trim());
        }
    });

    return Array.from(ids);
}

function buildCardSummary(
    card: CreditCard,
    cardTransactions: Transaction[],
    cardStatements: CardStatement[]
): CardLimitSummary {
    const statementsById = new Map<string, CardStatement>();
    const statementsByExternalId = new Map<string, CardStatement>();
    cardStatements.forEach((statement) => {
        statementsById.set(statement.id, statement);
        getStatementIdentifiers(statement as any).forEach((key) => {
            statementsByExternalId.set(key, statement);
        });
    });

    const statementsByKey = new Map<string, CardStatement>();
    cardStatements.forEach((statement) => {
        const key = statementMonthYearKey(statement.month, statement.year);
        const preferred = pickPreferredStatement(statementsByKey.get(key), statement);
        statementsByKey.set(key, preferred);
    });

    const txTotalsByLinkedStatementId = new Map<string, number>();
    const txTotalsByStatementKey = new Map<string, number>();

    cardTransactions.forEach((transaction) => {
        if (isTransactionExcludedFromTotals(transaction as any)) return;

        const amount = toPositiveAmount(Number((transaction as any).amount));
        if (amount <= 0) return;

        const linkedStatementId = getTransactionInvoiceId(transaction as any);
        const linkedStatement = linkedStatementId ? statementsByExternalId.get(linkedStatementId) : null;
        if (linkedStatement) {
            txTotalsByLinkedStatementId.set(
                linkedStatement.id,
                (txTotalsByLinkedStatementId.get(linkedStatement.id) || 0) + amount
            );
            return;
        }

        const reference = resolveTransactionStatementReference(transaction as any, card.closingDay);
        if (!reference) return;

        const key = statementMonthYearKey(reference.month, reference.year);
        txTotalsByStatementKey.set(key, (txTotalsByStatementKey.get(key) || 0) + amount);
    });

    let outstanding = 0;
    const processedKeys = new Set<string>();
    const processedStatementIds = new Set<string>();

    txTotalsByLinkedStatementId.forEach((txAmount, statementId) => {
        const statement = statementsById.get(statementId);
        if (statement?.status === 'paid') return;

        const effectiveAmount = statement?.amountMode === 'manual'
            ? toPositiveAmount(statement.totalAmount)
            : txAmount;

        outstanding += effectiveAmount;
        processedStatementIds.add(statementId);
        if (statement) {
            processedKeys.add(statementMonthYearKey(statement.month, statement.year));
        }
    });

    txTotalsByStatementKey.forEach((txAmount, key) => {
        const statement = statementsByKey.get(key);
        if (statement?.status === 'paid') return;

        const effectiveAmount = statement?.amountMode === 'manual'
            ? toPositiveAmount(statement.totalAmount)
            : txAmount;

        outstanding += effectiveAmount;
        processedKeys.add(key);
        if (statement) {
            processedStatementIds.add(statement.id);
        }
    });

    // Mantém ajuste manual mesmo sem transações vinculadas no período.
    statementsByKey.forEach((statement, key) => {
        if (statement.status === 'paid') return;
        if (statement.amountMode !== 'manual') return;
        if (processedKeys.has(key) || processedStatementIds.has(statement.id)) return;
        outstanding += toPositiveAmount(statement.totalAmount);
    });

    const nowReference = resolveCardStatementReference(Date.now(), card.closingDay);
    const currentKey = statementMonthYearKey(nowReference.month, nowReference.year);
    let currentCycleAmount = toPositiveAmount(txTotalsByStatementKey.get(currentKey) || 0);

    txTotalsByLinkedStatementId.forEach((txAmount, statementId) => {
        const statement = statementsById.get(statementId);
        if (!statement) return;
        const statementKey = statementMonthYearKey(statement.month, statement.year);
        if (statementKey !== currentKey) return;
        currentCycleAmount += txAmount;
    });

    const currentStatement = statementsByKey.get(currentKey);
    if (currentStatement?.amountMode === 'manual' && currentStatement.status !== 'paid') {
        currentCycleAmount = toPositiveAmount(currentStatement.totalAmount);
    }

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
