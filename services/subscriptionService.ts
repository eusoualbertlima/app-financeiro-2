import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { UserProfile, Workspace } from "@/types";
import { User } from "firebase/auth";
import { normalizeWorkspaceBilling, toUserSubscriptionStatus } from "@/lib/billing";

function pickPreferredWorkspaceDoc(
    docs: Array<{ id: string; data: () => Record<string, unknown> }>
) {
    if (docs.length <= 1) return docs[0] || null;

    const sorted = [...docs].sort((a, b) => {
        const aData = a.data();
        const bData = b.data();
        const aMembers = Array.isArray(aData.members) ? aData.members.length : 0;
        const bMembers = Array.isArray(bData.members) ? bData.members.length : 0;
        if (aMembers !== bMembers) return bMembers - aMembers;

        const aCreatedAt = typeof aData.createdAt === "number" ? aData.createdAt : Number.MAX_SAFE_INTEGER;
        const bCreatedAt = typeof bData.createdAt === "number" ? bData.createdAt : Number.MAX_SAFE_INTEGER;
        return aCreatedAt - bCreatedAt;
    });

    return sorted[0];
}

export const SubscriptionService = {
    /**
     * Verifica o status da assinatura do usuário.
     * Se o usuário não existir no Firestore, cria um registro inicial (trial ou inactive).
     */
    async checkSubscriptionStatus(user: User): Promise<UserProfile> {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        let existingProfile: UserProfile | null = null;

        if (userSnap.exists()) {
            existingProfile = userSnap.data() as UserProfile;
        }

        const workspaceQuery = query(
            collection(db, "workspaces"),
            where("members", "array-contains", user.uid)
        );
        const workspaceSnap = await getDocs(workspaceQuery);
        const preferredWorkspaceDoc = pickPreferredWorkspaceDoc(
            workspaceSnap.docs.map((docSnap) => ({
                id: docSnap.id,
                data: () => docSnap.data() as Record<string, unknown>,
            }))
        );
        const workspaceDoc = workspaceSnap.empty
            ? null
            : ({ id: preferredWorkspaceDoc!.id, ...preferredWorkspaceDoc!.data() } as Workspace);

        const normalizedBilling = normalizeWorkspaceBilling(workspaceDoc);
        const profile: UserProfile = {
            uid: user.uid,
            email: user.email || existingProfile?.email || "",
            displayName: user.displayName || existingProfile?.displayName || "Usuário",
            photoURL: user.photoURL || existingProfile?.photoURL,
            subscriptionStatus: toUserSubscriptionStatus(normalizedBilling.status),
            subscriptionPlan: normalizedBilling.plan || existingProfile?.subscriptionPlan,
            createdAt: existingProfile?.createdAt || Date.now(),
            updatedAt: Date.now(),
            lastSeenAt: Date.now(),
        };

        await setDoc(userRef, profile, { merge: true });
        return profile;
    },

    /**
     * Atualiza o status da assinatura (usado via Webhook ou Admin)
     */
    async updateSubscription(
        uid: string,
        status: 'active' | 'inactive' | 'trial' | 'past_due' | 'canceled',
        plan: 'monthly' | 'yearly'
    ) {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, {
            subscriptionStatus: status,
            subscriptionPlan: plan,
            updatedAt: Date.now()
        }, { merge: true });
    }
};
