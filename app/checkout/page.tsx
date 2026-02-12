"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useFirestore";
import { getWorkspaceAccessState } from "@/lib/billing";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Shield, Check, Star, LogOut, Loader2, CircleAlert, CalendarClock, CreditCard } from "lucide-react";

function CheckoutContent() {
    const { user, loading: authLoading, signOut } = useAuth();
    const { workspace, loading: workspaceLoading } = useWorkspace();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [portalLoading, setPortalLoading] = useState(false);
    const [message, setMessage] = useState("");
    const access = getWorkspaceAccessState(workspace);
    const isOwner = workspace?.ownerId ? user?.uid === workspace.ownerId : true;
    const paymentSuccess = searchParams.get("success") === "1";
    const paymentCanceled = searchParams.get("canceled") === "1";

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/");
            return;
        }

        if (!authLoading && !workspaceLoading && user && workspace && access.hasAccess) {
            router.push("/dashboard");
        }
    }, [user, workspace, access.hasAccess, authLoading, workspaceLoading, router]);

    const handleStartCheckout = async () => {
        if (!user || !workspace?.id) return;

        setCheckoutLoading(true);
        setMessage("");
        try {
            const token = await user.getIdToken();
            const response = await fetch("/api/billing/create-checkout-session", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    workspaceId: workspace.id,
                    plan,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error("Somente o dono do workspace pode iniciar a assinatura.");
                }
                throw new Error(data?.error || "Erro ao iniciar checkout.");
            }

            if (!data?.url) {
                throw new Error("Checkout sem URL de redirecionamento.");
            }

            window.location.href = data.url;
        } catch (error) {
            console.error(error);
            setMessage(error instanceof Error ? error.message : "Não foi possível abrir o checkout agora.");
        } finally {
            setCheckoutLoading(false);
        }
    };

    const handleOpenPortal = async () => {
        if (!user || !workspace?.id) return;

        setPortalLoading(true);
        setMessage("");
        try {
            const token = await user.getIdToken();
            const response = await fetch("/api/billing/create-portal-session", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    workspaceId: workspace.id,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error("Somente o dono do workspace pode gerenciar a assinatura.");
                }
                throw new Error(data?.error || "Erro ao abrir portal.");
            }

            if (!data?.url) {
                throw new Error("Portal sem URL de redirecionamento.");
            }

            window.location.href = data.url;
        } catch (error) {
            console.error(error);
            setMessage(error instanceof Error ? error.message : "Não foi possível abrir o portal de assinatura neste momento.");
        } finally {
            setPortalLoading(false);
        }
    };

    if (authLoading || workspaceLoading || !user) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Carregando...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center animate-pulse">
                        <Star className="w-8 h-8 text-white fill-white" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-center mb-2">Finalize seu acesso</h1>
                <p className="text-slate-400 text-center mb-8">
                    Para acessar o App Financeiro 2.0 e controlar sua vida financeira, você precisa ativar sua conta Premium.
                </p>

                {access.status === "trialing" && (
                    <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                        <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium mb-1">
                            <CalendarClock className="w-4 h-4" />
                            Teste grátis ativo
                        </div>
                        <p className="text-xs text-emerald-100">
                            Você tem {access.trialDaysLeft || 0} dia(s) restantes de teste.
                        </p>
                    </div>
                )}

                {(access.status === "past_due" || access.status === "inactive" || access.status === "canceled") && (
                    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                        <div className="flex items-center gap-2 text-amber-300 text-sm font-medium mb-1">
                            <CircleAlert className="w-4 h-4" />
                            Acesso bloqueado
                        </div>
                        <p className="text-xs text-amber-100">
                            Ative sua assinatura para continuar usando o dashboard.
                        </p>
                    </div>
                )}

                {paymentSuccess && !access.hasAccess && (
                    <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                        <p className="text-xs text-blue-100">
                            Pagamento recebido. Estamos aguardando confirmação do Stripe (normalmente alguns segundos).
                        </p>
                    </div>
                )}

                {paymentCanceled && (
                    <div className="mb-6 rounded-xl border border-slate-500/30 bg-slate-500/10 p-4">
                        <p className="text-xs text-slate-200">
                            Checkout cancelado. Você pode tentar novamente quando quiser.
                        </p>
                    </div>
                )}

                <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-500/10 p-2 rounded-lg">
                            <Check className="w-5 h-5 text-green-500" />
                        </div>
                        <span className="text-slate-200">Acesso ilimitado ao Dashboard</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-green-500/10 p-2 rounded-lg">
                            <Check className="w-5 h-5 text-green-500" />
                        </div>
                        <span className="text-slate-200">Controle de Cartões e Contas</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-green-500/10 p-2 rounded-lg">
                            <Check className="w-5 h-5 text-green-500" />
                        </div>
                        <span className="text-slate-200">Suporte Prioritário</span>
                    </div>
                </div>

                <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-700 p-1">
                        <button
                            onClick={() => setPlan("monthly")}
                            className={`rounded-lg py-2 text-sm font-semibold transition-colors ${plan === "monthly" ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white"}`}
                        >
                            Mensal
                        </button>
                        <button
                            onClick={() => setPlan("yearly")}
                            className={`rounded-lg py-2 text-sm font-semibold transition-colors ${plan === "yearly" ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white"}`}
                        >
                            Anual
                        </button>
                    </div>

                    <button
                        onClick={handleStartCheckout}
                        disabled={checkoutLoading || !isOwner}
                        className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-center transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {checkoutLoading ? (
                            <span className="inline-flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Abrindo checkout...
                            </span>
                        ) : (
                            <>
                                LIBERAR ACESSO AGORA
                                <span className="block text-xs font-normal opacity-80 mt-1">
                                    Cobrança recorrente via Stripe
                                </span>
                            </>
                        )}
                    </button>

                    {workspace?.billing?.stripeCustomerId && (
                        <button
                            onClick={handleOpenPortal}
                            disabled={portalLoading || !isOwner}
                            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 rounded-xl transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {portalLoading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Abrindo portal...</>
                            ) : (
                                <><CreditCard className="w-4 h-4" /> Gerenciar Assinatura</>
                            )}
                        </button>
                    )}
                </div>

                {message && (
                    <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-200">
                        {message}
                    </div>
                )}

                {!isOwner && (
                    <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-100">
                        Apenas o dono do workspace pode iniciar ou gerenciar assinatura.
                    </div>
                )}

                <button
                    onClick={() => signOut()}
                    className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 text-sm py-2"
                >
                    <LogOut className="w-4 h-4" /> Sair da conta
                </button>
            </div>
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Carregando...</div>}>
            <CheckoutContent />
        </Suspense>
    );
}
