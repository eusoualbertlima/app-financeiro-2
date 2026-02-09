import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    onSnapshot,
    getDoc,
    increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/hooks/useFirestore';
import { useState, useEffect } from 'react';
import type { Transaction } from '@/types';

// Remove campos undefined de um objeto (Firebase não aceita undefined)
function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined)
    ) as Partial<T>;
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
            let items = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            })) as Transaction[];

            // Filtrar por mês/ano se especificado
            if (month !== undefined && year !== undefined) {
                items = items.filter(t => {
                    const date = new Date(t.date);
                    return date.getMonth() + 1 === month && date.getFullYear() === year;
                });
            }

            // Ordenar por data (mais recente primeiro)
            items.sort((a, b) => b.date - a.date);

            setTransactions(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [workspace?.id, month, year]);

    // Atualizar saldo da conta
    const updateAccountBalance = async (accountId: string, amount: number, isExpense: boolean) => {
        if (!workspace?.id || !accountId) return;

        const change = isExpense ? -amount : amount;
        await updateDoc(
            doc(db, `workspaces/${workspace.id}/accounts`, accountId),
            { balance: increment(change) }
        );
    };

    const add = async (item: Omit<Transaction, 'id'>) => {
        if (!workspace?.id || !user) return;

        // Limpa campos undefined
        const cleanData = cleanUndefined({
            description: item.description,
            amount: item.amount,
            type: item.type,
            date: item.date,
            status: item.status,
            categoryId: item.categoryId || 'outros',
            userId: user.uid,
            paidAt: item.paidAt || null,
        });

        // Adiciona accountId ou cardId apenas se existirem
        if (item.accountId) {
            (cleanData as any).accountId = item.accountId;
        }
        if (item.cardId) {
            (cleanData as any).cardId = item.cardId;
        }

        await addDoc(collection(db, `workspaces/${workspace.id}/transactions`), cleanData);

        // Se já está pago e tem conta vinculada, atualiza saldo
        if (item.status === 'paid' && item.accountId) {
            await updateAccountBalance(item.accountId, item.amount, item.type === 'expense');
        }
    };

    const update = async (id: string, item: Partial<Transaction>) => {
        if (!workspace?.id) return;
        const cleanData = cleanUndefined(item);
        await updateDoc(doc(db, `workspaces/${workspace.id}/transactions`, id), cleanData);
    };

    const remove = async (id: string) => {
        if (!workspace?.id) return;

        // Buscar transação para reverter saldo se necessário
        const transactionDoc = await getDoc(doc(db, `workspaces/${workspace.id}/transactions`, id));
        if (transactionDoc.exists()) {
            const data = transactionDoc.data() as Transaction;
            if (data.status === 'paid' && data.accountId) {
                // Reverter: se era despesa, devolve; se era receita, remove
                await updateAccountBalance(data.accountId, data.amount, data.type === 'income');
            }
        }

        await deleteDoc(doc(db, `workspaces/${workspace.id}/transactions`, id));
    };

    const markAsPaid = async (id: string, accountId?: string) => {
        if (!workspace?.id) return;

        // Buscar transação para saber o valor e tipo
        const transactionDoc = await getDoc(doc(db, `workspaces/${workspace.id}/transactions`, id));
        if (!transactionDoc.exists()) return;

        const data = transactionDoc.data() as Transaction;

        // Atualizar transação
        const updateData: any = {
            status: 'paid',
            paidAt: Date.now(),
        };
        if (accountId) {
            updateData.paidAccountId = accountId;
        }

        await updateDoc(doc(db, `workspaces/${workspace.id}/transactions`, id), updateData);

        // Atualizar saldo da conta
        if (accountId) {
            await updateAccountBalance(accountId, data.amount, data.type === 'expense');
        }
    };

    // Calcular totais
    const totals = {
        income: transactions.filter(t => t.type === 'income' && t.status === 'paid')
            .reduce((acc, t) => acc + t.amount, 0),
        expense: transactions.filter(t => t.type === 'expense' && t.status === 'paid')
            .reduce((acc, t) => acc + t.amount, 0),
        pending: transactions.filter(t => t.status === 'pending')
            .reduce((acc, t) => acc + t.amount, 0),
    };

    return { transactions, loading, add, update, remove, markAsPaid, totals };
}

// Transações de um cartão específico (para fatura)
export function useCardTransactions(cardId: string, month?: number, year?: number) {
    const { workspace } = useWorkspace();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workspace?.id || !cardId) return;

        const q = query(
            collection(db, `workspaces/${workspace.id}/transactions`),
            where('cardId', '==', cardId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let items = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            })) as Transaction[];

            // Filtrar por mês/ano se especificado
            if (month !== undefined && year !== undefined) {
                items = items.filter(t => {
                    const date = new Date(t.date);
                    return date.getMonth() + 1 === month && date.getFullYear() === year;
                });
            }

            items.sort((a, b) => b.date - a.date);
            setTransactions(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [workspace?.id, cardId, month, year]);

    const total = transactions.reduce((acc, t) => acc + t.amount, 0);

    return { transactions, loading, total };
}
