import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { useWorkspace } from "@/hooks/useFirestore";
import type { OpsAlert } from "@/types";

export function useOpsAlerts(maxItems = 100) {
    const { workspace } = useWorkspace();
    const [alerts, setAlerts] = useState<OpsAlert[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workspace?.id) {
            setAlerts([]);
            setLoading(false);
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
                setLoading(false);
            },
            () => {
                setAlerts([]);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [workspace?.id, maxItems]);

    return { alerts, loading };
}
