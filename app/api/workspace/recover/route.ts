import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { requireUserFromRequest } from "@/lib/serverAuth";
import { getDefaultTrialEndsAt, normalizeWorkspaceBilling } from "@/lib/billing";
import { createInitialBehavioralMetrics, normalizeBehavioralMetrics } from "@/lib/behavioralMetrics";
import type { Workspace } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RecoverRequestBody = {
    createIfMissing?: boolean;
};

type WorkspaceRecord = Omit<Workspace, "id">;
type UserProfileRecord = {
    uid?: string;
    email?: string;
    createdAt?: number;
    updatedAt?: number;
    lastSeenAt?: number;
    primaryWorkspaceId?: string;
};
const DATA_COLLECTIONS = [
    "accounts",
    "credit_cards",
    "transactions",
    "financial_notes",
    "recurring_bills",
    "bill_payments",
    "card_statements",
] as const;

function normalizeEmail(email: string | null | undefined) {
    return (email || "").trim().toLowerCase();
}

function unique(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)));
}

function chunkArray<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

async function lookupHistoricalUidsByEmail(params: {
    db: FirebaseFirestore.Firestore;
    normalizedEmail: string;
    rawEmail: string | null | undefined;
}) {
    const { db, normalizedEmail, rawEmail } = params;
    if (!normalizedEmail) return [];

    const emailCandidates = unique([
        normalizedEmail,
        typeof rawEmail === "string" ? rawEmail.trim() : "",
    ]);

    if (emailCandidates.length === 0) return [];

    const snapshots = await Promise.all(
        emailCandidates.map((email) => db.collection("users").where("email", "==", email).limit(100).get())
    );

    const uids = new Set<string>();

    for (const snapshot of snapshots) {
        snapshot.docs.forEach((docSnap) => {
            const userData = docSnap.data() as { uid?: unknown; email?: unknown };
            const candidateUid = typeof userData.uid === "string" && userData.uid ? userData.uid : docSnap.id;
            const candidateEmail = normalizeEmail(typeof userData.email === "string" ? userData.email : "");

            if (!candidateUid) return;
            if (candidateEmail && candidateEmail !== normalizedEmail) return;

            uids.add(candidateUid);
        });
    }

    return Array.from(uids);
}

async function countWorkspaceDataCollections(workspaceRef: FirebaseFirestore.DocumentReference) {
    let collectionsWithData = 0;

    for (const collectionName of DATA_COLLECTIONS) {
        const snapshot = await workspaceRef.collection(collectionName).limit(1).get();
        if (!snapshot.empty) {
            collectionsWithData += 1;
        }
    }

    return collectionsWithData;
}

async function buildWorkspaceDataCollectionsMap(params: {
    workspacesRef: FirebaseFirestore.CollectionReference;
    workspaceIds: string[];
}) {
    const { workspacesRef, workspaceIds } = params;
    const entries = await Promise.all(
        workspaceIds.map(async (workspaceId) => {
            const collectionsWithData = await countWorkspaceDataCollections(workspacesRef.doc(workspaceId));
            return [workspaceId, collectionsWithData] as const;
        })
    );

    return new Map(entries);
}

function getMaxWorkspaceDataCollections(values: Iterable<number>) {
    let max = 0;
    for (const value of values) {
        if (value > max) max = value;
    }
    return max;
}

async function lookupEmailLinkedWorkspacesByIdentity(params: {
    db: FirebaseFirestore.Firestore;
    uid: string;
    normalizedEmail: string;
}) {
    const { db, uid, normalizedEmail } = params;
    if (!normalizedEmail) return new Map<string, WorkspaceRecord>();

    const workspacesSnapshot = await db.collection("workspaces").limit(500).get();
    if (workspacesSnapshot.empty) {
        return new Map<string, WorkspaceRecord>();
    }

    const rawWorkspaceDocs = workspacesSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        raw: docSnap.data() as Partial<WorkspaceRecord>,
    }));

    const allUids = unique(
        rawWorkspaceDocs.flatMap(({ raw }) => {
            const owner = typeof raw.ownerId === "string" && raw.ownerId ? [raw.ownerId] : [];
            const members = Array.isArray(raw.members)
                ? raw.members.filter((member): member is string => typeof member === "string" && Boolean(member))
                : [];
            return [...owner, ...members];
        })
    );

    const matchedUids = new Set<string>();

    if (allUids.length > 0) {
        const userRefs = allUids.map((candidateUid) => db.collection("users").doc(candidateUid));
        const userSnapshots = await db.getAll(...userRefs);

        userSnapshots.forEach((userSnapshot) => {
            if (!userSnapshot.exists) return;
            const data = userSnapshot.data() as { email?: unknown };
            const email = normalizeEmail(typeof data.email === "string" ? data.email : "");
            if (email === normalizedEmail) {
                matchedUids.add(userSnapshot.id);
            }
        });

        const auth = getAdminAuth();
        const chunks = chunkArray(allUids, 100);
        for (const chunk of chunks) {
            const authLookup = await auth.getUsers(chunk.map((candidateUid) => ({ uid: candidateUid })));
            authLookup.users.forEach((record) => {
                if (normalizeEmail(record.email) === normalizedEmail) {
                    matchedUids.add(record.uid);
                }
            });
        }
    }

    const byId = new Map<string, WorkspaceRecord>();

    rawWorkspaceDocs.forEach(({ id, raw }) => {
        const ownerEmail = normalizeEmail(raw.ownerEmail);
        const pendingInvites = Array.isArray(raw.pendingInvites)
            ? raw.pendingInvites.map((email) => normalizeEmail(email))
            : [];
        const ownerId = typeof raw.ownerId === "string" ? raw.ownerId : "";
        const members = Array.isArray(raw.members)
            ? raw.members.filter((member): member is string => typeof member === "string" && Boolean(member))
            : [];

        const directEmailMatch = ownerEmail === normalizedEmail || pendingInvites.includes(normalizedEmail);
        const uidEmailMatch = matchedUids.has(ownerId) || members.some((memberUid) => matchedUids.has(memberUid));

        if (!directEmailMatch && !uidEmailMatch) {
            return;
        }

        byId.set(id, toWorkspaceRecord(raw, uid));
    });

    return byId;
}

function toWorkspaceRecord(raw: Partial<WorkspaceRecord> | undefined, uid: string): WorkspaceRecord {
    const createdAt = typeof raw?.createdAt === "number" ? raw.createdAt : Date.now();
    const billing = raw?.billing || {
        status: "trialing" as const,
        trialEndsAt: getDefaultTrialEndsAt(createdAt),
        updatedAt: Date.now(),
    };
    const members = Array.isArray(raw?.members) ? raw.members.filter(Boolean) : [uid];
    const behavioralMetrics = normalizeBehavioralMetrics(raw?.behavioralMetrics, {
        now: Date.now(),
        members,
    });

    return {
        name: typeof raw?.name === "string" && raw.name.trim() ? raw.name : "Minhas Finanças",
        members,
        ownerId: typeof raw?.ownerId === "string" && raw.ownerId ? raw.ownerId : uid,
        ownerEmail: normalizeEmail(raw?.ownerEmail),
        createdAt,
        pendingInvites: Array.isArray(raw?.pendingInvites) ? raw.pendingInvites : [],
        billing,
        behavioralMetrics,
        legal: raw?.legal,
    };
}

function isWorkspaceLinkedToIdentity(params: {
    workspace: WorkspaceRecord;
    uid: string;
    normalizedEmail: string;
    knownUidSet: Set<string>;
}) {
    const { workspace, uid, normalizedEmail, knownUidSet } = params;
    const members = Array.isArray(workspace.members)
        ? workspace.members.filter((member): member is string => typeof member === "string" && Boolean(member))
        : [];
    const ownerId = typeof workspace.ownerId === "string" ? workspace.ownerId : "";
    const ownerEmail = normalizeEmail(workspace.ownerEmail);
    const pendingInvites = Array.isArray(workspace.pendingInvites)
        ? workspace.pendingInvites.map((inviteEmail) => normalizeEmail(inviteEmail))
        : [];

    const uidLinked = ownerId === uid
        || knownUidSet.has(ownerId)
        || members.includes(uid)
        || members.some((memberUid) => knownUidSet.has(memberUid));

    const emailLinked = Boolean(
        normalizedEmail
        && (ownerEmail === normalizedEmail || pendingInvites.includes(normalizedEmail))
    );

    return uidLinked || emailLinked;
}

function pickPreferredWorkspace(
    candidates: Array<{ id: string; data: WorkspaceRecord }>,
    uid: string,
    normalizedEmail: string,
    dataCollectionsByWorkspaceId?: Map<string, number>,
    preferredWorkspaceId?: string | null
) {
    if (candidates.length === 0) return null;

    const getBillingPriority = (workspace: { id: string; data: WorkspaceRecord }) => {
        const workspaceLike = { id: workspace.id, ...workspace.data } as Workspace;
        const status = normalizeWorkspaceBilling(workspaceLike).status;
        if (status === "active") return 5;
        if (status === "trialing") return 4;
        if (status === "past_due") return 3;
        if (status === "canceled") return 2;
        return 1;
    };

    const ranked = [...candidates].sort((a, b) => {
        const aMembers = Array.isArray(a.data.members) ? a.data.members : [];
        const bMembers = Array.isArray(b.data.members) ? b.data.members : [];
        const aCollectionsWithData = dataCollectionsByWorkspaceId?.get(a.id) || 0;
        const bCollectionsWithData = dataCollectionsByWorkspaceId?.get(b.id) || 0;
        const aBillingPriority = getBillingPriority(a);
        const bBillingPriority = getBillingPriority(b);
        const aPreferred = preferredWorkspaceId && a.id === preferredWorkspaceId ? 1 : 0;
        const bPreferred = preferredWorkspaceId && b.id === preferredWorkspaceId ? 1 : 0;
        const aIsOwner = a.data.ownerId === uid ? 1 : 0;
        const bIsOwner = b.data.ownerId === uid ? 1 : 0;
        const aOwnerEmailMatch = normalizedEmail && normalizeEmail(a.data.ownerEmail) === normalizedEmail ? 1 : 0;
        const bOwnerEmailMatch = normalizedEmail && normalizeEmail(b.data.ownerEmail) === normalizedEmail ? 1 : 0;

        if (aPreferred !== bPreferred) return bPreferred - aPreferred;

        if (aIsOwner !== bIsOwner) return bIsOwner - aIsOwner;

        if (aOwnerEmailMatch !== bOwnerEmailMatch) return bOwnerEmailMatch - aOwnerEmailMatch;

        if (aCollectionsWithData !== bCollectionsWithData) {
            return bCollectionsWithData - aCollectionsWithData;
        }

        if (aBillingPriority !== bBillingPriority) return bBillingPriority - aBillingPriority;

        const aIsMember = aMembers.includes(uid) ? 1 : 0;
        const bIsMember = bMembers.includes(uid) ? 1 : 0;
        if (aIsMember !== bIsMember) return bIsMember - aIsMember;

        const aLegacyOwnerMatch = aOwnerEmailMatch && a.data.ownerId !== uid ? 1 : 0;
        const bLegacyOwnerMatch = bOwnerEmailMatch && b.data.ownerId !== uid ? 1 : 0;
        if (aLegacyOwnerMatch !== bLegacyOwnerMatch) return bLegacyOwnerMatch - aLegacyOwnerMatch;

        const aInvite = normalizedEmail && (a.data.pendingInvites || []).map(normalizeEmail).includes(normalizedEmail) ? 1 : 0;
        const bInvite = normalizedEmail && (b.data.pendingInvites || []).map(normalizeEmail).includes(normalizedEmail) ? 1 : 0;
        if (aInvite !== bInvite) return bInvite - aInvite;

        if (aMembers.length !== bMembers.length) return bMembers.length - aMembers.length;

        return a.data.createdAt - b.data.createdAt;
    });

    return ranked[0];
}

function isSafeDuplicateCandidateForDeletion(
    workspaceId: string,
    selectedWorkspaceId: string,
    workspace: WorkspaceRecord,
    uid: string
) {
    if (workspaceId === selectedWorkspaceId) return false;
    if (workspace.ownerId !== uid) return false;

    const members = unique(Array.isArray(workspace.members) ? workspace.members : []);
    if (!(members.length === 1 && members[0] === uid)) return false;

    const pendingInvites = Array.isArray(workspace.pendingInvites) ? workspace.pendingInvites : [];
    if (pendingInvites.length > 0) return false;

    if (workspace.legal?.acceptedTermsAt || workspace.legal?.acceptedPrivacyAt) return false;

    const billing = workspace.billing;
    if (billing?.stripeCustomerId || billing?.stripeSubscriptionId) return false;

    const normalizedName = (workspace.name || "").trim().toLowerCase();
    if (normalizedName && normalizedName !== "minhas finanças") return false;

    return true;
}

async function workspaceHasBusinessData(workspaceRef: FirebaseFirestore.DocumentReference) {
    for (const collectionName of DATA_COLLECTIONS) {
        const snapshot = await workspaceRef.collection(collectionName).limit(1).get();
        if (!snapshot.empty) {
            return true;
        }
    }
    return false;
}

async function cleanupOwnedDuplicateWorkspaces(params: {
    db: FirebaseFirestore.Firestore;
    uid: string;
    selectedWorkspaceId: string;
}) {
    const { db, uid, selectedWorkspaceId } = params;
    const workspacesRef = db.collection("workspaces");
    const ownedSnapshot = await workspacesRef.where("ownerId", "==", uid).limit(100).get();

    let deletedCount = 0;
    for (const docSnap of ownedSnapshot.docs) {
        const workspace = toWorkspaceRecord(docSnap.data() as Partial<WorkspaceRecord>, uid);

        if (!isSafeDuplicateCandidateForDeletion(docSnap.id, selectedWorkspaceId, workspace, uid)) {
            continue;
        }

        const hasData = await workspaceHasBusinessData(docSnap.ref);
        if (hasData) continue;

        await db.recursiveDelete(docSnap.ref);
        deletedCount += 1;
    }

    return deletedCount;
}

function getPrimaryWorkspaceIdFromProfile(data: UserProfileRecord | undefined) {
    return typeof data?.primaryWorkspaceId === "string" && data.primaryWorkspaceId
        ? data.primaryWorkspaceId
        : null;
}

async function ensureUserPrimaryWorkspace(params: {
    db: FirebaseFirestore.Firestore;
    uid: string;
    normalizedEmail: string;
    selectedWorkspaceId: string;
}) {
    const { db, uid, normalizedEmail, selectedWorkspaceId } = params;
    const userRef = db.collection("users").doc(uid);
    const now = Date.now();

    await userRef.set(
        {
            uid,
            ...(normalizedEmail ? { email: normalizedEmail } : {}),
            primaryWorkspaceId: selectedWorkspaceId,
            updatedAt: now,
            lastSeenAt: now,
        },
        { merge: true }
    );
}

export async function POST(request: NextRequest) {
    try {
        const decoded = await requireUserFromRequest(request);
        const uid = decoded.uid;
        const rawEmail = (decoded.email || "").trim();
        const normalizedEmail = normalizeEmail(rawEmail);

        let body: RecoverRequestBody = {};
        try {
            body = (await request.json()) as RecoverRequestBody;
        } catch {
            body = {};
        }
        const createIfMissing = body.createIfMissing !== false;

        const db = getAdminDb();
        const workspacesRef = db.collection("workspaces");
        const userRef = db.collection("users").doc(uid);
        const userProfileSnap = await userRef.get();
        const userProfileData = (userProfileSnap.exists ? userProfileSnap.data() : undefined) as UserProfileRecord | undefined;
        const preferredWorkspaceId = getPrimaryWorkspaceIdFromProfile(userProfileData);
        const historicalUids = await lookupHistoricalUidsByEmail({
            db,
            normalizedEmail,
            rawEmail,
        });
        const lookupUids = unique([uid, ...historicalUids]).slice(0, 20);
        const historicalUidSet = new Set(historicalUids);
        const knownUidSet = new Set(lookupUids);

        const lookupPromises: Array<Promise<FirebaseFirestore.QuerySnapshot>> = [];
        lookupUids.forEach((lookupUid) => {
            lookupPromises.push(workspacesRef.where("members", "array-contains", lookupUid).limit(50).get());
            lookupPromises.push(workspacesRef.where("ownerId", "==", lookupUid).limit(50).get());
        });

        if (normalizedEmail) {
            lookupPromises.push(workspacesRef.where("pendingInvites", "array-contains", normalizedEmail).limit(50).get());
            lookupPromises.push(workspacesRef.where("ownerEmail", "==", normalizedEmail).limit(50).get());
            if (rawEmail && rawEmail !== normalizedEmail) {
                lookupPromises.push(workspacesRef.where("ownerEmail", "==", rawEmail).limit(50).get());
            }
        }

        const lookupSnapshots = await Promise.all(lookupPromises);
        const byId = new Map<string, WorkspaceRecord>();

        for (const snapshot of lookupSnapshots) {
            snapshot.docs.forEach((docSnap) => {
                byId.set(docSnap.id, toWorkspaceRecord(docSnap.data() as Partial<WorkspaceRecord>, uid));
            });
        }

        if (preferredWorkspaceId && !byId.has(preferredWorkspaceId)) {
            try {
                const preferredWorkspaceSnap = await workspacesRef.doc(preferredWorkspaceId).get();
                if (preferredWorkspaceSnap.exists) {
                    const preferredWorkspace = toWorkspaceRecord(
                        preferredWorkspaceSnap.data() as Partial<WorkspaceRecord>,
                        uid
                    );
                    if (
                        isWorkspaceLinkedToIdentity({
                            workspace: preferredWorkspace,
                            uid,
                            normalizedEmail,
                            knownUidSet,
                        })
                    ) {
                        byId.set(preferredWorkspaceSnap.id, preferredWorkspace);
                    }
                }
            } catch (preferredWorkspaceError) {
                console.warn("workspace recover preferred workspace lookup warning:", preferredWorkspaceError);
            }
        }

        let dataCollectionsByWorkspaceId = new Map<string, number>();

        if (byId.size > 1) {
            dataCollectionsByWorkspaceId = await buildWorkspaceDataCollectionsMap({
                workspacesRef,
                workspaceIds: Array.from(byId.keys()),
            });
        } else if (byId.size === 1 && normalizedEmail) {
            const [singleWorkspaceId] = Array.from(byId.keys());
            const singleWorkspaceCollections = await countWorkspaceDataCollections(
                workspacesRef.doc(singleWorkspaceId)
            );
            dataCollectionsByWorkspaceId.set(singleWorkspaceId, singleWorkspaceCollections);
        }

        const maxCollectionsWithData = getMaxWorkspaceDataCollections(dataCollectionsByWorkspaceId.values());
        const shouldRunEmailIdentityFallback = Boolean(
            normalizedEmail
            && (byId.size === 0 || maxCollectionsWithData === 0)
        );

        if (shouldRunEmailIdentityFallback) {
            const emailLinkedCandidates = await lookupEmailLinkedWorkspacesByIdentity({
                db,
                uid,
                normalizedEmail,
            });

            for (const [workspaceId, workspaceData] of emailLinkedCandidates.entries()) {
                if (!byId.has(workspaceId)) {
                    byId.set(workspaceId, workspaceData);
                }
            }

            if (byId.size > 0) {
                dataCollectionsByWorkspaceId = await buildWorkspaceDataCollectionsMap({
                    workspacesRef,
                    workspaceIds: Array.from(byId.keys()),
                });
            }
        }

        let selected = pickPreferredWorkspace(
            Array.from(byId.entries()).map(([id, data]) => ({ id, data })),
            uid,
            normalizedEmail,
            dataCollectionsByWorkspaceId,
            preferredWorkspaceId
        );
        let created = false;

        if (!selected && createIfMissing) {
            const createdAt = Date.now();
            const workspace: WorkspaceRecord = {
                name: "Minhas Finanças",
                members: [uid],
                ownerId: uid,
                ownerEmail: normalizedEmail || undefined,
                createdAt,
                billing: {
                    status: "trialing",
                    trialEndsAt: getDefaultTrialEndsAt(createdAt),
                    updatedAt: Date.now(),
                },
                behavioralMetrics: createInitialBehavioralMetrics(createdAt),
                pendingInvites: [],
            };

            const deterministicWorkspaceId = `default_${uid}`;
            const defaultWorkspaceRef = workspacesRef.doc(deterministicWorkspaceId);
            await defaultWorkspaceRef.set(workspace, { merge: true });
            const ensuredWorkspaceSnap = await defaultWorkspaceRef.get();

            selected = {
                id: ensuredWorkspaceSnap.id,
                data: toWorkspaceRecord(ensuredWorkspaceSnap.data() as Partial<WorkspaceRecord>, uid),
            };
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

        let ownerId = selected.data.ownerId;
        let ownerEmail = normalizeEmail(selected.data.ownerEmail);
        if (!ownerEmail && ownerId === uid && normalizedEmail) {
            ownerEmail = normalizedEmail;
        }

        if (!ownerEmail && ownerId) {
            try {
                const ownerUser = await getAdminAuth().getUser(ownerId);
                ownerEmail = normalizeEmail(ownerUser.email);
            } catch (ownerEmailError) {
                console.warn("workspace recover owner email lookup warning:", ownerEmailError);
            }
        }

        const canMigrateLegacyOwner =
            ownerId !== uid
            && (
                (ownerEmail && normalizedEmail && ownerEmail === normalizedEmail)
                || historicalUidSet.has(ownerId)
            );

        if (canMigrateLegacyOwner) {
            ownerId = uid;
            patch.ownerId = uid;
            if (!ownerEmail && normalizedEmail) {
                ownerEmail = normalizedEmail;
            }
        }

        if (ownerEmail && ownerEmail !== normalizeEmail(selected.data.ownerEmail)) {
            patch.ownerEmail = ownerEmail;
        }

        if (Object.keys(patch).length > 0) {
            await workspacesRef.doc(selected.id).set(patch, { merge: true });
        }

        const workspace: Workspace = {
            id: selected.id,
            ...selected.data,
            ownerId,
            ownerEmail: ownerEmail || selected.data.ownerEmail,
            members: nextMembers,
            pendingInvites: nextPendingInvites,
        };

        try {
            await ensureUserPrimaryWorkspace({
                db,
                uid,
                normalizedEmail,
                selectedWorkspaceId: selected.id,
            });
        } catch (primaryWorkspaceError) {
            console.warn("workspace recover primary workspace update warning:", primaryWorkspaceError);
        }

        let deletedDuplicates = 0;
        try {
            deletedDuplicates = await cleanupOwnedDuplicateWorkspaces({
                db,
                uid,
                selectedWorkspaceId: selected.id,
            });
        } catch (cleanupError) {
            console.warn("workspace duplicate cleanup warning:", cleanupError);
        }

        return NextResponse.json({
            workspace,
            recovered: true,
            created,
            deletedDuplicates,
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
