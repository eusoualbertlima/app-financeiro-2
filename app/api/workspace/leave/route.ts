import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUserFromRequest } from "@/lib/serverAuth";
import type { Workspace } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LeaveRequestBody = {
    workspaceId?: string;
};

function normalizeEmail(email: string | null | undefined) {
    return (email || "").trim().toLowerCase();
}

function normalizeErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
}

function mapError(error: unknown) {
    const rawMessage = normalizeErrorMessage(error);
    const message = rawMessage.toLowerCase();

    if (message.includes("missing bearer token")) {
        return { status: 401, error: "Sessao invalida. Faca login novamente." };
    }
    if (
        message.includes("verifyidtoken")
        || message.includes("id token")
        || message.includes("token has expired")
    ) {
        return { status: 401, error: "Token invalido ou expirado. Faca login novamente." };
    }
    if (
        message.includes("default credentials")
        || message.includes("service account")
        || message.includes("private key")
        || message.includes("certificate")
        || message.includes("missing firebase admin env")
    ) {
        return {
            status: 500,
            error: "Firebase Admin nao configurado no servidor.",
        };
    }

    return {
        status: 500,
        error: "Erro ao sair do workspace.",
        details: rawMessage,
    };
}

export async function POST(request: NextRequest) {
    try {
        const decodedUser = await requireUserFromRequest(request);
        const body = (await request.json()) as LeaveRequestBody;
        const workspaceId = body.workspaceId?.trim();

        if (!workspaceId) {
            return NextResponse.json({ error: "workspaceId e obrigatorio." }, { status: 400 });
        }

        const db = getAdminDb();
        const workspaceRef = db.collection("workspaces").doc(workspaceId);
        const workspaceSnap = await workspaceRef.get();

        if (!workspaceSnap.exists) {
            return NextResponse.json({ error: "Workspace nao encontrado." }, { status: 404 });
        }

        const workspaceData = workspaceSnap.data() as Omit<Workspace, "id">;
        const ownerId = workspaceData.ownerId || "";
        const members = Array.isArray(workspaceData.members) ? workspaceData.members : [];

        if (ownerId === decodedUser.uid) {
            return NextResponse.json(
                { error: "O dono do workspace nao pode sair dele." },
                { status: 400 }
            );
        }

        if (!members.includes(decodedUser.uid)) {
            return NextResponse.json({
                ok: true,
                message: "Voce ja nao faz parte deste workspace.",
                code: "already_outside_workspace",
            });
        }

        const nextMembers = members.filter((memberUid) => memberUid !== decodedUser.uid);
        const patch: Record<string, unknown> = { members: nextMembers };
        const normalizedUserEmail = normalizeEmail(decodedUser.email || null);
        const pendingInvites = Array.isArray(workspaceData.pendingInvites) ? workspaceData.pendingInvites : [];
        if (normalizedUserEmail && pendingInvites.some((invite) => normalizeEmail(invite) === normalizedUserEmail)) {
            patch.pendingInvites = pendingInvites.filter(
                (invite) => normalizeEmail(invite) !== normalizedUserEmail
            );
        }

        await workspaceRef.set(patch, { merge: true });

        await db.collection("users").doc(decodedUser.uid).set(
            {
                primaryWorkspaceId: FieldValue.delete(),
                updatedAt: Date.now(),
            },
            { merge: true }
        );

        return NextResponse.json({
            ok: true,
            message: "Voce saiu do workspace com sucesso.",
            code: "left_workspace",
        });
    } catch (error) {
        console.error("workspace leave error:", error);
        const mapped = mapError(error);
        return NextResponse.json(
            {
                error: mapped.error,
                ...(mapped.details ? { details: mapped.details } : {}),
            },
            { status: mapped.status }
        );
    }
}
