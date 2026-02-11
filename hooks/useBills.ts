import {
    collection,
    doc,
    addDoc,
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
import { useState, useEffect } from 'react';
import type { RecurringBill, BillPayment } from '@/types';

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

const statusPriority: Record<BillPayment['status'], number> = {
    paid: 4,
    overdue: 3,
    pending: 2,
    skipped: 1,
};

const pickPreferredPayment = (current: BillPayment | undefined, candidate: BillPayment) => {
    if (!current) return candidate;

    const currentPriority = statusPriority[current.status] || 0;
    const candidatePriority = statusPriority[candidate.status] || 0;

    if (candidatePriority > currentPriority) return candidate;

    const currentUpdated = current.paidAt || 0;
    const candidateUpdated = candidate.paidAt || 0;

    if (candidatePriority === currentPriority && candidateUpdated > currentUpdated) {
        return candidate;
    }

    return current;
};

// Pagamentos de despesas fixas por mês
export function useBillPayments(month: number, year: number) {
    const { workspace } = useWorkspace();
    const { bills } = useRecurringBills();
    const { user } = useAuth();
    const [payments, setPayments] = useState<BillPayment[]>([]);
    const [loading, setLoading] = useState(true);

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

            // Filtrar pagamentos de despesas que já foram excluídas
            const activeBillIds = bills.map(b => b.id);
            const validItems = items.filter(p => activeBillIds.includes(p.billId));

            // Garantir apenas um pagamento por billId na UI
            const uniqueByBillId = validItems.reduce((acc, payment) => {
                const current = acc.get(payment.billId);
                acc.set(payment.billId, pickPreferredPayment(current, payment));
                return acc;
            }, new Map<string, BillPayment>());

            setPayments(Array.from(uniqueByBillId.values()));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [workspace?.id, month, year, bills]);

    // Gerar pagamentos para o mês (cria se não existir)
    const generatePayments = async () => {
        if (!workspace?.id || !bills.length) return;

        const monthlyQuery = query(
            collection(db, `workspaces/${workspace.id}/bill_payments`),
            where('month', '==', month),
            where('year', '==', year)
        );
        const monthlySnapshot = await getDocs(monthlyQuery);

        const activeBillIds = new Set(bills.map(b => b.id));
        const snapshotsByBill = monthlySnapshot.docs.reduce((acc, docSnap) => {
            const data = docSnap.data() as BillPayment;
            if (!activeBillIds.has(data.billId)) return acc;

            const list = acc.get(data.billId) || [];
            list.push(docSnap);
            acc.set(data.billId, list);
            return acc;
        }, new Map<string, typeof monthlySnapshot.docs>());

        // Limpar duplicatas antigas, mantendo apenas um registro por billId
        for (const [billId, docs] of snapshotsByBill.entries()) {
            if (docs.length <= 1) continue;

            let preferredDoc = docs[0];
            for (const currentDoc of docs.slice(1)) {
                const preferredData = { id: preferredDoc.id, ...(preferredDoc.data() as Omit<BillPayment, 'id'>) } as BillPayment;
                const currentData = { id: currentDoc.id, ...(currentDoc.data() as Omit<BillPayment, 'id'>) } as BillPayment;
                const selected = pickPreferredPayment(preferredData, currentData);
                preferredDoc = selected.id === currentDoc.id ? currentDoc : preferredDoc;
            }

            const duplicates = docs.filter(d => d.id !== preferredDoc.id);
            await Promise.all(
                duplicates.map(d => deleteDoc(doc(db, `workspaces/${workspace.id}/bill_payments`, d.id)))
            );

            snapshotsByBill.set(billId, [preferredDoc]);
        }

        for (const bill of bills) {
            if ((snapshotsByBill.get(bill.id) || []).length > 0) continue;

            const now = new Date();
            const dueDate = new Date(year, month - 1, bill.dueDay);
            const isOverdue = dueDate < now;

            await addDoc(collection(db, `workspaces/${workspace.id}/bill_payments`), {
                billId: bill.id,
                billName: bill.name,
                amount: bill.amount,
                month,
                year,
                dueDay: bill.dueDay,
                status: isOverdue ? 'overdue' : 'pending',
                createdAt: Date.now()
            });
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

    const unlinkPaymentFromTransaction = async (payment: BillPayment & { transactionId?: string }) => {
        if (!workspace?.id) return;

        if (payment.paidAccountId && payment.paidAmount) {
            await updateDoc(
                doc(db, `workspaces/${workspace.id}/accounts`, payment.paidAccountId),
                { balance: increment(payment.paidAmount) }
            );
        }

        if (payment.transactionId) {
            try {
                await deleteDoc(doc(db, `workspaces/${workspace.id}/transactions`, payment.transactionId));
            } catch (e) { /* transaction may already be deleted */ }
        }
    };

    const markAsPending = async (paymentId: string) => {
        if (!workspace?.id) return;
        const payment = payments.find(p => p.id === paymentId) as (BillPayment & { transactionId?: string }) | undefined;
        if (!payment) return;

        const now = new Date();
        const dueDate = new Date(year, month - 1, payment.dueDay);
        const isOverdue = dueDate < now;

        await unlinkPaymentFromTransaction(payment);

        await updateDoc(doc(db, `workspaces/${workspace.id}/bill_payments`, paymentId), {
            status: isOverdue ? 'overdue' : 'pending',
            paidAt: null,
            paidAmount: null,
            paidAccountId: null,
            transactionId: null
        });
    };

    const markAsSkipped = async (paymentId: string) => {
        if (!workspace?.id) return;

        const payment = payments.find(p => p.id === paymentId) as (BillPayment & { transactionId?: string }) | undefined;
        if (!payment) return;

        if (payment.status === 'paid') {
            await unlinkPaymentFromTransaction(payment);
        }

        await updateDoc(doc(db, `workspaces/${workspace.id}/bill_payments`, paymentId), {
            status: 'skipped',
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
        skipped: payments.filter(p => p.status === 'skipped').length,
        totalAmount: payments.reduce((acc, p) => acc + p.amount, 0),
        paidAmount: payments.filter(p => p.status === 'paid').reduce((acc, p) => acc + (p.paidAmount || p.amount), 0),
    };

    return { payments, loading, generatePayments, markAsPaid, markAsPending, markAsSkipped, summary };
}
