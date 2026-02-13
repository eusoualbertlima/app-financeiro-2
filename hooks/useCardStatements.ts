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
    getDocs,
    increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useWorkspace } from '@/hooks/useFirestore';
import { useState, useEffect } from 'react';
import type { CardStatement, Transaction } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { recordWorkspaceAuditEvent } from '@/lib/audit';

export function useCardStatements(cardId: string, month?: number, year?: number) {
    const { workspace } = useWorkspace();
    const { user } = useAuth();
    const [statement, setStatement] = useState<CardStatement | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workspace?.id || !cardId || month === undefined || year === undefined) return;

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

        const closingDate = new Date(year, month - 1, closingDay).getTime();
        const dueDate = new Date(year, month - 1, dueDay).getTime();

        await addDoc(collection(db, `workspaces/${workspace.id}/card_statements`), {
            cardId,
            cardName,
            month,
            year,
            closingDate,
            dueDate,
            totalAmount: totalFromTransactions,
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
    const updateAmount = async (newAmount: number) => {
        if (!workspace?.id || !statement?.id) return;
        await updateDoc(
            doc(db, `workspaces/${workspace.id}/card_statements`, statement.id),
            { totalAmount: newAmount }
        );

        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'update',
            entity: 'card_statements',
            entityId: statement.id,
            summary: 'Valor da fatura atualizado.',
            payload: {
                previousAmount: statement.totalAmount,
                newAmount,
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
