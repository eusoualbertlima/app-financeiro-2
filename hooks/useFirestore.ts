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

function pickPreferredWorkspaceDoc(
    docs: Array<{ id: string; data: () => Record<string, unknown> }>
) {
    if (docs.length <= 1) return docs[0] || null;

    const getBillingPriority = (doc: { id: string; data: () => Record<string, unknown> }) => {
        const workspaceLike = { id: doc.id, ...(doc.data() as Omit<Workspace, "id">) } as Workspace;
        const status = normalizeWorkspaceBilling(workspaceLike).status;
        if (status === "active") return 5;
        if (status === "trialing") return 4;
        if (status === "past_due") return 3;
        if (status === "canceled") return 2;
        return 1;
    };

    const sorted = [...docs].sort((a, b) => {
        const aData = a.data();
        const bData = b.data();
        const aBillingPriority = getBillingPriority(a);
        const bBillingPriority = getBillingPriority(b);
        if (aBillingPriority !== bBillingPriority) return bBillingPriority - aBillingPriority;

        const aMembers = Array.isArray(aData.members) ? aData.members.length : 0;
        const bMembers = Array.isArray(bData.members) ? bData.members.length : 0;
        if (aMembers !== bMembers) return bMembers - aMembers;

        const aCreatedAt = typeof aData.createdAt === 'number' ? aData.createdAt : Number.MAX_SAFE_INTEGER;
        const bCreatedAt = typeof bData.createdAt === 'number' ? bData.createdAt : Number.MAX_SAFE_INTEGER;
        return aCreatedAt - bCreatedAt;
    });

    return sorted[0];
}

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

        const hydrateWorkspace = (workspaceId: string, docData: Omit<Workspace, 'id'>) => {
            const normalizedBilling = normalizeWorkspaceBilling({ id: workspaceId, ...docData } as Workspace);
            return {
                id: workspaceId,
                ...docData,
                billing: {
                    ...docData.billing,
                    ...normalizedBilling,
                },
            } as Workspace;
        };

        const setWorkspaceFromData = (workspaceId: string, docData: Omit<Workspace, 'id'>) => {
            if (!isActive) return null;
            const hydrated = hydrateWorkspace(workspaceId, docData);
            setWorkspace(hydrated);
            return hydrated;
        };

        const recoverWorkspaceViaApi = async (createIfMissing: boolean) => {
            try {
                const token = await user.getIdToken();
                const response = await fetch('/api/workspace/recover', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ createIfMissing }),
                });

                if (!response.ok) {
                    return null;
                }

                const payload = await response.json() as { workspace?: Workspace | null };
                const recoveredWorkspace = payload?.workspace || null;
                if (!recoveredWorkspace) {
                    return null;
                }

                const { id: recoveredWorkspaceId, ...recoveredWorkspaceData } = recoveredWorkspace;
                return setWorkspaceFromData(
                    recoveredWorkspaceId,
                    recoveredWorkspaceData as Omit<Workspace, 'id'>
                );
            } catch (recoverError) {
                console.error('Falha ao recuperar workspace via API:', recoverError);
                return null;
            }
        };

        const createDefaultWorkspace = async () => {
            const createdAt = Date.now();
            const workspaceId = `default_${user.uid}`;
            const newWorkspace = {
                name: 'Minhas Finanças',
                members: [user.uid],
                ownerId: user.uid,
                ownerEmail: user.email?.toLowerCase() || undefined,
                createdAt,
                billing: {
                    status: 'trialing' as const,
                    trialEndsAt: getDefaultTrialEndsAt(createdAt),
                    updatedAt: Date.now(),
                },
            };
            await setDoc(doc(db, 'workspaces', workspaceId), newWorkspace, { merge: true });
            setWorkspaceFromData(workspaceId, newWorkspace);
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
                                setWorkspaceFromData(invitedDoc.id, docData);
                                return;
                            }
                        } catch (inviteError) {
                            console.warn('Não foi possível verificar convites pendentes, criando workspace padrão.', inviteError);
                        }
                    }

                    const recoveredWorkspace = await recoverWorkspaceViaApi(true);
                    if (recoveredWorkspace) {
                        return;
                    }

                    // Se não tem workspace nem convite, cria um padrão
                    await createDefaultWorkspace();
                    return;
                }

                const shouldTryRecoverSelection = snapshot.docs.length > 1 || Boolean(user.email);
                if (shouldTryRecoverSelection) {
                    const recoveredWorkspace = await recoverWorkspaceViaApi(false);
                    if (recoveredWorkspace) {
                        return;
                    }
                }

                const preferredWorkspaceDoc = pickPreferredWorkspaceDoc(
                    snapshot.docs.map((docSnap) => ({
                        id: docSnap.id,
                        data: () => docSnap.data() as Record<string, unknown>,
                    }))
                );

                if (!preferredWorkspaceDoc) {
                    await createDefaultWorkspace();
                    return;
                }

                const workspaceId = preferredWorkspaceDoc.id;
                const docData = preferredWorkspaceDoc.data() as Omit<Workspace, 'id'>;
                const hydratedWorkspace = setWorkspaceFromData(workspaceId, docData);

                const shouldPatchBilling =
                    !docData.billing
                    || docData.billing.status !== hydratedWorkspace?.billing?.status
                    || docData.billing.trialEndsAt !== hydratedWorkspace?.billing?.trialEndsAt;

                const isOwner = docData.ownerId === user.uid;

                if (shouldPatchBilling && isOwner && hydratedWorkspace?.billing) {
                    try {
                        await setDoc(
                            doc(db, 'workspaces', workspaceId),
                            {
                                billing: {
                                    ...docData.billing,
                                    ...hydratedWorkspace.billing,
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
                const recoveredWorkspace = await recoverWorkspaceViaApi(true);
                if (!recoveredWorkspace && isActive) {
                    setWorkspace(null);
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
