import {
    collection,
    doc,
    addDoc,
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

    useEffect(() => {
        if (!workspace?.id || !cardId || month === undefined || year === undefined) {
            setStatement(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setStatement(null);

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

        let targetStatementId = statement?.id;
        let previousAmount = statement?.totalAmount ?? 0;

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
                previousAmount = Number((docSnap.data() as CardStatement).totalAmount || 0);
            } else {
                const seed = options?.createIfMissing;
                if (!seed) return;

                const { closingDate, dueDate } = resolveStatementDates(month, year, seed.closingDay, seed.dueDay);
                const docRef = await addDoc(collection(db, `workspaces/${workspace.id}/card_statements`), {
                    cardId,
                    cardName: seed.cardName,
                    month,
                    year,
                    closingDate,
                    dueDate,
                    totalAmount: newAmount,
                    amountMode: source,
                    status: 'open',
                });

                await recordWorkspaceAuditEvent({
                    workspaceId: workspace.id,
                    actorUid: user?.uid,
                    action: 'create',
                    entity: 'card_statements',
                    entityId: docRef.id,
                    summary: 'Fatura criada manualmente no ajuste.',
                    payload: {
                        cardId,
                        month,
                        year,
                        totalAmount: newAmount,
                        source,
                    },
                });
                return;
            }
        }

        await updateDoc(
            doc(db, `workspaces/${workspace.id}/card_statements`, targetStatementId),
            {
                totalAmount: newAmount,
                amountMode: source,
            }
        );

        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'update',
            entity: 'card_statements',
            entityId: targetStatementId,
            summary: 'Valor da fatura atualizado.',
            payload: {
                previousAmount,
                newAmount,
                source,
            },
        });
    };

    // Pagar fatura
    const payStatement = async (accountId: string) => {
        if (!workspace?.id || !statement?.id) return;

        // Atualizar fatura como paga
        await updateDoc(
            doc(db, `workspaces/${workspace.id}/card_statements`, statement.id),
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
                { balance: increment(-statement.totalAmount) }
            );
        }

        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'mark_paid',
            entity: 'card_statements',
            entityId: statement.id,
            summary: 'Fatura marcada como paga.',
            payload: {
                accountId,
                amount: statement.totalAmount,
            },
        });
    };

    // Reabrir fatura
    const reopenStatement = async () => {
        if (!workspace?.id || !statement?.id) return;

        // Se estava paga, reverter saldo da conta
        if (statement.status === 'paid' && statement.paidAccountId) {
            await updateDoc(
                doc(db, `workspaces/${workspace.id}/accounts`, statement.paidAccountId),
                { balance: increment(statement.totalAmount) }
            );
        }

        await updateDoc(
            doc(db, `workspaces/${workspace.id}/card_statements`, statement.id),
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
            entityId: statement.id,
            summary: 'Fatura reaberta.',
            payload: {
                previousStatus: statement.status,
                paidAccountId: statement.paidAccountId || null,
                amount: statement.totalAmount,
            },
        });
    };

    return {
        statement,
        loading,
        generateStatement,
        updateAmount,
        payStatement,
        reopenStatement,
    };
}
