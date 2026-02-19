import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUserFromRequest } from "@/lib/serverAuth";
import { applyBehavioralAging, normalizeBehavioralMetrics } from "@/lib/behavioralMetrics";
import {
    getServerDevAdminAllowlist,
    hasConfiguredDevAdminAllowlist,
    hasDevAdminAccess,
} from "@/lib/devAdmin";
import { sendOpsAlert, serializeError } from "@/lib/opsAlerts";
import type { Workspace } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AgingRequest = {
    workspaceId?: string;
    dryRun?: boolean;
    limit?: number;
};

type BehavioralRolloutMode = "off" | "dev_admin" | "all";

function getBehavioralRolloutMode(): BehavioralRolloutMode {
    const raw = (process.env.BEHAVIORAL_CITY_ROLLOUT || "dev_admin").trim().toLowerCase();
    if (raw === "all") return "all";
    if (raw === "off") return "off";
    return "dev_admin";
}

function parseBoolean(value: string | null | undefined) {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseLimit(value: unknown, fallback = 200) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.min(1000, Math.max(1, Math.floor(value)));
    }

    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return Math.min(1000, Math.max(1, Math.floor(parsed)));
        }
    }

    return fallback;
}

function getBearerToken(request: NextRequest) {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) return "";
    return authorization.slice(7).trim();
}

function hasCronSecretAuth(request: NextRequest) {
    const token = getBearerToken(request);
    const headerSecret = request.headers.get("x-cron-secret") || "";
    const secrets = [
        process.env.BEHAVIORAL_CRON_SECRET,
        process.env.CRON_SECRET,
    ]
        .map((value) => (value || "").trim())
        .filter(Boolean);

    if (!secrets.length) return false;
    return secrets.includes(token) || secrets.includes(headerSecret);
}

function summarizeStateChange(before: Workspace["behavioralMetrics"], after: Workspace["behavioralMetrics"]) {
    return {
        before: {
            consistencyIndex: before?.consistencyIndex || 0,
            inactiveDays: before?.inactiveDays || 0,
            cityEnergyState: before?.cityEnergyState || "energized",
            sharedConsistencyState: before?.sharedConsistencyState || "energized",
        },
        after: {
            consistencyIndex: after?.consistencyIndex || 0,
            inactiveDays: after?.inactiveDays || 0,
            cityEnergyState: after?.cityEnergyState || "energized",
            sharedConsistencyState: after?.sharedConsistencyState || "energized",
        },
    };
}

async function ensureAuthorized(request: NextRequest) {
    if (hasCronSecretAuth(request)) {
        return;
    }

    const decodedUser = await requireUserFromRequest(request);
    const allowlist = getServerDevAdminAllowlist();

    if (!hasConfiguredDevAdminAllowlist(allowlist)) {
        throw new Error("DEV_ADMIN_ALLOWLIST_NOT_CONFIGURED");
    }

    const hasAccess = hasDevAdminAccess({
        uid: decodedUser.uid,
        email: decodedUser.email || null,
        allowlist,
    });

    if (!hasAccess) {
        throw new Error("FORBIDDEN");
    }
}

function mapAuthError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    if (normalized.includes("forbidden")) {
        return { status: 403, error: "Acesso negado." };
    }
    if (normalized.includes("missing bearer token")) {
        return { status: 401, error: "Sessão inválida." };
    }
    if (normalized.includes("dev_admin_allowlist_not_configured")) {
        return { status: 503, error: "Configure DEV_ADMIN_EMAILS/DEV_ADMIN_UIDS no servidor." };
    }
    return { status: 500, error: "Erro ao aplicar aging comportamental." };
}

async function handleAging(request: NextRequest) {
    const body = request.method === "POST"
        ? ((await request.json().catch(() => ({}))) as AgingRequest)
        : ({} as AgingRequest);
    const query = request.nextUrl.searchParams;

    const workspaceId = (body.workspaceId || query.get("workspaceId") || "").trim();
    const dryRun = Boolean(body.dryRun) || parseBoolean(query.get("dryRun"));
    const limit = parseLimit(body.limit ?? query.get("limit"), 200);
    const now = Date.now();
    const rolloutMode = getBehavioralRolloutMode();

    if (rolloutMode === "off") {
        return NextResponse.json({
            ok: true,
            dryRun,
            generatedAt: now,
            processed: 0,
            changed: 0,
            ignored: true,
            reason: "rollout_disabled",
            workspaces: [],
        }, { status: 202 });
    }

    const db = getAdminDb();
    let workspaceDocs: Array<{ id: string; data: Omit<Workspace, "id"> }> = [];

    if (workspaceId) {
        const snap = await db.collection("workspaces").doc(workspaceId).get();
        if (!snap.exists) {
            return NextResponse.json({ error: "Workspace não encontrado." }, { status: 404 });
        }
        workspaceDocs = [{ id: snap.id, data: snap.data() as Omit<Workspace, "id"> }];
    } else {
        const snap = await db.collection("workspaces").limit(limit).get();
        workspaceDocs = snap.docs.map((workspaceDoc) => ({
            id: workspaceDoc.id,
            data: workspaceDoc.data() as Omit<Workspace, "id">,
        }));
    }

    if (rolloutMode === "dev_admin") {
        const allowlist = getServerDevAdminAllowlist();
        workspaceDocs = workspaceDocs.filter((workspaceDoc) => {
            return hasDevAdminAccess({
                uid: workspaceDoc.data.ownerId || null,
                email: workspaceDoc.data.ownerEmail || null,
                allowlist,
            });
        });
    }

    const changed: Array<{
        workspaceId: string;
        workspaceName: string;
        delta: ReturnType<typeof summarizeStateChange>;
    }> = [];
    let processed = 0;

    for (const workspaceDoc of workspaceDocs) {
        processed += 1;
        const members = Array.isArray(workspaceDoc.data.members) ? workspaceDoc.data.members : [];
        const before = normalizeBehavioralMetrics(workspaceDoc.data.behavioralMetrics, {
            now,
            members,
        });
        const after = applyBehavioralAging({
            current: before,
            members,
            now,
        });

        const hasChanged =
            before.consistencyIndex !== after.consistencyIndex
            || before.inactiveDays !== after.inactiveDays
            || before.cityEnergyState !== after.cityEnergyState
            || before.sharedConsistencyState !== after.sharedConsistencyState
            || before.sharedConsistencyIndex !== after.sharedConsistencyIndex;

        if (!hasChanged) continue;

        if (!dryRun) {
            await db.collection("workspaces").doc(workspaceDoc.id).set(
                {
                    behavioralMetrics: after,
                },
                { merge: true }
            );
        }

        changed.push({
            workspaceId: workspaceDoc.id,
            workspaceName: workspaceDoc.data.name || "Workspace sem nome",
            delta: summarizeStateChange(before, after),
        });
    }

    return NextResponse.json({
        ok: true,
        dryRun,
        generatedAt: now,
        processed,
        changed: changed.length,
        workspaces: changed,
    });
}

export async function GET(request: NextRequest) {
    try {
        await ensureAuthorized(request);
        return await handleAging(request);
    } catch (error) {
        console.error("behavioral daily-aging error:", error);
        await sendOpsAlert({
            source: "api/behavioral/daily-aging",
            message: "Unhandled exception while running daily behavioral aging.",
            level: "error",
            context: {
                error: serializeError(error),
            },
        });
        const mapped = mapAuthError(error);
        return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }
}

export async function POST(request: NextRequest) {
    try {
        await ensureAuthorized(request);
        return await handleAging(request);
    } catch (error) {
        console.error("behavioral daily-aging error:", error);
        await sendOpsAlert({
            source: "api/behavioral/daily-aging",
            message: "Unhandled exception while running daily behavioral aging.",
            level: "error",
            context: {
                error: serializeError(error),
            },
        });
        const mapped = mapAuthError(error);
        return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }
}
