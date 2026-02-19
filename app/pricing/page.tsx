"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Check, ArrowRight } from "lucide-react";

type BillingPlan = "monthly" | "yearly";

export default function PricingPage() {
    const { user, loading, signInWithGoogle } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) {
            router.push("/checkout");
        }
    }, [user, loading, router]);

    const startCheckout = async (plan: BillingPlan) => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem("checkout:preferredPlan", plan);
        }

        if (user) {
            router.push(`/checkout?plan=${plan}`);
            return;
        }

        await signInWithGoogle();
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <div className="max-w-5xl mx-auto px-4 py-16">
                <div className="text-center mb-12">
                    <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
                        ← Voltar
                    </Link>
                    <h1 className="text-4xl md:text-5xl font-bold mt-4">Escolha seu plano</h1>
                    <p className="text-slate-400 mt-3">7 dias de teste grátis para qualquer plano.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                        <h2 className="text-2xl font-semibold">Mensal</h2>
                        <p className="text-slate-400 mt-1">Ideal para começar rápido.</p>
                        <div className="text-3xl font-bold mt-6">R$ 49<span className="text-base text-slate-400 font-normal">/mês</span></div>
                        <ul className="space-y-2 mt-6 text-sm text-slate-200">
                            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Dashboard completo</li>
                            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Contas, cartões e contas fixas</li>
                            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Suporte prioritário</li>
                        </ul>
                        <button
                            onClick={() => startCheckout("monthly")}
                            className="w-full mt-8 bg-white text-slate-900 py-3 rounded-xl font-semibold hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-2"
                        >
                            Começar com Google <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="rounded-2xl border border-blue-500/50 bg-slate-900 p-6 relative">
                        <span className="absolute -top-3 left-6 bg-blue-600 text-white text-xs px-3 py-1 rounded-full">Mais vantajoso</span>
                        <h2 className="text-2xl font-semibold">Anual</h2>
                        <p className="text-slate-400 mt-1">Economize no longo prazo.</p>
                        <div className="text-3xl font-bold mt-6">R$ 97<span className="text-base text-slate-400 font-normal">/ano</span></div>
                        <p className="text-xs text-blue-300 mt-1">equivalente a R$ 8,08/mês</p>
                        <ul className="space-y-2 mt-6 text-sm text-slate-200">
                            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Tudo do plano mensal</li>
                            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Melhor custo-benefício</li>
                            <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Renovação automática</li>
                        </ul>
                        <button
                            onClick={() => startCheckout("yearly")}
                            className="w-full mt-8 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-500 transition-colors inline-flex items-center justify-center gap-2"
                        >
                            Começar com Google <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="text-center text-xs text-slate-500 mt-8">
                    Ao assinar, você concorda com os{" "}
                    <Link href="/termos" className="text-slate-300 hover:underline">Termos</Link>,{" "}
                    <Link href="/privacidade" className="text-slate-300 hover:underline">Privacidade</Link> e{" "}
                    <Link href="/politica-comercial" className="text-slate-300 hover:underline">Política Comercial</Link>.
                    {" "}Precisa de ajuda?{" "}
                    <Link href="/suporte" className="text-slate-300 hover:underline">Suporte</Link>.
                </div>
            </div>
        </div>
    );
}
