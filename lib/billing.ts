import type { Workspace, WorkspaceBilling, WorkspaceBillingStatus } from "@/types";

export const TRIAL_DAYS = 7;

const ACCESS_STATUSES: WorkspaceBillingStatus[] = ['active', 'trialing'];

export interface WorkspaceAccessState {
    status: WorkspaceBillingStatus;
    hasAccess: boolean;
    trialEndsAt?: number;
    trialDaysLeft?: number;
}

export function getDefaultTrialEndsAt(createdAt: number) {
    return createdAt + TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

export function normalizeWorkspaceBilling(workspace: Workspace | null | undefined): WorkspaceBilling {
    const createdAt = workspace?.createdAt || Date.now();
    const billing = workspace?.billing;
    const trialEndsAt = billing?.trialEndsAt || getDefaultTrialEndsAt(createdAt);

    if (!billing) {
        const now = Date.now();
        return {
            status: now <= trialEndsAt ? 'trialing' : 'inactive',
            trialEndsAt,
            updatedAt: now,
        };
    }

    if (billing.status === 'trialing' && billing.trialEndsAt && Date.now() > billing.trialEndsAt) {
        return {
            ...billing,
            status: 'inactive',
            updatedAt: Date.now(),
        };
    }

    return {
        ...billing,
        trialEndsAt,
    };
}

export function getWorkspaceAccessState(workspace: Workspace | null | undefined): WorkspaceAccessState {
    const billing = normalizeWorkspaceBilling(workspace);
    const now = Date.now();
    const hasAccess = ACCESS_STATUSES.includes(billing.status);

    const trialDaysLeft = billing.trialEndsAt
        ? Math.max(0, Math.ceil((billing.trialEndsAt - now) / (24 * 60 * 60 * 1000)))
        : undefined;

    return {
        status: billing.status,
        hasAccess,
        trialEndsAt: billing.trialEndsAt,
        trialDaysLeft,
    };
}

export function toUserSubscriptionStatus(status: WorkspaceBillingStatus): 'active' | 'inactive' | 'trial' | 'past_due' | 'canceled' {
    if (status === 'active') return 'active';
    if (status === 'trialing') return 'trial';
    if (status === 'past_due') return 'past_due';
    if (status === 'canceled') return 'canceled';
    return 'inactive';
}

