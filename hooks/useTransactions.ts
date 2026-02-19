import {
    collection,
    doc,
    addDoc,
    runTransaction,
    updateDoc,
    deleteDoc,
    query,
    where,
    onSnapshot,
    getDoc,
    getDocs,
    increment,
    writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/hooks/useFirestore';
import { useState, useEffect } from 'react';
import type { Transaction } from '@/types';
import { recordWorkspaceAuditEvent } from '@/lib/audit';
import { normalizeLegacyDateOnlyTimestamp } from '@/lib/dateInput';
import { resolveCardStatementReference } from '@/lib/cardStatementCycle';
import {
    getTransactionInvoiceId,
    resolveTransactionStatementReference,
} from '@/lib/cardInvoiceReference';

// Remove campos undefined de um objeto (Firebase não aceita undefined)
function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined)
    ) as Partial<T>;
}

function resolveTransactionAccountId(transaction: Partial<Transaction>) {
    return transaction.paidAccountId || transaction.accountId;
}

export function useTransactions(month?: number, year?: number) {
    const { user } = useAuth();
    const { workspace } = useWorkspace();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workspace?.id) return;

        const q = collection(db, `workspaces/${workspace.id}/transactions`);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let items = snapshot.docs.map(docSnap => {
                const transaction = {
                    id: docSnap.id,
                    ...docSnap.data()
                } as Transaction;

                return {
                    ...transaction,
                    date: normalizeLegacyDateOnlyTimestamp(transaction.date),
                } as Transaction;
            });

            // Filtrar por mês/ano se especificado
            if (month !== undefined && year !== undefined) {
                const targetStart = new Date(year, month - 1, 1).getTime();
                const targetEnd = new Date(year, month, 0, 23, 59, 59, 999).getTime();

                items = items.filter(t => {
                    const date = new Date(t.date);
                    const isInMonth = date.getMonth() + 1 === month && date.getFullYear() === year;
                    // Também incluir transações pendentes de meses anteriores
                    const isPendingFromPast = t.status === 'pending' && t.date < targetStart;
                    return isInMonth || isPendingFromPast;
                });
            }

            // Ordenar por data (mais recente primeiro)
            items.sort((a, b) => b.date - a.date);

            setTransactions(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [workspace?.id, month, year]);

    const add = async (item: Omit<Transaction, 'id'>) => {
        if (!workspace?.id || !user) return;

        // Limpa campos undefined
        const cleanData = cleanUndefined({
            description: item.description,
            notes: item.notes?.trim() || undefined,
            amount: item.amount,
            type: item.type,
            date: item.date,
            status: item.status,
            categoryId: item.categoryId || 'outros',
            userId: user.uid,
            paidAt: item.paidAt || null,
            source: item.source || 'manual',
        });

        // Adiciona accountId ou cardId apenas se existirem
        if (item.accountId) {
            (cleanData as any).accountId = item.accountId;
        }
        if (item.cardId) {
            (cleanData as any).cardId = item.cardId;
        }

        if (item.status === 'paid' && item.accountId) {
            const transactionsCol = collection(db, `workspaces/${workspace.id}/transactions`);
            const txRef = doc(transactionsCol);
            const batch = writeBatch(db);

            batch.set(txRef, cleanData as any);
            batch.update(
                doc(db, `workspaces/${workspace.id}/accounts`, item.accountId),
                { balance: increment(item.type === 'expense' ? -item.amount : item.amount) }
            );

            await batch.commit();
            await recordWorkspaceAuditEvent({
                workspaceId: workspace.id,
                actorUid: user.uid,
                action: 'create',
                entity: 'transactions',
                entityId: txRef.id,
                summary: 'Lançamento criado e refletido no saldo da conta.',
                payload: {
                    transaction: cleanData as any,
                    accountId: item.accountId,
                },
            });
            return;
        }

        const docRef = await addDoc(collection(db, `workspaces/${workspace.id}/transactions`), cleanData);
        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user.uid,
            action: 'create',
            entity: 'transactions',
            entityId: docRef.id,
            summary: 'Lançamento criado.',
            payload: {
                transaction: cleanData as any,
            },
        });
    };

    const update = async (id: string, item: Partial<Transaction>) => {
        if (!workspace?.id) return;

        const txRef = doc(db, `workspaces/${workspace.id}/transactions`, id);
        const cleanData = cleanUndefined(item);

        await runTransaction(db, async (transaction) => {
            const transactionDoc = await transaction.get(txRef);
            if (!transactionDoc.exists()) return;

            const currentData = {
                id: transactionDoc.id,
                ...transactionDoc.data(),
            } as Transaction;
            const nextData = { ...currentData, ...cleanData } as Transaction;

            const currentAccountId = resolveTransactionAccountId(currentData);
            const nextAccountId = resolveTransactionAccountId(nextData);
            const affectsBalance =
                currentData.status !== nextData.status ||
                currentData.amount !== nextData.amount ||
                currentData.type !== nextData.type ||
                currentAccountId !== nextAccountId;

            transaction.update(txRef, cleanData);

            if (!affectsBalance) return;

            if (currentData.status === 'paid' && currentAccountId) {
                transaction.update(
                    doc(db, `workspaces/${workspace.id}/accounts`, currentAccountId),
                    { balance: increment(currentData.type === 'income' ? -currentData.amount : currentData.amount) }
                );
            }

            if (nextData.status === 'paid' && nextAccountId) {
                transaction.update(
                    doc(db, `workspaces/${workspace.id}/accounts`, nextAccountId),
                    { balance: increment(nextData.type === 'expense' ? -nextData.amount : nextData.amount) }
                );
            }
        });

        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'update',
            entity: 'transactions',
            entityId: id,
            summary: 'Lançamento atualizado.',
            payload: {
                changes: cleanData as any,
            },
        });
    };

    const remove = async (id: string) => {
        if (!workspace?.id) return;

        // Buscar transação para reverter saldo se necessário
        const transactionDoc = await getDoc(doc(db, `workspaces/${workspace.id}/transactions`, id));
        if (transactionDoc.exists()) {
            const data = transactionDoc.data() as Transaction;

            if (data.source === 'transfer' && data.transferId) {
                const transferQuery = query(
                    collection(db, `workspaces/${workspace.id}/transactions`),
                    where('transferId', '==', data.transferId)
                );
                const transferSnap = await getDocs(transferQuery);
                const batch = writeBatch(db);

                transferSnap.docs.forEach((docSnap) => {
                    const tx = docSnap.data() as Transaction;

                    if (tx.status === 'paid' && tx.accountId) {
                        const reverseChange = tx.type === 'expense' ? tx.amount : -tx.amount;
                        batch.update(
                            doc(db, `workspaces/${workspace.id}/accounts`, tx.accountId),
                            { balance: increment(reverseChange) }
                        );
                    }

                    batch.delete(doc(db, `workspaces/${workspace.id}/transactions`, docSnap.id));
                });

                await batch.commit();
                await recordWorkspaceAuditEvent({
                    workspaceId: workspace.id,
                    actorUid: user?.uid,
                    action: 'delete',
                    entity: 'transactions',
                    entityId: data.transferId,
                    summary: 'Transferência removida (par de lançamentos).',
                    payload: {
                        transferId: data.transferId,
                        removedTransactions: transferSnap.docs.length,
                    },
                });
                return;
            }

            await runTransaction(db, async (transaction) => {
                const txRef = doc(db, `workspaces/${workspace.id}/transactions`, id);
                const freshDoc = await transaction.get(txRef);
                if (!freshDoc.exists()) return;

                const freshData = {
                    id: freshDoc.id,
                    ...freshDoc.data(),
                } as Transaction;

                const accountId = resolveTransactionAccountId(freshData);
                if (freshData.status === 'paid' && accountId) {
                    transaction.update(
                        doc(db, `workspaces/${workspace.id}/accounts`, accountId),
                        { balance: increment(freshData.type === 'income' ? -freshData.amount : freshData.amount) }
                    );
                }

                transaction.delete(txRef);
            });
            await recordWorkspaceAuditEvent({
                workspaceId: workspace.id,
                actorUid: user?.uid,
                action: 'delete',
                entity: 'transactions',
                entityId: id,
                summary: 'Lançamento removido.',
                payload: {
                    previous: data as any,
                },
            });
            return;
        }

        await deleteDoc(doc(db, `workspaces/${workspace.id}/transactions`, id));
        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'delete',
            entity: 'transactions',
            entityId: id,
            summary: 'Lançamento removido sem snapshot prévio.',
        });
    };

    const markAsPaid = async (id: string, accountId?: string) => {
        if (!workspace?.id) return;

        const txRef = doc(db, `workspaces/${workspace.id}/transactions`, id);

        await runTransaction(db, async (transaction) => {
            const transactionDoc = await transaction.get(txRef);
            if (!transactionDoc.exists()) return;

            const data = transactionDoc.data() as Transaction;
            if (data.status === 'paid') {
                return;
            }

            const paidAt = Date.now();
            const updateData: any = {
                status: 'paid',
                paidAt,
            };
            const effectiveAccountId = accountId || data.accountId || data.paidAccountId;
            if (effectiveAccountId) {
                updateData.paidAccountId = effectiveAccountId;

                if (!data.accountId) {
                    updateData.accountId = effectiveAccountId;
                }

                transaction.update(
                    doc(db, `workspaces/${workspace.id}/accounts`, effectiveAccountId),
                    { balance: increment(data.type === 'expense' ? -data.amount : data.amount) }
                );
            }

            transaction.update(txRef, updateData);
        });

        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'mark_paid',
            entity: 'transactions',
            entityId: id,
            summary: 'Lançamento marcado como pago.',
            payload: {
                paidAccountId: accountId || null,
            },
        });
    };

    const transfer = async (params: {
        fromAccountId: string;
        toAccountId: string;
        amount: number;
        date: number;
        description?: string;
    }) => {
        if (!workspace?.id || !user) return;

        const { fromAccountId, toAccountId, amount, date, description } = params;
        if (!fromAccountId || !toAccountId || fromAccountId === toAccountId || amount <= 0) return;

        const transferId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const transactionsCol = collection(db, `workspaces/${workspace.id}/transactions`);
        const outgoingRef = doc(transactionsCol);
        const incomingRef = doc(transactionsCol);

        const batch = writeBatch(db);

        batch.update(doc(db, `workspaces/${workspace.id}/accounts`, fromAccountId), {
            balance: increment(-amount)
        });
        batch.update(doc(db, `workspaces/${workspace.id}/accounts`, toAccountId), {
            balance: increment(amount)
        });

        const cleanDescription = description?.trim() || 'Transferência entre contas';
        const commonData = {
            amount,
            date,
            status: 'paid' as const,
            categoryId: 'outros',
            userId: user.uid,
            paidAt: Date.now(),
            source: 'transfer' as const,
            transferId,
        };

        batch.set(outgoingRef, {
            ...commonData,
            description: cleanDescription,
            type: 'expense',
            accountId: fromAccountId,
            transferDirection: 'out',
            transferToAccountId: toAccountId,
            transferPairId: incomingRef.id,
        });

        batch.set(incomingRef, {
            ...commonData,
            description: cleanDescription,
            type: 'income',
            accountId: toAccountId,
            transferDirection: 'in',
            transferFromAccountId: fromAccountId,
            transferPairId: outgoingRef.id,
        });

        await batch.commit();
        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user.uid,
            action: 'transfer',
            entity: 'accounts',
            entityId: transferId,
            summary: 'Transferência entre contas registrada.',
            payload: {
                fromAccountId,
                toAccountId,
                amount,
                outgoingTransactionId: outgoingRef.id,
                incomingTransactionId: incomingRef.id,
            },
        });
    };

    // Calcular totais
    const totals = {
        income: transactions.filter(t => t.type === 'income' && t.status === 'paid' && t.source !== 'transfer')
            .reduce((acc, t) => acc + t.amount, 0),
        expense: transactions.filter(t => t.type === 'expense' && t.status === 'paid' && t.source !== 'transfer')
            .reduce((acc, t) => acc + t.amount, 0),
        pending: transactions.filter(t => t.status === 'pending' && t.source !== 'transfer')
            .reduce((acc, t) => acc + t.amount, 0),
    };

    return { transactions, loading, add, update, remove, markAsPaid, transfer, totals };
}

// Transações de um cartão específico (para fatura)
export function useCardTransactions(
    cardId: string,
    month?: number,
    year?: number,
    closingDay?: number,
    statementId?: string
) {
    const { workspace } = useWorkspace();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workspace?.id || !cardId) {
            setTransactions([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setTransactions([]);

        const q = query(
            collection(db, `workspaces/${workspace.id}/transactions`),
            where('cardId', '==', cardId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let items = snapshot.docs.map(docSnap => {
                const transaction = {
                    id: docSnap.id,
                    ...docSnap.data()
                } as Transaction;

                return {
                    ...transaction,
                    date: normalizeLegacyDateOnlyTimestamp(transaction.date),
                } as Transaction;
            });

            // Filtrar por mês/ano se especificado
            if (month !== undefined && year !== undefined) {
                items = items.filter(t => {
                    const txInvoiceId = getTransactionInvoiceId(t as any);
                    if (statementId && txInvoiceId) {
                        return txInvoiceId === statementId;
                    }

                    const statementRef = resolveTransactionStatementReference(t as any, closingDay);
                    if (statementRef) {
                        return statementRef.month === month && statementRef.year === year;
                    }

                    if (closingDay !== undefined) {
                        const fallbackRef = resolveCardStatementReference(t.date, closingDay);
                        return fallbackRef.month === month && fallbackRef.year === year;
                    }

                    const date = new Date(t.date);
                    return date.getMonth() + 1 === month && date.getFullYear() === year;
                });
            }

            items.sort((a, b) => b.date - a.date);
            setTransactions(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [workspace?.id, cardId, month, year, closingDay, statementId]);

    const total = transactions.reduce((acc, t) => acc + Number((t as any).amount || 0), 0);

    return { transactions, loading, total };
}
