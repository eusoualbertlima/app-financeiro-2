import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { useWorkspace } from "@/hooks/useFirestore";
import type { OpsAlert } from "@/types";

export function useOpsAlerts(maxItems = 100, enabled = true) {
    const { workspace } = useWorkspace();
    const [alerts, setAlerts] = useState<OpsAlert[]>([]);
    const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(null);
    const [loadedKey, setLoadedKey] = useState<string | null>(null);
    const queryKey = workspace?.id && enabled ? `${workspace.id}:${maxItems}` : null;

    useEffect(() => {
        if (!workspace?.id || !enabled || !queryKey) {
            return;
        }

        const q = query(
            collection(db, `workspaces/${workspace.id}/ops_alerts`),
            orderBy("createdAt", "desc"),
            limit(maxItems)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const items = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                })) as OpsAlert[];

                setAlerts(items);
                setLoadedWorkspaceId(workspace.id);
                setLoadedKey(queryKey);
            },
            () => {
                setAlerts([]);
                setLoadedWorkspaceId(workspace.id);
                setLoadedKey(queryKey);
            }
        );

        return () => unsubscribe();
    }, [workspace?.id, maxItems, enabled, queryKey]);

    const hasLoadedCurrentWorkspace = Boolean(workspace?.id && loadedWorkspaceId === workspace.id);
    const hasLoadedCurrentKey = Boolean(queryKey && loadedKey === queryKey);

    return {
        alerts: hasLoadedCurrentWorkspace && hasLoadedCurrentKey ? alerts : [],
        loading: queryKey ? !(hasLoadedCurrentWorkspace && hasLoadedCurrentKey) : false,
    };
}
