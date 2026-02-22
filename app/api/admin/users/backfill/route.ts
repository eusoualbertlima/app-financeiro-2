import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { requireUserFromRequest } from "@/lib/serverAuth";
import {
    getServerDevAdminAllowlist,
    hasConfiguredDevAdminAllowlist,
    hasDevAdminAccess,
} from "@/lib/devAdmin";
import { normalizeProfileIcon } from "@/lib/profileIcons";
import type { UserProfile, Workspace } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
}

function toTimestampOrNull(value: unknown) {
    if (typeof value !== "string") return null;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
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

function shouldBackfillProfile(profile: Partial<UserProfile> | null | undefined) {
    if (!profile) return true;
    return (
        typeof profile.email !== "string"
        || !profile.email.trim()
        || typeof profile.displayName !== "string"
        || !profile.displayName.trim()
        || typeof profile.createdAt !== "number"
    );
}

function omitUndefined<T extends Record<string, unknown>>(input: T) {
    return Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined)
    ) as Partial<T>;
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

        const db = getAdminDb();
        const adminAuth = getAdminAuth();

        const workspacesSnapshot = await db.collection("workspaces").limit(500).get();
        const workspaceDocs = workspacesSnapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Workspace, "id">),
        }));

        const allUserIds = unique(
            workspaceDocs.flatMap((workspaceDoc) => {
                const ownerId = workspaceDoc.ownerId ? [workspaceDoc.ownerId] : [];
                const members = Array.isArray(workspaceDoc.members) ? workspaceDoc.members : [];
                const acceptedByUid = workspaceDoc.legal?.acceptedByUid ? [workspaceDoc.legal.acceptedByUid] : [];
                return [...ownerId, ...members, ...acceptedByUid];
            })
        );

        if (allUserIds.length === 0) {
            return NextResponse.json({
                ok: true,
                message: "Nenhum usuário encontrado para backfill.",
                stats: {
                    workspaces: workspaceDocs.length,
                    usersInWorkspaces: 0,
                    authRecordsFound: 0,
                    updatedProfiles: 0,
                    skippedProfiles: 0,
                    missingAuthRecords: 0,
                },
            });
        }

        const refs = allUserIds.map((uid) => db.collection("users").doc(uid));
        const userSnaps = await db.getAll(...refs);
        const existingProfileMap = new Map<string, Partial<UserProfile>>();
        userSnaps.forEach((snap) => {
            if (snap.exists) {
                existingProfileMap.set(snap.id, snap.data() as Partial<UserProfile>);
            }
        });

        const authUserMap = new Map<string, Awaited<ReturnType<typeof adminAuth.getUser>>>();
        const missingAuthUids: string[] = [];
        const userChunks = chunkArray(allUserIds, 100);
        for (const chunk of userChunks) {
            const authLookup = await adminAuth.getUsers(chunk.map((uid) => ({ uid })));
            const foundUids = new Set<string>();
            authLookup.users.forEach((record) => {
                foundUids.add(record.uid);
                authUserMap.set(record.uid, record);
            });
            chunk.forEach((uid) => {
                if (!foundUids.has(uid)) {
                    missingAuthUids.push(uid);
                }
            });
        }

        let updatedProfiles = 0;
        let skippedProfiles = 0;
        const now = Date.now();
        const writeQueue: Promise<unknown>[] = [];

        for (const uid of allUserIds) {
            const authRecord = authUserMap.get(uid);
            const existingProfile = existingProfileMap.get(uid);

            if (!authRecord) {
                skippedProfiles += 1;
                continue;
            }

            if (!shouldBackfillProfile(existingProfile)) {
                skippedProfiles += 1;
                continue;
            }

            const authCreatedAt = toTimestampOrNull(authRecord.metadata.creationTime);
            const authLastSignInAt = toTimestampOrNull(authRecord.metadata.lastSignInTime);
            const managedExistingIcon = normalizeProfileIcon(existingProfile?.photoURL);
            const managedAuthIcon = normalizeProfileIcon(authRecord.photoURL);

            const profile = omitUndefined({
                uid,
                email: authRecord.email || existingProfile?.email || "",
                displayName: authRecord.displayName || existingProfile?.displayName || "Usuário",
                photoURL: managedExistingIcon || existingProfile?.photoURL || managedAuthIcon || authRecord.photoURL,
                subscriptionStatus: existingProfile?.subscriptionStatus || "inactive",
                subscriptionPlan: existingProfile?.subscriptionPlan,
                createdAt: existingProfile?.createdAt || authCreatedAt || now,
                updatedAt: now,
                lastSeenAt: existingProfile?.lastSeenAt || authLastSignInAt || now,
            } satisfies Partial<UserProfile> & Record<string, unknown>);

            writeQueue.push(db.collection("users").doc(uid).set(profile, { merge: true }));
            updatedProfiles += 1;
        }

        if (writeQueue.length > 0) {
            await Promise.all(writeQueue);
        }

        return NextResponse.json({
            ok: true,
            message: "Backfill de perfis concluído.",
            stats: {
                workspaces: workspaceDocs.length,
                usersInWorkspaces: allUserIds.length,
                authRecordsFound: authUserMap.size,
                updatedProfiles,
                skippedProfiles,
                missingAuthRecords: missingAuthUids.length,
            },
        });
    } catch (error) {
        const details = normalizeErrorMessage(error);
        console.error("admin users backfill error:", error);
        return NextResponse.json(
            { error: "Erro ao corrigir perfis ausentes.", details },
            { status: 500 }
        );
    }
}
