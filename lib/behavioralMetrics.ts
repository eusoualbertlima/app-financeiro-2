import type {
    BehavioralEnergyState,
    BehavioralMaturityRole,
    BehavioralStructureStage,
    WorkspaceBehavioralMetrics,
} from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

// Fixed offset keeps server/client calculations deterministic for BR-first product usage.
const DEFAULT_TIMEZONE_OFFSET_MINUTES = -180;

function normalizeTimestamp(value: unknown, fallback: number) {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    if (value <= 0) return fallback;
    return value;
}

function dayKey(timestamp: number, timezoneOffsetMinutes = DEFAULT_TIMEZONE_OFFSET_MINUTES) {
    return Math.floor((timestamp + timezoneOffsetMinutes * 60_000) / DAY_MS);
}

function calculateInactivityDays(lastActionTimestamp: number, now: number) {
    if (!Number.isFinite(lastActionTimestamp) || lastActionTimestamp <= 0) return 0;
    return Math.max(0, Math.floor((now - lastActionTimestamp) / DAY_MS));
}

function toEnergyState(inactiveDays: number): BehavioralEnergyState {
    if (inactiveDays >= 7) return "abandoned";
    if (inactiveDays >= 3) return "blackout_partial";
    if (inactiveDays >= 1) return "flicker";
    return "energized";
}

function toStructureStage(input: {
    consistencyIndex: number;
    maturityScore: number;
}): BehavioralStructureStage {
    if (input.consistencyIndex >= 365 || input.maturityScore >= 3650) {
        return "consolidation";
    }
    if (input.consistencyIndex >= 90 || input.maturityScore >= 900) {
        return "growth";
    }
    return "foundation";
}

function toMaturityRole(maturityScore: number): BehavioralMaturityRole {
    if (maturityScore >= 5000) return "magnata";
    if (maturityScore >= 1500) return "gestor_urbano";
    if (maturityScore >= 300) return "construtor";
    return "arquiteto";
}

function toSharedConsistencyState(memberState: Record<string, BehavioralEnergyState>) {
    const values = Object.values(memberState);
    if (!values.length) return "energized" as BehavioralEnergyState;

    const severity: Record<BehavioralEnergyState, number> = {
        energized: 0,
        flicker: 1,
        blackout_partial: 2,
        abandoned: 3,
    };

    return values.reduce((worst, candidate) => {
        return severity[candidate] > severity[worst] ? candidate : worst;
    }, "energized" as BehavioralEnergyState);
}

function toMemberEnergyState(input: {
    members: string[];
    memberLastActionAt: Record<string, number>;
    now: number;
}) {
    const result: Record<string, BehavioralEnergyState> = {};
    input.members.forEach((memberUid) => {
        const lastAction = normalizeTimestamp(input.memberLastActionAt[memberUid], 0);
        const inactiveDays = lastAction > 0 ? calculateInactivityDays(lastAction, input.now) : 999;
        result[memberUid] = toEnergyState(inactiveDays);
    });
    return result;
}

function toSharedConsistencyIndex(input: {
    members: string[];
    memberEnergyState: Record<string, BehavioralEnergyState>;
}) {
    if (!input.members.length) return 100;
    const activeMembers = input.members.filter((memberUid) => input.memberEnergyState[memberUid] === "energized").length;
    return Math.round((activeMembers / input.members.length) * 100);
}

function clampNonNegativeInteger(value: unknown, fallback = 0) {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.max(0, Math.floor(value));
}

export function createInitialBehavioralMetrics(createdAt = Date.now()): WorkspaceBehavioralMetrics {
    const now = normalizeTimestamp(createdAt, Date.now());
    const base: WorkspaceBehavioralMetrics = {
        consistencyIndex: 0,
        lastActionTimestamp: now,
        maturityScore: 0,
        structureStage: "foundation",
        maturityRole: "arquiteto",
        inactiveDays: 0,
        cityEnergyState: "energized",
        memberLastActionAt: {},
        memberEnergyState: {},
        sharedConsistencyState: "energized",
        sharedConsistencyIndex: 100,
        updatedAt: now,
    };
    return base;
}

export function normalizeBehavioralMetrics(
    raw: Partial<WorkspaceBehavioralMetrics> | undefined,
    input?: { now?: number; members?: string[] }
): WorkspaceBehavioralMetrics {
    const now = normalizeTimestamp(input?.now, Date.now());
    const initial = createInitialBehavioralMetrics(now);
    const memberLastActionAt: Record<string, number> = {};

    if (raw?.memberLastActionAt) {
        Object.entries(raw.memberLastActionAt).forEach(([uid, timestamp]) => {
            memberLastActionAt[uid] = normalizeTimestamp(timestamp, 0);
        });
    }

    const consistencyIndex = clampNonNegativeInteger(raw?.consistencyIndex, initial.consistencyIndex);
    const maturityScore = clampNonNegativeInteger(raw?.maturityScore, initial.maturityScore);
    const lastActionTimestamp = normalizeTimestamp(raw?.lastActionTimestamp, initial.lastActionTimestamp);
    const inactiveDays = calculateInactivityDays(lastActionTimestamp, now);
    const cityEnergyState = toEnergyState(inactiveDays);
    const structureStage = toStructureStage({ consistencyIndex, maturityScore });
    const maturityRole = toMaturityRole(maturityScore);
    const members = Array.isArray(input?.members) ? input.members.filter(Boolean) : [];
    const memberEnergyState = toMemberEnergyState({
        members,
        memberLastActionAt,
        now,
    });
    const sharedConsistencyState = toSharedConsistencyState(memberEnergyState);
    const sharedConsistencyIndex = toSharedConsistencyIndex({ members, memberEnergyState });

    return {
        consistencyIndex,
        lastActionTimestamp,
        maturityScore,
        structureStage,
        maturityRole,
        inactiveDays,
        cityEnergyState,
        memberLastActionAt,
        memberEnergyState,
        sharedConsistencyState,
        sharedConsistencyIndex,
        updatedAt: normalizeTimestamp(raw?.updatedAt, now),
    };
}

export function applyBehavioralAction(input: {
    current: Partial<WorkspaceBehavioralMetrics> | undefined;
    actorUid: string;
    actionAt?: number;
    members?: string[];
}) {
    const actionAt = normalizeTimestamp(input.actionAt, Date.now());
    const current = normalizeBehavioralMetrics(input.current, {
        now: actionAt,
        members: input.members,
    });

    const previousActionDay = dayKey(current.lastActionTimestamp);
    const actionDay = dayKey(actionAt);
    const dayGap = actionDay - previousActionDay;

    let nextConsistency = current.consistencyIndex;
    let nextMaturityScore = current.maturityScore;

    if (dayGap <= 0) {
        nextMaturityScore += 1;
    } else if (dayGap === 1) {
        nextConsistency += 1;
        nextMaturityScore += 10;
    } else {
        nextConsistency = 1;
        nextMaturityScore += 10;
    }

    const nextMemberLastActionAt = {
        ...(current.memberLastActionAt || {}),
        [input.actorUid]: actionAt,
    };

    return normalizeBehavioralMetrics(
        {
            ...current,
            consistencyIndex: nextConsistency,
            maturityScore: nextMaturityScore,
            lastActionTimestamp: Math.max(current.lastActionTimestamp, actionAt),
            memberLastActionAt: nextMemberLastActionAt,
            updatedAt: actionAt,
        },
        {
            now: actionAt,
            members: input.members,
        }
    );
}

export function applyBehavioralAging(input: {
    current: Partial<WorkspaceBehavioralMetrics> | undefined;
    members?: string[];
    now?: number;
}) {
    const now = normalizeTimestamp(input.now, Date.now());
    const current = normalizeBehavioralMetrics(input.current, {
        now,
        members: input.members,
    });
    const nextInactiveDays = calculateInactivityDays(current.lastActionTimestamp, now);
    const previousInactiveDays = clampNonNegativeInteger(current.inactiveDays, 0);
    const agingDelta = Math.max(0, nextInactiveDays - previousInactiveDays);
    const nextConsistency = Math.max(0, current.consistencyIndex - agingDelta);

    return normalizeBehavioralMetrics(
        {
            ...current,
            consistencyIndex: nextConsistency,
            inactiveDays: nextInactiveDays,
            updatedAt: now,
        },
        {
            now,
            members: input.members,
        }
    );
}
