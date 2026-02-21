"use client";

import { Sidebar, MobileNav } from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useFirestore";
import { resolveWorkspaceAccessDecision } from "@/lib/accessPolicy";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isDeveloperAdmin, loading: authLoading } = useAuth();
    const { workspace, loading: workspaceLoading } = useWorkspace();
    const router = useRouter();
    const accessDecision = resolveWorkspaceAccessDecision({
        workspace,
        user: {
            uid: user?.uid,
            email: user?.email,
            isDeveloperAdmin,
        },
    });
    const hasEffectiveAccess = accessDecision.hasEffectiveAccess;

    useEffect(() => {
        if (authLoading || workspaceLoading) return;

        if (!user) {
            router.push("/");
            return;
        }

        if (workspace && !hasEffectiveAccess) {
            router.push("/checkout");
        }
    }, [user, workspace, hasEffectiveAccess, authLoading, workspaceLoading, router]);

    if (authLoading || workspaceLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium">Verificando acesso...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <p className="text-slate-500 font-medium">Redirecionando para login...</p>
            </div>
        );
    }

    if (!workspace) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <p className="text-slate-700 font-semibold">Não conseguimos localizar seu workspace.</p>
                    <p className="text-slate-500 text-sm text-center max-w-sm">
                        Estamos tentando recuperar automaticamente seus dados. Se isso persistir, tente novamente.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
                    >
                        Tentar novamente
                    </button>
                </div>
            </div>
        );
    }

    if (!hasEffectiveAccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <p className="text-slate-500 font-medium">Redirecionando para checkout...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <Sidebar />
            <MobileNav />
            <main className="lg:ml-72 pb-24 lg:pb-8 min-h-screen">
                {children}
            </main>
        </div>
    );
}
