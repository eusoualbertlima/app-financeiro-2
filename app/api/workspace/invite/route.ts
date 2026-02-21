import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { requireUserFromRequest } from "@/lib/serverAuth";
import type { Workspace } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InviteRequestBody = {
    workspaceId?: string;
    email?: string;
};

function normalizeEmail(email: string | null | undefined) {
    return (email || "").trim().toLowerCase();
}

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
        error: "Erro ao autorizar email no workspace.",
        details: rawMessage,
    };
}

export async function POST(request: NextRequest) {
    try {
        const decodedUser = await requireUserFromRequest(request);
        const body = (await request.json()) as InviteRequestBody;

        const workspaceId = body.workspaceId?.trim();
        const normalizedEmail = normalizeEmail(body.email);

        if (!workspaceId || !normalizedEmail) {
            return NextResponse.json(
                { error: "Campos obrigatorios: workspaceId e email." },
                { status: 400 }
            );
        }

        if (!isValidEmail(normalizedEmail)) {
            return NextResponse.json({ error: "Email invalido." }, { status: 400 });
        }

        const db = getAdminDb();
        const workspaceRef = db.collection("workspaces").doc(workspaceId);
        const workspaceSnap = await workspaceRef.get();

        if (!workspaceSnap.exists) {
            return NextResponse.json({ error: "Workspace nao encontrado." }, { status: 404 });
        }

        const workspaceData = workspaceSnap.data() as Omit<Workspace, "id">;
        const currentMembers = Array.isArray(workspaceData.members) ? workspaceData.members : [];
        const pendingInvites = Array.isArray(workspaceData.pendingInvites) ? workspaceData.pendingInvites : [];
        const ownerId = workspaceData.ownerId || "";
        const ownerEmail = normalizeEmail(workspaceData.ownerEmail);

        if (ownerId !== decodedUser.uid) {
            return NextResponse.json(
                { error: "Somente o dono do workspace pode autorizar membros." },
                { status: 403 }
            );
        }

        if (normalizeEmail(decodedUser.email) === normalizedEmail) {
            return NextResponse.json(
                { error: "Voce ja faz parte deste workspace." },
                { status: 400 }
            );
        }

        if (ownerEmail === normalizedEmail) {
            return NextResponse.json({
                ok: true,
                inviteAdded: false,
                message: "Esta pessoa ja faz parte deste workspace.",
                code: "already_in_current_workspace",
            });
        }

        const normalizedPendingInvites = pendingInvites.map((inviteEmail) => normalizeEmail(inviteEmail));
        if (normalizedPendingInvites.includes(normalizedEmail)) {
            return NextResponse.json({
                ok: true,
                inviteAdded: false,
                message: "Este email ja esta autorizado neste workspace.",
                code: "already_pending_in_current_workspace",
            });
        }

        let invitedUid = "";
        try {
            const authRecord = await getAdminAuth().getUserByEmail(normalizedEmail);
            invitedUid = authRecord.uid;
        } catch {
            invitedUid = "";
        }

        if (invitedUid && currentMembers.includes(invitedUid)) {
            return NextResponse.json({
                ok: true,
                inviteAdded: false,
                message: "Esta pessoa ja faz parte deste workspace.",
                code: "already_in_current_workspace",
            });
        }

        const workspaceCandidates = new Set<string>();

        const ownerWorkspaceSnapshot = await db
            .collection("workspaces")
            .where("ownerEmail", "==", normalizedEmail)
            .limit(20)
            .get();
        ownerWorkspaceSnapshot.docs.forEach((docSnap) => workspaceCandidates.add(docSnap.id));

        if (invitedUid) {
            const memberWorkspaceSnapshot = await db
                .collection("workspaces")
                .where("members", "array-contains", invitedUid)
                .limit(20)
                .get();
            memberWorkspaceSnapshot.docs.forEach((docSnap) => workspaceCandidates.add(docSnap.id));
        } else {
            const userSnapshot = await db
                .collection("users")
                .where("email", "==", normalizedEmail)
                .limit(1)
                .get();

            if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                const userData = userDoc.data() as { uid?: unknown };
                const fallbackUid = typeof userData.uid === "string" && userData.uid ? userData.uid : userDoc.id;
                if (fallbackUid) {
                    const memberWorkspaceSnapshot = await db
                        .collection("workspaces")
                        .where("members", "array-contains", fallbackUid)
                        .limit(20)
                        .get();
                    memberWorkspaceSnapshot.docs.forEach((docSnap) => workspaceCandidates.add(docSnap.id));
                }
            }
        }

        const hasOtherWorkspace = Array.from(workspaceCandidates).some((candidateId) => candidateId !== workspaceId);
        if (hasOtherWorkspace) {
            return NextResponse.json(
                {
                    error: "Esta pessoa ja esta em um workspace.",
                    code: "already_has_workspace",
                },
                { status: 409 }
            );
        }

        await workspaceRef.set(
            {
                pendingInvites: FieldValue.arrayUnion(normalizedEmail),
            },
            { merge: true }
        );

        return NextResponse.json({
            ok: true,
            inviteAdded: true,
            message: `Email ${normalizedEmail} autorizado com sucesso.`,
            code: "invite_added",
        });
    } catch (error) {
        console.error("workspace invite error:", error);
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
