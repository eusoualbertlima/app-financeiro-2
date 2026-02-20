"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getDefaultTrialEndsAt, normalizeWorkspaceBilling } from "@/lib/billing";
import { createInitialBehavioralMetrics, normalizeBehavioralMetrics } from "@/lib/behavioralMetrics";
import { db } from "@/lib/firebase";
import type { Workspace } from "@/types";
import {
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDocs,
    query,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";

type WorkspaceContextValue = {
    workspace: Workspace | null;
    loading: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

function pickPreferredWorkspaceDoc(
    docs: Array<{ id: string; data: () => Record<string, unknown> }>
) {
    if (docs.length <= 1) return docs[0] || null;

    const getBillingPriority = (docRef: { id: string; data: () => Record<string, unknown> }) => {
        const workspaceLike = { id: docRef.id, ...(docRef.data() as Omit<Workspace, "id">) } as Workspace;
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

        const aCreatedAt = typeof aData.createdAt === "number" ? aData.createdAt : Number.MAX_SAFE_INTEGER;
        const bCreatedAt = typeof bData.createdAt === "number" ? bData.createdAt : Number.MAX_SAFE_INTEGER;
        return aCreatedAt - bCreatedAt;
    });

    return sorted[0];
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setWorkspace(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        let isActive = true;

        const hydrateWorkspace = (workspaceId: string, docData: Omit<Workspace, "id">) => {
            const normalizedBilling = normalizeWorkspaceBilling({ id: workspaceId, ...docData } as Workspace);
            const normalizedBehavioralMetrics = normalizeBehavioralMetrics(docData.behavioralMetrics, {
                now: Date.now(),
                members: Array.isArray(docData.members) ? docData.members : [],
            });
            return {
                id: workspaceId,
                ...docData,
                billing: {
                    ...docData.billing,
                    ...normalizedBilling,
                },
                behavioralMetrics: normalizedBehavioralMetrics,
            } as Workspace;
        };

        const setWorkspaceFromData = (workspaceId: string, docData: Omit<Workspace, "id">) => {
            if (!isActive) return null;
            const hydrated = hydrateWorkspace(workspaceId, docData);
            setWorkspace(hydrated);
            return hydrated;
        };

        const recoverWorkspaceViaApi = async (createIfMissing: boolean) => {
            try {
                const token = await user.getIdToken();
                const response = await fetch("/api/workspace/recover", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ createIfMissing }),
                });

                if (!response.ok) {
                    return null;
                }

                const payload = (await response.json()) as { workspace?: Workspace | null };
                const recoveredWorkspace = payload?.workspace || null;
                if (!recoveredWorkspace) {
                    return null;
                }

                const { id: recoveredWorkspaceId, ...recoveredWorkspaceData } = recoveredWorkspace;
                return setWorkspaceFromData(
                    recoveredWorkspaceId,
                    recoveredWorkspaceData as Omit<Workspace, "id">
                );
            } catch (recoverError) {
                console.error("Falha ao recuperar workspace via API:", recoverError);
                return null;
            }
        };

        const createDefaultWorkspace = async () => {
            const createdAt = Date.now();
            const workspaceId = `default_${user.uid}`;
            const newWorkspace = {
                name: "Minhas Finanças",
                members: [user.uid],
                ownerId: user.uid,
                ownerEmail: user.email?.toLowerCase() || undefined,
                createdAt,
                billing: {
                    status: "trialing" as const,
                    trialEndsAt: getDefaultTrialEndsAt(createdAt),
                    updatedAt: Date.now(),
                },
                behavioralMetrics: createInitialBehavioralMetrics(createdAt),
            };
            await setDoc(doc(db, "workspaces", workspaceId), newWorkspace, { merge: true });
            setWorkspaceFromData(workspaceId, newWorkspace);
        };

        const q = query(
            collection(db, "workspaces"),
            where("members", "array-contains", user.uid)
        );

        const loadWorkspace = async () => {
            try {
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    if (user.email) {
                        const normalizedEmail = user.email.toLowerCase();
                        try {
                            const inviteQuery = query(
                                collection(db, "workspaces"),
                                where("pendingInvites", "array-contains", normalizedEmail)
                            );
                            const inviteSnapshot = await getDocs(inviteQuery);

                            if (!inviteSnapshot.empty) {
                                const invitedDoc = inviteSnapshot.docs[0];
                                await updateDoc(doc(db, "workspaces", invitedDoc.id), {
                                    members: arrayUnion(user.uid),
                                    pendingInvites: arrayRemove(normalizedEmail),
                                });
                                const docData = invitedDoc.data() as Omit<Workspace, "id">;
                                setWorkspaceFromData(invitedDoc.id, docData);
                                return;
                            }
                        } catch (inviteError) {
                            console.warn(
                                "Nao foi possivel verificar convites pendentes, criando workspace padrao.",
                                inviteError
                            );
                        }
                    }

                    const recoveredWorkspace = await recoverWorkspaceViaApi(true);
                    if (recoveredWorkspace) {
                        return;
                    }

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
                const docData = preferredWorkspaceDoc.data() as Omit<Workspace, "id">;
                setWorkspaceFromData(workspaceId, docData);
            } catch (error) {
                console.error("Erro ao carregar workspace:", error);
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

    return (
        <WorkspaceContext.Provider value={{ workspace, loading }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspaceContext() {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error("useWorkspaceContext must be used within a WorkspaceProvider");
    }
    return context;
}
