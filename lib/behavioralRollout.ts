export type BehavioralRolloutMode = "off" | "dev_admin" | "all";

function normalizeBehavioralRolloutMode(value?: string | null): BehavioralRolloutMode {
    const normalized = (value || "").trim().toLowerCase();
    if (normalized === "all") return "all";
    if (normalized === "off") return "off";
    return "dev_admin";
}

export function getClientBehavioralRolloutMode() {
    return normalizeBehavioralRolloutMode(process.env.NEXT_PUBLIC_BEHAVIORAL_CITY_ROLLOUT);
}

export function getServerBehavioralRolloutMode() {
    return normalizeBehavioralRolloutMode(process.env.BEHAVIORAL_CITY_ROLLOUT);
}

export function hasBehavioralRolloutAccess(input: {
    mode: BehavioralRolloutMode;
    isDeveloperAdmin: boolean;
}) {
    if (input.mode === "off") return false;
    if (input.mode === "all") return true;
    return input.isDeveloperAdmin;
}
