import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUserFromRequest } from "@/lib/serverAuth";
import {
    getServerDevAdminAllowlist,
    hasConfiguredDevAdminAllowlist,
    hasDevAdminAccess,
} from "@/lib/devAdmin";
import type { Workspace } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AccessAction = "removeMember" | "addPendingInvite" | "removePendingInvite";

type AccessBody = {
    action?: AccessAction;
    workspaceId?: string;
    uid?: string;
    email?: string;
};

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
    try {
        const decodedUser = await requireUserFromRequest(request);
        const allowlist = getServerDevAdminAllowlist();

        if (!hasConfiguredDevAdminAllowlist(allowlist)) {
            return NextResponse.json(
                { error: "Configure DEV_ADMIN_EMAILS ou DEV_ADMIN_UIDS no ambiente do servidor." },
                { status: 503 }
            );
        }

        const hasAccess = hasDevAdminAccess({
            uid: decodedUser.uid,
            email: decodedUser.email || null,
            allowlist,
        });

        if (!hasAccess) {
            return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }

        const body = (await request.json()) as AccessBody;
        const action = body.action;
        const workspaceId = body.workspaceId?.trim();

        if (!action || !workspaceId) {
            return NextResponse.json(
                { error: "Campos obrigatórios: action e workspaceId." },
                { status: 400 }
            );
        }

        const db = getAdminDb();
        const workspaceRef = db.collection("workspaces").doc(workspaceId);
        const workspaceSnap = await workspaceRef.get();

        if (!workspaceSnap.exists) {
            return NextResponse.json({ error: "Workspace não encontrado." }, { status: 404 });
        }

        const workspaceData = workspaceSnap.data() as Omit<Workspace, "id">;
        const members = Array.isArray(workspaceData.members) ? workspaceData.members : [];
        const pendingInvites = Array.isArray(workspaceData.pendingInvites) ? workspaceData.pendingInvites : [];

        if (action === "removeMember") {
            const targetUid = body.uid?.trim();
            if (!targetUid) {
                return NextResponse.json({ error: "uid é obrigatório para removeMember." }, { status: 400 });
            }

            if (targetUid === workspaceData.ownerId) {
                return NextResponse.json(
                    { error: "Não é possível remover o dono do workspace." },
                    { status: 400 }
                );
            }

            const nextMembers = members.filter((memberUid) => memberUid !== targetUid);
            await workspaceRef.set({ members: nextMembers }, { merge: true });

            return NextResponse.json({
                ok: true,
                message: "Membro removido com sucesso.",
                workspaceId,
                membersCount: nextMembers.length,
            });
        }

        if (action === "addPendingInvite") {
            const rawEmail = body.email?.trim();
            if (!rawEmail) {
                return NextResponse.json({ error: "email é obrigatório para addPendingInvite." }, { status: 400 });
            }

            const email = normalizeEmail(rawEmail);
            if (!isValidEmail(email)) {
                return NextResponse.json({ error: "Email inválido." }, { status: 400 });
            }

            const nextPendingInvites = Array.from(
                new Set([...pendingInvites.map((invite) => normalizeEmail(invite)), email])
            );

            await workspaceRef.set({ pendingInvites: nextPendingInvites }, { merge: true });

            return NextResponse.json({
                ok: true,
                message: "Convite pendente adicionado.",
                workspaceId,
                pendingInvitesCount: nextPendingInvites.length,
            });
        }

        if (action === "removePendingInvite") {
            const rawEmail = body.email?.trim();
            if (!rawEmail) {
                return NextResponse.json(
                    { error: "email é obrigatório para removePendingInvite." },
                    { status: 400 }
                );
            }

            const email = normalizeEmail(rawEmail);
            const nextPendingInvites = pendingInvites.filter(
                (invite) => normalizeEmail(invite) !== email
            );

            await workspaceRef.set({ pendingInvites: nextPendingInvites }, { merge: true });

            return NextResponse.json({
                ok: true,
                message: "Convite pendente removido.",
                workspaceId,
                pendingInvitesCount: nextPendingInvites.length,
            });
        }

        return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    } catch (error) {
        console.error("admin clients access error:", error);
        return NextResponse.json(
            { error: "Erro ao atualizar acesso do cliente." },
            { status: 500 }
        );
    }
}
