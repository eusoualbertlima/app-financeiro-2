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
    increment,
    getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useWorkspace } from '@/hooks/useFirestore';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import type { RecurringBill, BillPayment } from '@/types';

const paymentStatusPriority: Record<BillPayment['status'], number> = {
    pending: 1,
    overdue: 2,
    paid: 3,
};

function shouldReplacePayment(existing: BillPayment, candidate: BillPayment) {
    const existingPriority = paymentStatusPriority[existing.status];
    const candidatePriority = paymentStatusPriority[candidate.status];

    if (candidatePriority !== existingPriority) {
        return candidatePriority > existingPriority;
    }

    const existingHasTransaction = Boolean((existing as any).transactionId);
    const candidateHasTransaction = Boolean((candidate as any).transactionId);
    if (existingHasTransaction !== candidateHasTransaction) {
        return candidateHasTransaction;
    }

    const existingPaidAt = existing.paidAt || 0;
    const candidatePaidAt = candidate.paidAt || 0;
    if (candidatePaidAt !== existingPaidAt) {
        return candidatePaidAt > existingPaidAt;
    }

    return candidate.id > existing.id;
}

function canAutoDeleteDuplicate(payment: BillPayment) {
    const unsafePayment = payment as any;
    return payment.status !== 'paid'
        && !payment.paidAt
        && !payment.paidAmount
        && !payment.paidAccountId
        && !unsafePayment.transactionId;
}

// CRUD de Despesas Fixas
export function useRecurringBills() {
    const { workspace } = useWorkspace();
    const [bills, setBills] = useState<RecurringBill[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workspace?.id) return;

        const q = collection(db, `workspaces/${workspace.id}/recurring_bills`);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            })) as RecurringBill[];

            setBills(items.filter(b => b.isActive).sort((a, b) => a.dueDay - b.dueDay));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [workspace?.id]);

    const add = async (bill: Omit<RecurringBill, 'id' | 'createdAt' | 'isActive'>) => {
        if (!workspace?.id) return;
        await addDoc(collection(db, `workspaces/${workspace.id}/recurring_bills`), {
            ...bill,
            isActive: true,
            createdAt: Date.now()
        });
    };

    const update = async (id: string, bill: Partial<RecurringBill>) => {
        if (!workspace?.id) return;
        await updateDoc(doc(db, `workspaces/${workspace.id}/recurring_bills`, id), bill);
    };

    const remove = async (id: string) => {
        if (!workspace?.id) return;
        // Desativar a despesa fixa
        await updateDoc(doc(db, `workspaces/${workspace.id}/recurring_bills`, id), {
            isActive: false
        });
        // Excluir pagamentos pendentes/atrasados órfãos
        const paymentsQuery = query(
            collection(db, `workspaces/${workspace.id}/bill_payments`),
            where('billId', '==', id)
        );
        const snap = await getDocs(paymentsQuery);
        const deletePromises = snap.docs
            .map(d => deleteDoc(doc(db, `workspaces/${workspace.id}/bill_payments`, d.id)));
        await Promise.all(deletePromises);
    };

    return { bills, loading, add, update, remove };
}

// Pagamentos de despesas fixas por mês
export function useBillPayments(month: number, year: number) {
    const { workspace } = useWorkspace();
    const { bills } = useRecurringBills();
    const { user } = useAuth();
    const [payments, setPayments] = useState<BillPayment[]>([]);
    const [loading, setLoading] = useState(true);
    const cleaningIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!workspace?.id) return;

        const q = query(
            collection(db, `workspaces/${workspace.id}/bill_payments`),
            where('month', '==', month),
            where('year', '==', year)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            })) as BillPayment[];

            // Filtrar pagamentos de despesas que já foram excluídas e deduplicar por billId
            const activeBillIds = new Set(bills.map(b => b.id));
            const dedupedByBillId = new Map<string, BillPayment>();
            const duplicateIdsToDelete: string[] = [];

            for (const payment of items) {
                if (!activeBillIds.has(payment.billId)) continue;

                const existing = dedupedByBillId.get(payment.billId);
                if (!existing) {
                    dedupedByBillId.set(payment.billId, payment);
                    continue;
                }

                if (shouldReplacePayment(existing, payment)) {
                    if (canAutoDeleteDuplicate(existing)) {
                        duplicateIdsToDelete.push(existing.id);
                    }
                    dedupedByBillId.set(payment.billId, payment);
                } else if (canAutoDeleteDuplicate(payment)) {
                    duplicateIdsToDelete.push(payment.id);
                }
            }

            setPayments(Array.from(dedupedByBillId.values()).sort((a, b) => a.dueDay - b.dueDay));

            if (duplicateIdsToDelete.length > 0) {
                const uniqueIds = Array.from(new Set(duplicateIdsToDelete))
                    .filter(id => {
                        if (cleaningIdsRef.current.has(id)) return false;
                        cleaningIdsRef.current.add(id);
                        return true;
                    });

                if (uniqueIds.length > 0) {
                    Promise.all(
                        uniqueIds.map(async (id) => {
                            try {
                                await deleteDoc(doc(db, `workspaces/${workspace.id}/bill_payments`, id));
                            } finally {
                                cleaningIdsRef.current.delete(id);
                            }
                        })
                    ).catch(() => {
                        uniqueIds.forEach(id => cleaningIdsRef.current.delete(id));
                    });
                }
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, [workspace?.id, month, year, bills]);

    // Gerar pagamentos para o mês (cria se não existir)
    const generatePayments = async () => {
        if (!workspace?.id || !bills.length) return;

        const existingPaymentsQuery = query(
            collection(db, `workspaces/${workspace.id}/bill_payments`),
            where('month', '==', month),
            where('year', '==', year)
        );
        const existingSnapshot = await getDocs(existingPaymentsQuery);
        const existingBillIds = new Set(
            existingSnapshot.docs
                .map(docSnap => (docSnap.data() as Partial<BillPayment>).billId)
                .filter((billId): billId is string => Boolean(billId))
        );

        for (const bill of bills) {
            if (existingBillIds.has(bill.id)) continue;

            const now = new Date();
            const dueDate = new Date(year, month - 1, bill.dueDay);
            const isOverdue = dueDate < now;
            const paymentDocId = `${year}-${String(month).padStart(2, '0')}-${bill.id}`;
            const paymentRef = doc(db, `workspaces/${workspace.id}/bill_payments`, paymentDocId);

            await runTransaction(db, async (transaction) => {
                const existingPayment = await transaction.get(paymentRef);
                if (existingPayment.exists()) return;

                transaction.set(paymentRef, {
                    billId: bill.id,
                    billName: bill.name,
                    amount: bill.amount,
                    month,
                    year,
                    dueDay: bill.dueDay,
                    status: isOverdue ? 'overdue' : 'pending'
                });
            });

            existingBillIds.add(bill.id);
        }
    };

    // Atualizar saldo da conta
    const updateAccountBalance = async (accountId: string, amount: number) => {
        if (!workspace?.id || !accountId) return;

        await updateDoc(
            doc(db, `workspaces/${workspace.id}/accounts`, accountId),
            { balance: increment(-amount) } // Despesa fixa sempre desconta
        );
    };

    const markAsPaid = async (paymentId: string, paidAmount?: number, accountId?: string) => {
        if (!workspace?.id) return;

        const payment = payments.find(p => p.id === paymentId);
        const amount = paidAmount || payment?.amount || 0;

        const updateData: any = {
            status: 'paid',
            paidAt: Date.now(),
            paidAmount: amount,
        };

        if (accountId) {
            updateData.paidAccountId = accountId;
            // Atualizar saldo da conta
            await updateAccountBalance(accountId, amount);
        }

        // Criar lançamento correspondente para aparecer em Lançamentos
        const transactionData: any = {
            description: payment?.billName || 'Conta Fixa',
            amount,
            type: 'expense',
            status: 'paid',
            date: Date.now(),
            paidAt: Date.now(),
            userId: user?.uid || '',
            source: 'bill_payment',
            billPaymentId: paymentId,
        };
        if (accountId) transactionData.accountId = accountId;
        if (payment?.billId) {
            const bill = bills.find(b => b.id === payment.billId);
            if (bill?.categoryId) transactionData.categoryId = bill.categoryId;
        }
        const txRef = await addDoc(collection(db, `workspaces/${workspace.id}/transactions`), transactionData);
        updateData.transactionId = txRef.id;

        await updateDoc(doc(db, `workspaces/${workspace.id}/bill_payments`, paymentId), updateData);
    };

    const markAsPending = async (paymentId: string) => {
        if (!workspace?.id) return;
        const payment = payments.find(p => p.id === paymentId);
        if (!payment) return;

        const now = new Date();
        const dueDate = new Date(year, month - 1, payment.dueDay);
        const isOverdue = dueDate < now;

        // Se tinha conta vinculada, reverter saldo
        if (payment.paidAccountId && payment.paidAmount) {
            await updateDoc(
                doc(db, `workspaces/${workspace.id}/accounts`, payment.paidAccountId),
                { balance: increment(payment.paidAmount) } // Devolve o valor
            );
        }

        // Excluir o lançamento vinculado
        if ((payment as any).transactionId) {
            try {
                await deleteDoc(doc(db, `workspaces/${workspace.id}/transactions`, (payment as any).transactionId));
            } catch (e) { /* transaction may already be deleted */ }
        }

        await updateDoc(doc(db, `workspaces/${workspace.id}/bill_payments`, paymentId), {
            status: isOverdue ? 'overdue' : 'pending',
            paidAt: null,
            paidAmount: null,
            paidAccountId: null,
            transactionId: null
        });
    };

    // Status resumido
    const summary = {
        total: payments.length,
        paid: payments.filter(p => p.status === 'paid').length,
        pending: payments.filter(p => p.status === 'pending').length,
        overdue: payments.filter(p => p.status === 'overdue').length,
        totalAmount: payments.reduce((acc, p) => acc + p.amount, 0),
        paidAmount: payments.filter(p => p.status === 'paid').reduce((acc, p) => acc + (p.paidAmount || p.amount), 0),
    };

    return { payments, loading, generatePayments, markAsPaid, markAsPending, summary };
}
