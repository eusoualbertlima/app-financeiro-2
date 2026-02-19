import {
    collection,
    doc,
    addDoc,
    arrayUnion,
    updateDoc,
    query,
    where,
    onSnapshot,
    getDocs,
    increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useWorkspace } from '@/hooks/useFirestore';
import { useState, useEffect } from 'react';
import type { CardStatement } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { recordWorkspaceAuditEvent } from '@/lib/audit';
import { resolveStatementDates } from '@/lib/cardStatementCycle';

export function useCardStatements(cardId: string, month?: number, year?: number) {
    const { workspace } = useWorkspace();
    const { user } = useAuth();
    const [statement, setStatement] = useState<CardStatement | null>(null);
    const [loading, setLoading] = useState(true);
    const hasSelection = Boolean(workspace?.id && cardId && month !== undefined && year !== undefined);

    useEffect(() => {
        if (!workspace?.id || !cardId || month === undefined || year === undefined) {
            return;
        }

        setLoading(true);

        const q = query(
            collection(db, `workspaces/${workspace.id}/card_statements`),
            where('cardId', '==', cardId),
            where('month', '==', month),
            where('year', '==', year)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const docData = snapshot.docs[0].data();
                setStatement({ id: snapshot.docs[0].id, ...docData } as CardStatement);
            } else {
                setStatement(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [workspace?.id, cardId, month, year]);

    const statementForSelection = hasSelection
        && statement
        && statement.cardId === cardId
        && statement.month === month
        && statement.year === year
        ? statement
        : null;

    // Gerar fatura automaticamente baseada em transações
    const generateStatement = async (
        cardName: string,
        closingDay: number,
        dueDay: number,
        totalFromTransactions: number
    ) => {
        if (!workspace?.id || !cardId || month === undefined || year === undefined) return;

        // Verificar se já existe
        const q = query(
            collection(db, `workspaces/${workspace.id}/card_statements`),
            where('cardId', '==', cardId),
            where('month', '==', month),
            where('year', '==', year)
        );
        const existing = await getDocs(q);
        if (!existing.empty) return;

        const { closingDate, dueDate } = resolveStatementDates(month, year, closingDay, dueDay);

        await addDoc(collection(db, `workspaces/${workspace.id}/card_statements`), {
            cardId,
            cardName,
            month,
            year,
            closingDate,
            dueDate,
            totalAmount: totalFromTransactions,
            amountMode: 'auto',
            status: 'open',
        });

        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'create',
            entity: 'card_statements',
            summary: 'Fatura gerada automaticamente.',
            payload: {
                cardId,
                cardName,
                month,
                year,
                totalAmount: totalFromTransactions,
            },
        });
    };

    // Atualizar valor da fatura
    type UpdateAmountOptions = {
        source?: 'auto' | 'manual';
        baseAutoTotal?: number;
        note?: string;
        createIfMissing?: {
            cardName: string;
            closingDay: number;
            dueDay: number;
        };
    };

    const updateAmount = async (
        newAmount: number,
        options?: UpdateAmountOptions
    ) => {
        if (!workspace?.id || !cardId || month === undefined || year === undefined) return;
        const source = options?.source || 'manual';
        const normalizedNewAmount = Number.isFinite(newAmount) ? Math.max(0, newAmount) : 0;

        let targetStatementId = statementForSelection?.id;
        let previousAmount = statementForSelection?.totalAmount ?? 0;
        let snapshotData = statementForSelection as CardStatement | null;

        if (!targetStatementId) {
            const existingQuery = query(
                collection(db, `workspaces/${workspace.id}/card_statements`),
                where('cardId', '==', cardId),
                where('month', '==', month),
                where('year', '==', year)
            );
            const existing = await getDocs(existingQuery);

            if (!existing.empty) {
                const docSnap = existing.docs[0];
                targetStatementId = docSnap.id;
                snapshotData = { id: docSnap.id, ...docSnap.data() } as CardStatement;
                previousAmount = Number(snapshotData.totalAmount || 0);
            } else {
                const seed = options?.createIfMissing;
                if (!seed) return;

                const baseAutoAmount = Number(options?.baseAutoTotal ?? 0);
                const manualDelta = source === 'manual'
                    ? normalizedNewAmount - baseAutoAmount
                    : 0;
                const now = Date.now();
                const adjustmentEntry = source === 'manual'
                    ? {
                        at: now,
                        actorUid: user?.uid || null,
                        source: 'manual' as const,
                        previousAmount: 0,
                        newAmount: normalizedNewAmount,
                        baseAutoAmount,
                        delta: manualDelta,
                        note: options?.note || 'Ajuste manual de fatura',
                    }
                    : null;
                const { closingDate, dueDate } = resolveStatementDates(month, year, seed.closingDay, seed.dueDay);
                const docRef = await addDoc(collection(db, `workspaces/${workspace.id}/card_statements`), {
                    cardId,
                    cardName: seed.cardName,
                    month,
                    year,
                    closingDate,
                    dueDate,
                    totalAmount: normalizedNewAmount,
                    amountMode: source === 'manual' && Math.abs(manualDelta) > 0.009 ? 'manual' : 'auto',
                    manualDelta: manualDelta,
                    lastAdjustedAt: source === 'manual' ? now : null,
                    adjustments: adjustmentEntry ? [adjustmentEntry] : [],
                    status: 'open',
                });
                targetStatementId = docRef.id;

                await recordWorkspaceAuditEvent({
                    workspaceId: workspace.id,
                    actorUid: user?.uid,
                    action: source === 'manual' ? 'update' : 'create',
                    entity: 'card_statements',
                    entityId: docRef.id,
                    summary: source === 'manual'
                        ? 'Ajuste manual criou fatura inexistente no período.'
                        : 'Fatura criada manualmente.',
                    payload: {
                        cardId,
                        month,
                        year,
                        previousAmount: 0,
                        newAmount: normalizedNewAmount,
                        baseAutoAmount: source === 'manual' ? Number(options?.baseAutoTotal ?? 0) : null,
                        manualDelta: source === 'manual'
                            ? normalizedNewAmount - Number(options?.baseAutoTotal ?? 0)
                            : null,
                        source,
                        note: options?.note || null,
                    },
                });
                return;
            }
        }

        if (!targetStatementId) return;

        const previousManualDelta = Number((snapshotData as any)?.manualDelta || 0);
        let targetAmount = normalizedNewAmount;
        const payload: Record<string, unknown> = {};
        let computedManualDelta = previousManualDelta;

        if (source === 'manual') {
            const now = Date.now();
            const baseAutoAmount = Number(options?.baseAutoTotal ?? normalizedNewAmount);
            computedManualDelta = normalizedNewAmount - baseAutoAmount;
            payload.totalAmount = normalizedNewAmount;
            payload.manualDelta = computedManualDelta;
            payload.amountMode = Math.abs(computedManualDelta) > 0.009 ? 'manual' : 'auto';
            payload.lastAdjustedAt = now;
            payload.adjustments = arrayUnion({
                at: now,
                actorUid: user?.uid || null,
                source: 'manual',
                previousAmount,
                newAmount: normalizedNewAmount,
                baseAutoAmount,
                delta: computedManualDelta,
                note: options?.note || 'Ajuste manual de fatura',
            });
        } else {
            targetAmount = Math.max(0, normalizedNewAmount + previousManualDelta);
            payload.totalAmount = targetAmount;
            payload.manualDelta = previousManualDelta;
            payload.amountMode = Math.abs(previousManualDelta) > 0.009 ? 'manual' : 'auto';
        }

        await updateDoc(
            doc(db, `workspaces/${workspace.id}/card_statements`, targetStatementId),
            payload
        );

        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'update',
            entity: 'card_statements',
            entityId: targetStatementId,
            summary: source === 'manual'
                ? 'Fatura ajustada manualmente.'
                : 'Fatura sincronizada automaticamente pelas transações.',
            payload: {
                previousAmount,
                newAmount: targetAmount,
                source,
                baseAutoAmount: source === 'manual' ? Number(options?.baseAutoTotal ?? normalizedNewAmount) : null,
                manualDelta: source === 'manual' ? computedManualDelta : previousManualDelta,
                note: options?.note || null,
            },
        });
    };

    // Pagar fatura
    const payStatement = async (accountId: string) => {
        if (!workspace?.id || !statementForSelection?.id) return;

        // Atualizar fatura como paga
        await updateDoc(
            doc(db, `workspaces/${workspace.id}/card_statements`, statementForSelection.id),
            {
                status: 'paid',
                paidAt: Date.now(),
                paidAccountId: accountId,
            }
        );

        // Descontar da conta bancária
        if (accountId) {
            await updateDoc(
                doc(db, `workspaces/${workspace.id}/accounts`, accountId),
                { balance: increment(-statementForSelection.totalAmount) }
            );
        }

        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'mark_paid',
            entity: 'card_statements',
            entityId: statementForSelection.id,
            summary: 'Fatura marcada como paga.',
            payload: {
                accountId,
                amount: statementForSelection.totalAmount,
            },
        });
    };

    // Reabrir fatura
    const reopenStatement = async () => {
        if (!workspace?.id || !statementForSelection?.id) return;

        // Se estava paga, reverter saldo da conta
        if (statementForSelection.status === 'paid' && statementForSelection.paidAccountId) {
            await updateDoc(
                doc(db, `workspaces/${workspace.id}/accounts`, statementForSelection.paidAccountId),
                { balance: increment(statementForSelection.totalAmount) }
            );
        }

        await updateDoc(
            doc(db, `workspaces/${workspace.id}/card_statements`, statementForSelection.id),
            {
                status: 'open',
                paidAt: null,
                paidAccountId: null,
            }
        );

        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'update',
            entity: 'card_statements',
            entityId: statementForSelection.id,
            summary: 'Fatura reaberta.',
            payload: {
                previousStatus: statementForSelection.status,
                paidAccountId: statementForSelection.paidAccountId || null,
                amount: statementForSelection.totalAmount,
            },
        });
    };

    return {
        statement: statementForSelection,
        loading: hasSelection ? loading : false,
        generateStatement,
        updateAmount,
        payStatement,
        reopenStatement,
    };
}
