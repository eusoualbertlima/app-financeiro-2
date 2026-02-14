import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    onSnapshot,
    getDocs,
    getDoc,
    setDoc,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import type { Workspace } from '@/types';
import { getDefaultTrialEndsAt, normalizeWorkspaceBilling } from '@/lib/billing';
import { recordWorkspaceAuditEvent } from '@/lib/audit';

// Hook para gerenciar Workspaces
export function useWorkspace() {
    const { user } = useAuth();
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [loading, setLoading] = useState(true);

    // Buscar ou criar workspace automático para o usuário
    useEffect(() => {
        if (!user) {
            setWorkspace(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        let isActive = true;
        const createDefaultWorkspace = async () => {
            const createdAt = Date.now();
            const newWorkspace = {
                name: 'Minhas Finanças',
                members: [user.uid],
                ownerId: user.uid,
                createdAt,
                billing: {
                    status: 'trialing' as const,
                    trialEndsAt: getDefaultTrialEndsAt(createdAt),
                    updatedAt: Date.now(),
                },
            };
            const docRef = await addDoc(collection(db, 'workspaces'), newWorkspace);
            if (isActive) {
                setWorkspace({ id: docRef.id, ...newWorkspace });
            }
        };

        const q = query(
            collection(db, 'workspaces'),
            where('members', 'array-contains', user.uid)
        );

        const loadWorkspace = async () => {
            try {
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    // Verificar se existe convite pendente por email.
                    // Se falhar por permissão/regras, seguimos com a criação de workspace padrão.
                    if (user.email) {
                        const normalizedEmail = user.email.toLowerCase();
                        try {
                            const inviteQuery = query(
                                collection(db, 'workspaces'),
                                where('pendingInvites', 'array-contains', normalizedEmail)
                            );
                            const inviteSnapshot = await getDocs(inviteQuery);

                            if (!inviteSnapshot.empty) {
                                // Aceitar convite: adicionar como membro e remover do pendingInvites
                                const invitedDoc = inviteSnapshot.docs[0];
                                await updateDoc(doc(db, 'workspaces', invitedDoc.id), {
                                    members: arrayUnion(user.uid),
                                    pendingInvites: arrayRemove(normalizedEmail)
                                });
                                const docData = invitedDoc.data() as Omit<Workspace, 'id'>;
                                if (isActive) {
                                    setWorkspace({ id: invitedDoc.id, ...docData });
                                }
                                return;
                            }
                        } catch (inviteError) {
                            console.warn('Não foi possível verificar convites pendentes, criando workspace padrão.', inviteError);
                        }
                    }

                    // Se não tem workspace nem convite, cria um padrão
                    await createDefaultWorkspace();
                    return;
                }

                const workspaceId = snapshot.docs[0].id;
                const docData = snapshot.docs[0].data() as Omit<Workspace, 'id'>;
                const normalizedBilling = normalizeWorkspaceBilling({ id: workspaceId, ...docData } as Workspace);
                const hydratedWorkspace: Workspace = {
                    id: workspaceId,
                    ...docData,
                    billing: {
                        ...docData.billing,
                        ...normalizedBilling,
                    },
                };

                if (isActive) {
                    setWorkspace(hydratedWorkspace);
                }

                const shouldPatchBilling =
                    !docData.billing
                    || docData.billing.status !== normalizedBilling.status
                    || docData.billing.trialEndsAt !== normalizedBilling.trialEndsAt;

                const isOwner = docData.ownerId === user.uid;

                if (shouldPatchBilling && isOwner) {
                    try {
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
                    } catch (patchError) {
                        console.warn('Falha ao atualizar billing do workspace:', patchError);
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar workspace:', error);
                try {
                    if (isActive) {
                        await createDefaultWorkspace();
                    }
                } catch (fallbackError) {
                    console.error('Erro ao criar workspace no fallback:', fallbackError);
                }
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        void loadWorkspace();

        return () => {
            isActive = false;
        };
    }, [user]);

    return { workspace, loading };
}

// Hook genérico para coleções dentro do workspace
export function useCollection<T>(collectionName: string) {
    const { user } = useAuth();
    const { workspace } = useWorkspace();
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workspace?.id) return;

        const q = collection(db, `workspaces/${workspace.id}/${collectionName}`);

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const items = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as T[];
                setData(items);
                setLoading(false);
            },
            (error) => {
                console.error(`Erro ao carregar coleção ${collectionName}:`, error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [workspace?.id, collectionName]);

    const add = async (item: Omit<T, 'id'>) => {
        if (!workspace?.id) return;
        const payload: Record<string, unknown> = { ...(item as Record<string, unknown>) };

        // Keep an immutable opening balance for future reconciliations.
        if (collectionName === 'accounts' && typeof payload.balance === 'number' && typeof payload.startingBalance !== 'number') {
            payload.startingBalance = payload.balance;
        }

        const docRef = await addDoc(collection(db, `workspaces/${workspace.id}/${collectionName}`), payload);
        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'create',
            entity: collectionName,
            entityId: docRef.id,
            summary: `Criado item em ${collectionName}.`,
            payload,
        });
    };

    const update = async (id: string, item: Partial<T>) => {
        if (!workspace?.id) return;
        const docRef = doc(db, `workspaces/${workspace.id}/${collectionName}`, id);
        const beforeSnap = await getDoc(docRef);
        const beforeData = beforeSnap.exists() ? beforeSnap.data() : null;
        const payload: Record<string, unknown> = { ...(item as Record<string, unknown>) };

        if (collectionName === 'accounts' && typeof payload.balance === 'number' && typeof payload.startingBalance !== 'number') {
            payload.startingBalance = payload.balance;
        }

        await updateDoc(docRef, payload);
        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'update',
            entity: collectionName,
            entityId: id,
            summary: `Atualizado item em ${collectionName}.`,
            payload: {
                before: beforeData as any,
                changes: payload as any,
            },
        });
    };

    const remove = async (id: string) => {
        if (!workspace?.id) return;
        const docRef = doc(db, `workspaces/${workspace.id}/${collectionName}`, id);
        const beforeSnap = await getDoc(docRef);
        const beforeData = beforeSnap.exists() ? beforeSnap.data() : null;

        await deleteDoc(docRef);
        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: 'delete',
            entity: collectionName,
            entityId: id,
            summary: `Removido item de ${collectionName}.`,
            payload: {
                before: beforeData as any,
            },
        });
    };

    return { data, loading, add, update, remove };
}
