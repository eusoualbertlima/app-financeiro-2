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
import { useState, useEffect, useRef, useCallback } from 'react';
import type { RecurringBill, BillPayment } from '@/types';
import { recordWorkspaceAuditEvent } from '@/lib/audit';

const paymentStatusPriority: Record<BillPayment['status'], number> = {
    pending: 1,
    overdue: 2,
    skipped: 3,
    paid: 4,
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
    return (payment.status === 'pending' || payment.status === 'overdue')
        && !payment.paidAt
        && !payment.paidAmount
        && !payment.paidAccountId
        && !payment.skippedAt
        && !unsafePayment.transactionId;
}

// CRUD de Despesas Fixas
export function useRecurringBills() {
    const { workspace } = useWorkspace();
    const { user } = useAuth();
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
        const payload = {
            ...bill,
            isActive: true,
            createdAt: Date.now()
        };

        const docRef = await addDoc(collection(db, `workspaces/${workspace.id}/recurring_bills`), payload);
        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'create',
            entity: 'recurring_bills',
            entityId: docRef.id,
            summary: 'Despesa fixa criada.',
            payload: {
                bill: payload as any,
            },
        });
    };

    const update = async (id: string, bill: Partial<RecurringBill>) => {
        if (!workspace?.id) return;
        await updateDoc(doc(db, `workspaces/${workspace.id}/recurring_bills`, id), bill);
        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'update',
            entity: 'recurring_bills',
            entityId: id,
            summary: 'Despesa fixa atualizada.',
            payload: {
                changes: bill as any,
            },
        });
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

        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'delete',
            entity: 'recurring_bills',
            entityId: id,
            summary: 'Despesa fixa desativada e pagamentos órfãos removidos.',
            payload: {
                removedPayments: snap.docs.length,
            },
        });
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
    const generatePayments = useCallback(async () => {
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
    }, [workspace?.id, bills, month, year]);

    const markAsPaid = async (paymentId: string, paidAmount?: number, accountId?: string, note?: string) => {
        if (!workspace?.id) return;

        const normalizedNote = note?.trim();
        const paymentRef = doc(db, `workspaces/${workspace.id}/bill_payments`, paymentId);
        const transactionsCol = collection(db, `workspaces/${workspace.id}/transactions`);

        await runTransaction(db, async (transaction) => {
            const paymentSnap = await transaction.get(paymentRef);
            if (!paymentSnap.exists()) return;

            const paymentData = {
                id: paymentSnap.id,
                ...paymentSnap.data(),
            } as BillPayment & { transactionId?: string };

            if (paymentData.status === 'paid') {
                return;
            }

            const amount = paidAmount ?? paymentData.amount ?? 0;
            const paidAt = Date.now();
            const updateData: any = {
                status: 'paid',
                paidAt,
                paidAmount: amount,
            };

            if (accountId) {
                updateData.paidAccountId = accountId;
                transaction.update(
                    doc(db, `workspaces/${workspace.id}/accounts`, accountId),
                    { balance: increment(-amount) }
                );
            }

            const transactionRef = doc(transactionsCol);
            const transactionData: any = {
                description: paymentData.billName || 'Conta Fixa',
                amount,
                type: 'expense',
                status: 'paid',
                date: paidAt,
                paidAt,
                userId: user?.uid || '',
                source: 'bill_payment',
                billPaymentId: paymentId,
            };

            if (normalizedNote) transactionData.notes = normalizedNote;
            if (accountId) transactionData.accountId = accountId;
            if (paymentData.billId) {
                const bill = bills.find(b => b.id === paymentData.billId);
                if (bill?.categoryId) transactionData.categoryId = bill.categoryId;
            }

            transaction.set(transactionRef, transactionData);
            updateData.transactionId = transactionRef.id;
            transaction.update(paymentRef, updateData);
        });

        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'mark_paid',
            entity: 'bill_payments',
            entityId: paymentId,
            summary: 'Conta fixa marcada como paga.',
            payload: {
                paidAmount: paidAmount || null,
                accountId: accountId || null,
                note: normalizedNote || null,
            },
        });
    };

    const markAsPending = async (paymentId: string) => {
        if (!workspace?.id) return;

        const paymentRef = doc(db, `workspaces/${workspace.id}/bill_payments`, paymentId);

        await runTransaction(db, async (transaction) => {
            const paymentSnap = await transaction.get(paymentRef);
            if (!paymentSnap.exists()) return;

            const paymentData = {
                id: paymentSnap.id,
                ...paymentSnap.data(),
            } as BillPayment & { transactionId?: string };

            if (paymentData.paidAccountId && paymentData.paidAmount) {
                transaction.update(
                    doc(db, `workspaces/${workspace.id}/accounts`, paymentData.paidAccountId),
                    { balance: increment(paymentData.paidAmount) }
                );
            }

            if (paymentData.transactionId) {
                transaction.delete(doc(db, `workspaces/${workspace.id}/transactions`, paymentData.transactionId));
            }

            const now = new Date();
            const dueDate = new Date(paymentData.year, paymentData.month - 1, paymentData.dueDay);
            const isOverdue = dueDate < now;

            transaction.update(paymentRef, {
                status: isOverdue ? 'overdue' : 'pending',
                paidAt: null,
                paidAmount: null,
                paidAccountId: null,
                skippedAt: null,
                transactionId: null
            });
        });

        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'mark_pending',
            entity: 'bill_payments',
            entityId: paymentId,
            summary: 'Conta fixa voltou para pendente/atrasada.',
        });
    };

    const markAsSkipped = async (paymentId: string) => {
        if (!workspace?.id) return;

        const paymentRef = doc(db, `workspaces/${workspace.id}/bill_payments`, paymentId);

        await runTransaction(db, async (transaction) => {
            const paymentSnap = await transaction.get(paymentRef);
            if (!paymentSnap.exists()) return;

            const paymentData = {
                id: paymentSnap.id,
                ...paymentSnap.data(),
            } as BillPayment & { transactionId?: string };

            if (paymentData.paidAccountId && paymentData.paidAmount) {
                transaction.update(
                    doc(db, `workspaces/${workspace.id}/accounts`, paymentData.paidAccountId),
                    { balance: increment(paymentData.paidAmount) }
                );
            }

            if (paymentData.transactionId) {
                transaction.delete(doc(db, `workspaces/${workspace.id}/transactions`, paymentData.transactionId));
            }

            transaction.update(paymentRef, {
                status: 'skipped',
                skippedAt: Date.now(),
                paidAt: null,
                paidAmount: null,
                paidAccountId: null,
                transactionId: null
            });
        });

        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'mark_skipped',
            entity: 'bill_payments',
            entityId: paymentId,
            summary: 'Conta fixa marcada como pulada.',
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
