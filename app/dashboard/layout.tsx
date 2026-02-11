"use client";

import { Sidebar, MobileNav } from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useFirestore";
import { getWorkspaceAccessState } from "@/lib/billing";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading: authLoading } = useAuth();
    const { workspace, loading: workspaceLoading } = useWorkspace();
    const router = useRouter();
    const access = getWorkspaceAccessState(workspace);

    useEffect(() => {
        if (authLoading || workspaceLoading) return;

        if (!user) {
            router.push("/");
            return;
        }

        if (workspace && !access.hasAccess) {
            router.push("/checkout");
        }
    }, [user, workspace, access.hasAccess, authLoading, workspaceLoading, router]);

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

    if (!user || !workspace || !access.hasAccess) return null;

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
