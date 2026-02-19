import type { User } from "firebase/auth";

type ReportBehavioralActionInput = {
    workspaceId?: string | null;
    user?: User | null;
    actionAt?: number;
    source: string;
};

export async function reportBehavioralAction(input: ReportBehavioralActionInput) {
    const workspaceId = input.workspaceId?.trim();
    if (!workspaceId || !input.user) return false;

    try {
        const token = await input.user.getIdToken();
        const response = await fetch("/api/behavioral/recalculate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                workspaceId,
                actionAt: input.actionAt || Date.now(),
                source: input.source,
            }),
        });

        return response.ok;
    } catch (error) {
        console.warn("behavioral metrics report failed:", error);
        return false;
    }
}
