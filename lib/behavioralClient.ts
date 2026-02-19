import type { User } from "firebase/auth";
import { getClientDevAdminAllowlist, hasDevAdminAccess } from "@/lib/devAdmin";

type BehavioralRolloutMode = "off" | "dev_admin" | "all";

const clientAllowlist = getClientDevAdminAllowlist();

function getBehavioralRolloutMode(): BehavioralRolloutMode {
    const raw = (process.env.NEXT_PUBLIC_BEHAVIORAL_CITY_ROLLOUT || "dev_admin").trim().toLowerCase();
    if (raw === "all") return "all";
    if (raw === "off") return "off";
    return "dev_admin";
}

function isBehavioralEnabledForUser(user?: User | null) {
    const mode = getBehavioralRolloutMode();
    if (mode === "off") return false;
    if (mode === "all") return true;
    return hasDevAdminAccess({
        uid: user?.uid,
        email: user?.email,
        allowlist: clientAllowlist,
    });
}

type ReportBehavioralActionInput = {
    workspaceId?: string | null;
    user?: User | null;
    actionAt?: number;
    source: string;
};

export async function reportBehavioralAction(input: ReportBehavioralActionInput) {
    const workspaceId = input.workspaceId?.trim();
    if (!workspaceId || !input.user) return false;
    if (!isBehavioralEnabledForUser(input.user)) return false;

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
