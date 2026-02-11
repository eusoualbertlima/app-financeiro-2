import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    getDocs,
    setDoc,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import type { Workspace, Transaction, Account, CreditCard, Category } from '@/types';
import { getDefaultTrialEndsAt, normalizeWorkspaceBilling } from '@/lib/billing';

// Hook para gerenciar Workspaces
export function useWorkspace() {
    const { user } = useAuth();
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [loading, setLoading] = useState(true);

    // Buscar ou criar workspace automático para o usuário
    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'workspaces'),
            where('members', 'array-contains', user.uid)
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            if (snapshot.empty) {
                // Verificar se existe convite pendente por email
                if (user.email) {
                    const inviteQuery = query(
                        collection(db, 'workspaces'),
                        where('pendingInvites', 'array-contains', user.email.toLowerCase())
                    );
                    const inviteSnapshot = await getDocs(inviteQuery);

                    if (!inviteSnapshot.empty) {
                        // Aceitar convite: adicionar como membro e remover do pendingInvites
                        const invitedDoc = inviteSnapshot.docs[0];
                        await updateDoc(doc(db, 'workspaces', invitedDoc.id), {
                            members: arrayUnion(user.uid),
                            pendingInvites: arrayRemove(user.email.toLowerCase())
                        });
                        const docData = invitedDoc.data() as Omit<Workspace, 'id'>;
                        setWorkspace({ id: invitedDoc.id, ...docData });
                        setLoading(false);
                        return;
                    }
                }

                // Se não tem workspace nem convite, cria um padrão
                const newWorkspace = {
                    name: 'Minhas Finanças',
                    members: [user.uid],
                    ownerId: user.uid,
                    createdAt: Date.now(),
                    billing: {
                        status: 'trialing' as const,
                        trialEndsAt: getDefaultTrialEndsAt(Date.now()),
                        updatedAt: Date.now(),
                    },
                };
                const docRef = await addDoc(collection(db, 'workspaces'), newWorkspace);
                setWorkspace({ id: docRef.id, ...newWorkspace });
            } else {
                const workspaceId = snapshot.docs[0].id;
                const docData = snapshot.docs[0].data() as Omit<Workspace, 'id'>;
                const normalizedBilling = normalizeWorkspaceBilling({ id: workspaceId, ...docData } as Workspace);

                const shouldPatchBilling =
                    !docData.billing
                    || docData.billing.status !== normalizedBilling.status
                    || docData.billing.trialEndsAt !== normalizedBilling.trialEndsAt;

                if (shouldPatchBilling) {
                    await setDoc(
                        doc(db, 'workspaces', workspaceId),
                        {
                            billing: {
                                ...docData.billing,
                                ...normalizedBilling,
                                updatedAt: Date.now(),
                            }
                        },
                        { merge: true }
                    );
                }

                setWorkspace({
                    id: workspaceId,
                    ...docData,
                    billing: {
                        ...docData.billing,
                        ...normalizedBilling,
                    },
                });
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    return { workspace, loading };
}

// Hook genérico para coleções dentro do workspace
export function useCollection<T>(collectionName: string) {
    const { workspace } = useWorkspace();
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workspace?.id) return;

        const q = collection(db, `workspaces/${workspace.id}/${collectionName}`);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as T[];
            setData(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [workspace?.id, collectionName]);

    const add = async (item: Omit<T, 'id'>) => {
        if (!workspace?.id) return;
        await addDoc(collection(db, `workspaces/${workspace.id}/${collectionName}`), item);
    };

    const update = async (id: string, item: Partial<T>) => {
        if (!workspace?.id) return;
        await updateDoc(doc(db, `workspaces/${workspace.id}/${collectionName}`, id), item);
    };

    const remove = async (id: string) => {
        if (!workspace?.id) return;
        await deleteDoc(doc(db, `workspaces/${workspace.id}/${collectionName}`, id));
    };

    return { data, loading, add, update, remove };
}
