import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { UserProfile } from "@/types";
import { User } from "firebase/auth";

export const SubscriptionService = {
    /**
     * Verifica o status da assinatura do usuário.
     * Se o usuário não existir no Firestore, cria um registro inicial (trial ou inactive).
     */
    async checkSubscriptionStatus(user: User): Promise<UserProfile> {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            return userSnap.data() as UserProfile;
        } else {
            // Cria perfil inicial se não existir
            const initialProfile: UserProfile = {
                uid: user.uid,
                email: user.email || "",
                displayName: user.displayName || "Usuário",
                photoURL: user.photoURL || undefined,
                subscriptionStatus: "inactive", // Começa como inativo (precisa pagar)
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            await setDoc(userRef, initialProfile);
            return initialProfile;
        }
    },

    /**
     * Atualiza o status da assinatura (usado via Webhook ou Admin)
     */
    async updateSubscription(uid: string, status: 'active' | 'inactive', plan: 'monthly' | 'yearly') {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, {
            subscriptionStatus: status,
            subscriptionPlan: plan,
            updatedAt: Date.now()
        }, { merge: true });
    }
};
