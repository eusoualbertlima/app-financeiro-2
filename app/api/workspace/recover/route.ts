import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUserFromRequest } from "@/lib/serverAuth";
import { getDefaultTrialEndsAt } from "@/lib/billing";
import type { Workspace } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RecoverRequestBody = {
    createIfMissing?: boolean;
};

type WorkspaceRecord = Omit<Workspace, "id">;

function normalizeEmail(email: string | null | undefined) {
    return (email || "").trim().toLowerCase();
}

function unique(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)));
}

function toWorkspaceRecord(raw: Partial<WorkspaceRecord> | undefined, uid: string): WorkspaceRecord {
    const createdAt = typeof raw?.createdAt === "number" ? raw.createdAt : Date.now();
    const billing = raw?.billing || {
        status: "trialing" as const,
        trialEndsAt: getDefaultTrialEndsAt(createdAt),
        updatedAt: Date.now(),
    };

    return {
        name: typeof raw?.name === "string" && raw.name.trim() ? raw.name : "Minhas Finanças",
        members: Array.isArray(raw?.members) ? raw.members.filter(Boolean) : [uid],
        ownerId: typeof raw?.ownerId === "string" && raw.ownerId ? raw.ownerId : uid,
        createdAt,
        pendingInvites: Array.isArray(raw?.pendingInvites) ? raw.pendingInvites : [],
        billing,
        legal: raw?.legal,
    };
}

function pickPreferredWorkspace(
    candidates: Array<{ id: string; data: WorkspaceRecord }>,
    uid: string,
    normalizedEmail: string
) {
    if (candidates.length === 0) return null;

    const ranked = [...candidates].sort((a, b) => {
        const aMembers = Array.isArray(a.data.members) ? a.data.members : [];
        const bMembers = Array.isArray(b.data.members) ? b.data.members : [];

        const aIsMember = aMembers.includes(uid) ? 1 : 0;
        const bIsMember = bMembers.includes(uid) ? 1 : 0;
        if (aIsMember !== bIsMember) return bIsMember - aIsMember;

        const aIsOwner = a.data.ownerId === uid ? 1 : 0;
        const bIsOwner = b.data.ownerId === uid ? 1 : 0;
        if (aIsOwner !== bIsOwner) return bIsOwner - aIsOwner;

        const aInvite = normalizedEmail && (a.data.pendingInvites || []).map(normalizeEmail).includes(normalizedEmail) ? 1 : 0;
        const bInvite = normalizedEmail && (b.data.pendingInvites || []).map(normalizeEmail).includes(normalizedEmail) ? 1 : 0;
        if (aInvite !== bInvite) return bInvite - aInvite;

        if (aMembers.length !== bMembers.length) return bMembers.length - aMembers.length;

        return a.data.createdAt - b.data.createdAt;
    });

    return ranked[0];
}

export async function POST(request: NextRequest) {
    try {
        const decoded = await requireUserFromRequest(request);
        const uid = decoded.uid;
        const normalizedEmail = normalizeEmail(decoded.email || null);

        let body: RecoverRequestBody = {};
        try {
            body = (await request.json()) as RecoverRequestBody;
        } catch {
            body = {};
        }
        const createIfMissing = body.createIfMissing !== false;

        const db = getAdminDb();
        const workspacesRef = db.collection("workspaces");

        const lookupPromises: Array<Promise<FirebaseFirestore.QuerySnapshot>> = [
            workspacesRef.where("members", "array-contains", uid).limit(50).get(),
            workspacesRef.where("ownerId", "==", uid).limit(50).get(),
        ];

        if (normalizedEmail) {
            lookupPromises.push(workspacesRef.where("pendingInvites", "array-contains", normalizedEmail).limit(50).get());
        }

        const lookupSnapshots = await Promise.all(lookupPromises);
        const byId = new Map<string, WorkspaceRecord>();

        for (const snapshot of lookupSnapshots) {
            snapshot.docs.forEach((docSnap) => {
                byId.set(docSnap.id, toWorkspaceRecord(docSnap.data() as Partial<WorkspaceRecord>, uid));
            });
        }

        let selected = pickPreferredWorkspace(
            Array.from(byId.entries()).map(([id, data]) => ({ id, data })),
            uid,
            normalizedEmail
        );
        let created = false;

        if (!selected && createIfMissing) {
            const createdAt = Date.now();
            const workspace: WorkspaceRecord = {
                name: "Minhas Finanças",
                members: [uid],
                ownerId: uid,
                createdAt,
                billing: {
                    status: "trialing",
                    trialEndsAt: getDefaultTrialEndsAt(createdAt),
                    updatedAt: Date.now(),
                },
                pendingInvites: [],
            };
            const docRef = await workspacesRef.add(workspace);
            selected = { id: docRef.id, data: workspace };
            created = true;
        }

        if (!selected) {
            return NextResponse.json({
                workspace: null,
                recovered: false,
                reason: "not_found",
            });
        }

        const currentMembers = Array.isArray(selected.data.members) ? selected.data.members : [];
        const nextMembers = unique([...currentMembers, uid]);

        const currentPendingInvites = Array.isArray(selected.data.pendingInvites) ? selected.data.pendingInvites : [];
        const nextPendingInvites = normalizedEmail
            ? currentPendingInvites.filter((inviteEmail) => normalizeEmail(inviteEmail) !== normalizedEmail)
            : currentPendingInvites;

        const patch: Partial<WorkspaceRecord> = {};
        if (nextMembers.length !== currentMembers.length) {
            patch.members = nextMembers;
        }
        if (nextPendingInvites.length !== currentPendingInvites.length) {
            patch.pendingInvites = nextPendingInvites;
        }

        if (Object.keys(patch).length > 0) {
            await workspacesRef.doc(selected.id).set(patch, { merge: true });
        }

        const workspace: Workspace = {
            id: selected.id,
            ...selected.data,
            members: nextMembers,
            pendingInvites: nextPendingInvites,
        };

        return NextResponse.json({
            workspace,
            recovered: true,
            created,
        });
    } catch (error) {
        console.error("workspace recover error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        const status = message.toLowerCase().includes("missing bearer token") ? 401 : 500;
        return NextResponse.json(
            {
                error: "Não foi possível recuperar o workspace.",
                details: message,
            },
            { status }
        );
    }
}
