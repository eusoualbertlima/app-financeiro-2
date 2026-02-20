import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    updateDoc,
} from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspaceContext } from "@/contexts/WorkspaceContext";
import { db } from "@/lib/firebase";
import { recordWorkspaceAuditEvent } from "@/lib/audit";
import { useEffect, useState } from "react";

// Workspace state is resolved once at provider level.
export function useWorkspace() {
    return useWorkspaceContext();
}

// Generic hook for workspace subcollections.
export function useCollection<T>(collectionName: string) {
    const { user } = useAuth();
    const { workspace } = useWorkspace();
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workspace?.id) return;

        const colRef = collection(db, `workspaces/${workspace.id}/${collectionName}`);
        const unsubscribe = onSnapshot(
            colRef,
            (snapshot) => {
                const items = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...docSnap.data(),
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

    const add = async (item: Omit<T, "id">) => {
        if (!workspace?.id) return;
        const payload: Record<string, unknown> = { ...(item as Record<string, unknown>) };

        // Keep an immutable opening balance for future reconciliations.
        if (
            collectionName === "accounts"
            && typeof payload.balance === "number"
            && typeof payload.startingBalance !== "number"
        ) {
            payload.startingBalance = payload.balance;
        }

        const docRef = await addDoc(collection(db, `workspaces/${workspace.id}/${collectionName}`), payload);
        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: "create",
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

        // Do not rewrite startingBalance on regular account edits.
        await updateDoc(docRef, payload);
        await recordWorkspaceAuditEvent({
            workspaceId: workspace.id,
            actorUid: user?.uid,
            action: "update",
            entity: collectionName,
            entityId: id,
            summary: `Atualizado item em ${collectionName}.`,
            payload: {
                before: beforeData as Record<string, unknown> | null,
                changes: payload,
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
            action: "delete",
            entity: collectionName,
            entityId: id,
            summary: `Removido item de ${collectionName}.`,
            payload: {
                before: beforeData as Record<string, unknown> | null,
            },
        });
    };

    return { data, loading, add, update, remove };
}
