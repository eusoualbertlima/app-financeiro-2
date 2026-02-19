"use client";

import Link from "next/link";
import { Header } from "@/components/Navigation";
import { UserGamification } from "@/components/UserGamification";
import { useWorkspace } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeBehavioralMetrics } from "@/lib/behavioralMetrics";
import { getClientDevAdminAllowlist, hasDevAdminAccess } from "@/lib/devAdmin";
import { getClientBehavioralRolloutMode, hasBehavioralRolloutAccess } from "@/lib/behavioralRollout";
import { ArrowLeft } from "lucide-react";

const clientDevAllowlist = getClientDevAdminAllowlist();

export default function CidadePage() {
    const { user } = useAuth();
    const { workspace, loading } = useWorkspace();

    const isDeveloperAdmin = hasDevAdminAccess({
        uid: user?.uid,
        email: user?.email,
        allowlist: clientDevAllowlist,
    });
    const canAccessCity = hasBehavioralRolloutAccess({
        mode: getClientBehavioralRolloutMode(),
        isDeveloperAdmin,
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!canAccessCity) {
        return (
            <div className="p-6 lg:p-8 max-w-5xl mx-auto">
                <Header title="Cidade Financeira" subtitle="Visualização comportamental da sua consistência." />
                <div className="card p-6">
                    <p className="text-sm text-slate-600 mb-4">
                        A Cidade Financeira está em rollout controlado e ainda não está disponível para esta conta.
                    </p>
                    <Link href="/dashboard" className="btn-secondary inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Voltar ao Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const metrics = normalizeBehavioralMetrics(workspace?.behavioralMetrics, {
        members: workspace?.members || [],
    });

    return (
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            <Header title="Cidade Financeira" subtitle="Consistência diária transformada em evolução visual." />

            <UserGamification
                metrics={metrics}
                membersCount={workspace?.members?.length || 1}
            />

            <div className="mt-4">
                <Link href="/dashboard" className="text-sm text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" />
                    Voltar ao Dashboard
                </Link>
            </div>
        </div>
    );
}
