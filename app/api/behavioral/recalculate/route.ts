import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUserFromRequest } from "@/lib/serverAuth";
import { applyBehavioralAction } from "@/lib/behavioralMetrics";
import { getServerDevAdminAllowlist, hasDevAdminAccess } from "@/lib/devAdmin";
import { getServerBehavioralRolloutMode, hasBehavioralRolloutAccess } from "@/lib/behavioralRollout";
import { sendOpsAlert, serializeError } from "@/lib/opsAlerts";
import type { Workspace } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RecalculateBody = {
    workspaceId?: string;
    actionAt?: number;
    source?: string;
};

function normalizeTimestamp(value: unknown) {
    if (typeof value !== "number" || !Number.isFinite(value)) return Date.now();
    if (value <= 0) return Date.now();
    return value;
}

function mapApiError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    if (normalized.includes("missing bearer token")) {
        return { status: 401, error: "Sessão inválida. Faça login novamente." };
    }

    if (
        normalized.includes("id token")
        || normalized.includes("verifyidtoken")
        || normalized.includes("token has expired")
    ) {
        return { status: 401, error: "Token inválido ou expirado." };
    }

    return { status: 500, error: "Erro ao recalcular métricas comportamentais." };
}

export async function POST(request: NextRequest) {
    let alertContext: Record<string, unknown> = {};

    try {
        const decoded = await requireUserFromRequest(request);
        const uid = decoded.uid;
        const rolloutMode = getServerBehavioralRolloutMode();
        const body = (await request.json().catch(() => ({}))) as RecalculateBody;
        const workspaceId = body.workspaceId?.trim();

        alertContext = {
            uid,
            workspaceId: workspaceId || "missing",
            source: body.source || "unspecified",
            rolloutMode,
        };

        if (rolloutMode === "off") {
            return NextResponse.json({
                ok: true,
                ignored: true,
                reason: "rollout_disabled",
            }, { status: 202 });
        }

        if (rolloutMode === "dev_admin") {
            const allowlist = getServerDevAdminAllowlist();
            const isDeveloperAdmin = hasDevAdminAccess({
                uid,
                email: decoded.email || null,
                allowlist,
            });
            const hasRolloutAccess = hasBehavioralRolloutAccess({
                mode: rolloutMode,
                isDeveloperAdmin,
            });
            if (!hasRolloutAccess) {
                return NextResponse.json({
                    ok: true,
                    ignored: true,
                    reason: "rollout_dev_only",
                }, { status: 202 });
            }
        }

        if (!workspaceId) {
            return NextResponse.json({ error: "workspaceId é obrigatório." }, { status: 400 });
        }

        const db = getAdminDb();
        const workspaceRef = db.collection("workspaces").doc(workspaceId);
        const workspaceSnap = await workspaceRef.get();

        if (!workspaceSnap.exists) {
            return NextResponse.json({ error: "Workspace não encontrado." }, { status: 404 });
        }

        const workspace = workspaceSnap.data() as Omit<Workspace, "id">;
        const members = Array.isArray(workspace.members) ? workspace.members.filter(Boolean) : [];
        if (!members.includes(uid)) {
            return NextResponse.json({ error: "Acesso negado ao workspace." }, { status: 403 });
        }

        const nextMetrics = applyBehavioralAction({
            current: workspace.behavioralMetrics,
            actorUid: uid,
            actionAt: normalizeTimestamp(body.actionAt),
            members,
        });

        await workspaceRef.set(
            {
                behavioralMetrics: nextMetrics,
            },
            { merge: true }
        );

        return NextResponse.json({
            ok: true,
            behavioralMetrics: nextMetrics,
        });
    } catch (error) {
        console.error("behavioral recalculate error:", error);
        await sendOpsAlert({
            source: "api/behavioral/recalculate",
            message: "Unhandled exception while recalculating behavioral metrics.",
            level: "error",
            workspaceId: typeof alertContext.workspaceId === "string" ? alertContext.workspaceId : undefined,
            context: {
                ...alertContext,
                error: serializeError(error),
            },
        });
        const mapped = mapApiError(error);
        return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }
}
