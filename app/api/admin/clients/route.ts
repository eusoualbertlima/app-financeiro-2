import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { requireUserFromRequest } from "@/lib/serverAuth";
import {
    getServerDevAdminAllowlist,
    hasConfiguredDevAdminAllowlist,
    hasDevAdminAccess,
} from "@/lib/devAdmin";
import { normalizeWorkspaceBilling } from "@/lib/billing";
import type { UserRecord } from "firebase-admin/auth";
import type { UserProfile, Workspace } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UserSummary = {
    uid: string;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    createdAt: number | null;
    authCreatedAt: number | null;
    lastSignInAt: number | null;
    lastSeenAt: number | null;
    profileUpdatedAt: number | null;
    lastActivityAt: number | null;
    emailVerified: boolean | null;
    disabled: boolean | null;
    providerIds: string[];
    subscriptionStatus: UserProfile["subscriptionStatus"] | null;
    subscriptionPlan: UserProfile["subscriptionPlan"] | null;
    hasProfileDoc: boolean;
    hasAuthRecord: boolean;
};

type ClientWorkspaceSummary = {
    workspaceId: string;
    name: string;
    createdAt: number | null;
    ownerId: string;
    owner: UserSummary | null;
    members: UserSummary[];
    pendingInvites: string[];
    billing: {
        status: Workspace["billing"] extends infer T ? T extends { status?: infer S } ? S : null : null;
        plan: Workspace["billing"] extends infer T ? T extends { plan?: infer S } ? S : null : null;
        trialEndsAt: number | null;
        currentPeriodEnd: number | null;
        cancelAtPeriodEnd: boolean | null;
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
        updatedAt: number | null;
    };
    legal: {
        acceptedTermsAt: number | null;
        acceptedPrivacyAt: number | null;
        acceptedByUid: string | null;
        acceptedByEmail: string | null;
        acceptedByUser: UserSummary | null;
    };
};

type WorkspaceRecord = Omit<Workspace, "id">;

function normalizeErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
}

function mapAdminError(error: unknown) {
    const rawMessage = normalizeErrorMessage(error);
    const message = rawMessage.toLowerCase();

    if (message.includes("missing bearer token")) {
        return { status: 401, error: "Sessao invalida. Faça login novamente." };
    }

    if (
        message.includes("verifyidtoken")
        || message.includes("id token")
        || message.includes("token has expired")
    ) {
        return { status: 401, error: "Token invalido ou expirado. Faça login novamente." };
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
            error: "Firebase Admin não configurado no servidor. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no Vercel.",
        };
    }

    if (message.includes("permission") || message.includes("insufficient")) {
        return {
            status: 500,
            error: "Sem permissão para ler usuários no Firebase Auth. Verifique permissões da service account.",
            details: rawMessage,
        };
    }

    return {
        status: 500,
        error: "Erro ao carregar dados administrativos.",
        details: rawMessage,
    };
}

function toNumberOrNull(value: unknown): number | null {
    return typeof value === "number" ? value : null;
}

function toStringOrNull(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function toBooleanOrNull(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
}

function toTimestampOrNull(value: unknown): number | null {
    if (typeof value !== "string") return null;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
}

function toUserSummary(
    uid: string,
    profile: Partial<UserProfile> | undefined,
    authRecord: UserRecord | undefined
): UserSummary {
    const profileCreatedAt = toNumberOrNull(profile?.createdAt);
    const authCreatedAt = toTimestampOrNull(authRecord?.metadata.creationTime);
    const profileUpdatedAt = toNumberOrNull(profile?.updatedAt);
    const lastSeenAt = toNumberOrNull(profile?.lastSeenAt);
    const lastSignInAt = toTimestampOrNull(authRecord?.metadata.lastSignInTime);
    const lastActivityAt = [lastSeenAt, profileUpdatedAt, lastSignInAt]
        .filter((value): value is number => typeof value === "number")
        .sort((a, b) => b - a)[0] || null;

    return {
        uid,
        displayName: toStringOrNull(profile?.displayName) || toStringOrNull(authRecord?.displayName),
        email: toStringOrNull(profile?.email) || toStringOrNull(authRecord?.email),
        phoneNumber: toStringOrNull(authRecord?.phoneNumber),
        createdAt: profileCreatedAt || authCreatedAt,
        authCreatedAt,
        lastSignInAt,
        lastSeenAt,
        profileUpdatedAt,
        lastActivityAt,
        emailVerified: toBooleanOrNull(authRecord?.emailVerified),
        disabled: toBooleanOrNull(authRecord?.disabled),
        providerIds: (authRecord?.providerData || []).map((item) => item.providerId).filter(Boolean),
        subscriptionStatus: (profile?.subscriptionStatus || null) as UserSummary["subscriptionStatus"],
        subscriptionPlan: (profile?.subscriptionPlan || null) as UserSummary["subscriptionPlan"],
        hasProfileDoc: Boolean(profile),
        hasAuthRecord: Boolean(authRecord),
    };
}

function unique(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)));
}

function chunkArray<T>(input: T[], size: number) {
    const chunks: T[][] = [];
    for (let i = 0; i < input.length; i += size) {
        chunks.push(input.slice(i, i + size));
    }
    return chunks;
}

export async function GET(request: NextRequest) {
    try {
        const decodedUser = await requireUserFromRequest(request);
        const allowlist = getServerDevAdminAllowlist();

        if (!hasConfiguredDevAdminAllowlist(allowlist)) {
            return NextResponse.json(
                {
                    error: "Configure DEV_ADMIN_EMAILS ou DEV_ADMIN_UIDS no ambiente do servidor.",
                },
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

        const db = getAdminDb();
        const workspacesSnapshot = await db
            .collection("workspaces")
            .orderBy("createdAt", "desc")
            .limit(500)
            .get();

        const workspaceDocs = workspacesSnapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as WorkspaceRecord),
        }));

        const allUserIds = unique(
            workspaceDocs.flatMap((workspaceDoc) => {
                const ownerId = workspaceDoc.ownerId ? [workspaceDoc.ownerId] : [];
                const members = Array.isArray(workspaceDoc.members) ? workspaceDoc.members : [];
                const acceptedByUid = workspaceDoc.legal?.acceptedByUid ? [workspaceDoc.legal.acceptedByUid] : [];
                return [...ownerId, ...members, ...acceptedByUid];
            })
        );

        const userMap = new Map<string, Partial<UserProfile>>();
        if (allUserIds.length > 0) {
            const refs = allUserIds.map((uid) => db.collection("users").doc(uid));
            const userSnaps = await db.getAll(...refs);
            userSnaps.forEach((userSnap) => {
                if (userSnap.exists) {
                    userMap.set(userSnap.id, userSnap.data() as Partial<UserProfile>);
                }
            });
        }

        const authUserMap = new Map<string, UserRecord>();
        if (allUserIds.length > 0) {
            const adminAuth = getAdminAuth();
            const userIdChunks = chunkArray(allUserIds, 100);
            for (const chunk of userIdChunks) {
                const authLookup = await adminAuth.getUsers(chunk.map((uid) => ({ uid })));
                authLookup.users.forEach((record) => {
                    authUserMap.set(record.uid, record);
                });
            }
        }

        const clients: ClientWorkspaceSummary[] = workspaceDocs.map((workspaceDoc) => {
            const normalizedBilling = normalizeWorkspaceBilling({
                id: workspaceDoc.id,
                ...(workspaceDoc as Omit<Workspace, "id">),
            } as Workspace);

            const members = unique(Array.isArray(workspaceDoc.members) ? workspaceDoc.members : []).map((uid) =>
                toUserSummary(uid, userMap.get(uid), authUserMap.get(uid))
            );

            const owner = workspaceDoc.ownerId
                ? toUserSummary(
                    workspaceDoc.ownerId,
                    userMap.get(workspaceDoc.ownerId),
                    authUserMap.get(workspaceDoc.ownerId)
                )
                : null;

            const acceptedByUid = toStringOrNull(workspaceDoc.legal?.acceptedByUid);
            const acceptedByUser = acceptedByUid
                ? toUserSummary(acceptedByUid, userMap.get(acceptedByUid), authUserMap.get(acceptedByUid))
                : null;

            return {
                workspaceId: workspaceDoc.id,
                name: toStringOrNull(workspaceDoc.name) || "Workspace sem nome",
                createdAt: toNumberOrNull(workspaceDoc.createdAt),
                ownerId: toStringOrNull(workspaceDoc.ownerId) || "",
                owner,
                members,
                pendingInvites: Array.isArray(workspaceDoc.pendingInvites) ? workspaceDoc.pendingInvites : [],
                billing: {
                    status: (normalizedBilling.status || null) as ClientWorkspaceSummary["billing"]["status"],
                    plan: (normalizedBilling.plan || null) as ClientWorkspaceSummary["billing"]["plan"],
                    trialEndsAt: toNumberOrNull(normalizedBilling.trialEndsAt),
                    currentPeriodEnd: toNumberOrNull(normalizedBilling.currentPeriodEnd),
                    cancelAtPeriodEnd: toBooleanOrNull(normalizedBilling.cancelAtPeriodEnd),
                    stripeCustomerId: toStringOrNull(normalizedBilling.stripeCustomerId),
                    stripeSubscriptionId: toStringOrNull(normalizedBilling.stripeSubscriptionId),
                    updatedAt: toNumberOrNull(normalizedBilling.updatedAt),
                },
                legal: {
                    acceptedTermsAt: toNumberOrNull(workspaceDoc.legal?.acceptedTermsAt),
                    acceptedPrivacyAt: toNumberOrNull(workspaceDoc.legal?.acceptedPrivacyAt),
                    acceptedByUid,
                    acceptedByEmail: toStringOrNull(workspaceDoc.legal?.acceptedByEmail),
                    acceptedByUser,
                },
            };
        });

        const uniqueMembersCount = new Set(
            clients.flatMap((workspace) => workspace.members.map((member) => member.uid))
        ).size;

        const statusBreakdown = clients.reduce<Record<string, number>>((acc, workspace) => {
            const status = workspace.billing.status || "unknown";
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});

        return NextResponse.json({
            generatedAt: Date.now(),
            totals: {
                workspaces: clients.length,
                uniqueMembers: uniqueMembersCount,
                pendingInvites: clients.reduce((sum, workspace) => sum + workspace.pendingInvites.length, 0),
                billingStatus: statusBreakdown,
            },
            clients,
        });
    } catch (error) {
        console.error("admin clients error:", error);
        const mapped = mapAdminError(error);
        return NextResponse.json(
            {
                error: mapped.error,
                ...(mapped.details ? { details: mapped.details } : {}),
            },
            { status: mapped.status }
        );
    }
}
