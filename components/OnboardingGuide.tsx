"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Sparkles, X } from "lucide-react";

type OnboardingGuideProps = {
    workspaceId?: string;
    accountsCount: number;
    cardsCount: number;
    transactionsCount: number;
    recurringBillsCount: number;
};

type Step = {
    key: string;
    title: string;
    done: boolean;
    href: string;
    cta: string;
};

function getStorageKey(workspaceId?: string) {
    return `financeiro:onboarding:dismissed:${workspaceId || "unknown"}`;
}

export function OnboardingGuide({
    workspaceId,
    accountsCount,
    cardsCount,
    transactionsCount,
    recurringBillsCount,
}: OnboardingGuideProps) {
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const key = getStorageKey(workspaceId);
        setDismissed(window.localStorage.getItem(key) === "1");
    }, [workspaceId]);

    const steps = useMemo<Step[]>(
        () => [
            {
                key: "accounts",
                title: "Cadastre sua primeira conta",
                done: accountsCount > 0,
                href: "/dashboard/contas",
                cta: "Ir para Contas",
            },
            {
                key: "cards",
                title: "Cadastre ao menos um cartão",
                done: cardsCount > 0,
                href: "/dashboard/cartoes",
                cta: "Ir para Cartões",
            },
            {
                key: "transactions",
                title: "Registre seu primeiro lançamento",
                done: transactionsCount > 0,
                href: "/dashboard/lancamentos",
                cta: "Ir para Lançamentos",
            },
            {
                key: "bills",
                title: "Configure uma conta fixa recorrente",
                done: recurringBillsCount > 0,
                href: "/dashboard/contas-fixas",
                cta: "Ir para Contas Fixas",
            },
        ],
        [accountsCount, cardsCount, transactionsCount, recurringBillsCount]
    );

    const completedCount = steps.filter((step) => step.done).length;
    const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
    const allDone = completedCount === steps.length;

    if (dismissed) return null;

    return (
        <section className="card p-5 mb-6">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <p className="text-sm font-medium text-primary-700 inline-flex items-center gap-1">
                        <Sparkles className="w-4 h-4" />
                        Onboarding Guiado
                    </p>
                    <h2 className="text-lg font-semibold text-slate-900 mt-1">
                        {allDone ? "Setup inicial concluído" : "Primeiros passos para operar com segurança"}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        {completedCount}/{steps.length} etapas concluídas ({progress}%).
                    </p>
                </div>
                <button
                    onClick={() => {
                        if (typeof window !== "undefined") {
                            window.localStorage.setItem(getStorageKey(workspaceId), "1");
                        }
                        setDismissed(true);
                    }}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    title="Ocultar onboarding"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                <div
                    className="h-full bg-primary-500 transition-all"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {steps.map((step) => (
                    <div key={step.key} className="border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className={`text-sm font-medium ${step.done ? "text-green-700" : "text-slate-700"}`}>
                                {step.done ? (
                                    <span className="inline-flex items-center gap-1">
                                        <CheckCircle2 className="w-4 h-4" />
                                        {step.title}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1">
                                        <Circle className="w-4 h-4" />
                                        {step.title}
                                    </span>
                                )}
                            </p>
                        </div>
                        {!step.done && (
                            <Link href={step.href} className="text-xs font-medium text-primary-600 hover:text-primary-700 whitespace-nowrap">
                                {step.cta}
                            </Link>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
