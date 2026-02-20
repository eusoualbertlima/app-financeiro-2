"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
    User,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut as firebaseSignOut
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { UserProfile } from "@/types";
import { SubscriptionService } from "@/services/subscriptionService";

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function syncUserPresence(user: User) {
    const token = await user.getIdToken();
    await fetch("/api/users/presence", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

function getAuthErrorCode(error: unknown) {
    if (typeof error !== "object" || error === null) return "";
    if (!("code" in error)) return "";
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : "";
}

function mapAuthErrorMessage(error: unknown) {
    const code = getAuthErrorCode(error);

    if (
        code === "auth/invalid-login-credentials"
        || code === "auth/invalid-credential"
        || code === "auth/user-not-found"
        || code === "auth/wrong-password"
    ) {
        return "Email ou senha inválidos.";
    }
    if (code === "auth/invalid-email") {
        return "Email inválido.";
    }
    if (code === "auth/operation-not-allowed") {
        return "Login por email/senha desativado. Ative no Firebase Authentication.";
    }
    if (code === "auth/too-many-requests") {
        return "Muitas tentativas de login. Tente novamente em alguns minutos.";
    }
    return "Não foi possível concluir o login agora.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);

            if (user) {
                try {
                    const profile = await SubscriptionService.checkSubscriptionStatus(user);
                    setUserProfile(profile);
                } catch (error) {
                    console.error("Erro ao carregar perfil do usuário:", error);
                    // Em caso de erro, define null ou um perfil fallback seguro
                    setUserProfile(null);
                }

                try {
                    await syncUserPresence(user);
                } catch (error) {
                    console.error("Erro ao sincronizar presença do usuário:", error);
                }
            } else {
                setUserProfile(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Erro ao fazer login:", error);
            throw new Error(mapAuthErrorMessage(error));
        }
    };

    const signInWithEmail = async (email: string, password: string) => {
        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (error) {
            console.error("Erro ao fazer login com email:", error);
            throw new Error(mapAuthErrorMessage(error));
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            setUserProfile(null);
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, userProfile, loading, signInWithGoogle, signInWithEmail, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
