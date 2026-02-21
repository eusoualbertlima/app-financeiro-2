import { getWorkspaceAccessState } from "@/lib/billing";
import { getClientDevAdminAllowlist, hasDevAdminAccess } from "@/lib/devAdmin";
import type { Workspace } from "@/types";

export type ProductionAccessMode = "workspace_internal_bypass" | "billing_only";

// Billing is the only source of truth for production access control.
export const PRODUCTION_ACCESS_MODE: ProductionAccessMode = "billing_only";

type AccessReason = "billing" | "dev_admin" | "workspace_internal_bypass" | "blocked";

export interface AccessDecision {
    mode: ProductionAccessMode;
    hasEffectiveAccess: boolean;
    hasBillingAccess: boolean;
    reason: AccessReason;
    isDevAdmin: boolean;
    ownerIsDevAdmin: boolean;
    accessState: ReturnType<typeof getWorkspaceAccessState>;
}

export function resolveWorkspaceAccessDecision(input: {
    workspace: Workspace | null | undefined;
    user?: {
        uid?: string | null;
        email?: string | null;
        isDeveloperAdmin?: boolean;
    } | null;
}): AccessDecision {
    const accessState = getWorkspaceAccessState(input.workspace);
    const hasBillingAccess = Boolean(input.workspace) && accessState.hasAccess;
    const allowlist = getClientDevAdminAllowlist();
    const isDevAdmin = typeof input.user?.isDeveloperAdmin === "boolean"
        ? input.user.isDeveloperAdmin
        : hasDevAdminAccess({
            uid: input.user?.uid,
            email: input.user?.email,
            allowlist,
        });
    const ownerIsDevAdmin = hasDevAdminAccess({
        uid: input.workspace?.ownerId,
        email: input.workspace?.ownerEmail,
        allowlist,
    });

    if (hasBillingAccess) {
        return {
            mode: PRODUCTION_ACCESS_MODE,
            hasEffectiveAccess: true,
            hasBillingAccess: true,
            reason: "billing",
            isDevAdmin,
            ownerIsDevAdmin,
            accessState,
        };
    }

    if (PRODUCTION_ACCESS_MODE === "workspace_internal_bypass") {
        if (isDevAdmin) {
            return {
                mode: PRODUCTION_ACCESS_MODE,
                hasEffectiveAccess: true,
                hasBillingAccess: false,
                reason: "dev_admin",
                isDevAdmin,
                ownerIsDevAdmin,
                accessState,
            };
        }

        if (ownerIsDevAdmin) {
            return {
                mode: PRODUCTION_ACCESS_MODE,
                hasEffectiveAccess: true,
                hasBillingAccess: false,
                reason: "workspace_internal_bypass",
                isDevAdmin,
                ownerIsDevAdmin,
                accessState,
            };
        }
    }

    return {
        mode: PRODUCTION_ACCESS_MODE,
        hasEffectiveAccess: false,
        hasBillingAccess: false,
        reason: "blocked",
        isDevAdmin,
        ownerIsDevAdmin,
        accessState,
    };
}
