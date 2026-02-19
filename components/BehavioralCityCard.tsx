"use client";

import type { WorkspaceBehavioralMetrics } from "@/types";
import { Building2, Zap, TimerReset, Users } from "lucide-react";

const energyStateLabels: Record<NonNullable<WorkspaceBehavioralMetrics["cityEnergyState"]>, string> = {
    energized: "Cidade energizada",
    flicker: "Luzes piscando",
    blackout_partial: "Apagão parcial",
    abandoned: "Cidade em modo abandono",
};

const energyStateColors: Record<NonNullable<WorkspaceBehavioralMetrics["cityEnergyState"]>, string> = {
    energized: "text-green-600",
    flicker: "text-amber-600",
    blackout_partial: "text-orange-600",
    abandoned: "text-slate-500",
};

const sharedStateLabels: Record<NonNullable<WorkspaceBehavioralMetrics["sharedConsistencyState"]>, string> = {
    energized: "Casal sincronizado",
    flicker: "Atenção do casal hoje",
    blackout_partial: "Consistência compartilhada em risco",
    abandoned: "Rotina do casal desconectada",
};

function resolveStageLabel(metrics: WorkspaceBehavioralMetrics) {
    if (metrics.maturityRole === "magnata") return "Fase 4 · Metrópole";
    if (metrics.structureStage === "consolidation") return "Fase 3 · Centro Financeiro";
    if (metrics.structureStage === "growth") return "Fase 2 · Bairro";
    return "Fase 1 · Residência";
}

function resolveRoleLabel(role: WorkspaceBehavioralMetrics["maturityRole"]) {
    if (role === "magnata") return "Magnata";
    if (role === "gestor_urbano") return "Gestor Urbano";
    if (role === "construtor") return "Construtor";
    return "Arquiteto";
}

type BehavioralCityCardProps = {
    metrics: WorkspaceBehavioralMetrics;
    membersCount: number;
};

export function BehavioralCityCard({ metrics, membersCount }: BehavioralCityCardProps) {
    const energyState = metrics.cityEnergyState || "energized";
    const sharedState = metrics.sharedConsistencyState || "energized";
    const inactiveDays = metrics.inactiveDays || 0;
    const consistencyIndex = metrics.consistencyIndex || 0;
    const sharedConsistencyIndex = metrics.sharedConsistencyIndex || 0;

    return (
        <div className="card p-5 mb-6 border-l-4 border-primary-500">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm text-slate-500 mb-1">Metrópole Financeira</p>
                    <h3 className="text-lg font-semibold text-slate-900">{resolveStageLabel(metrics)}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Cargo atual: <strong className="text-slate-700">{resolveRoleLabel(metrics.maturityRole)}</strong>
                    </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-primary-50 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary-600" />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Consistência</p>
                    <p className="text-xl font-bold text-slate-900">{consistencyIndex} dia(s)</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Pontuação de Maturidade</p>
                    <p className="text-xl font-bold text-slate-900">{metrics.maturityScore}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Dias sem ação</p>
                    <p className="text-xl font-bold text-slate-900">{inactiveDays}</p>
                </div>
            </div>

            <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                    <Zap className={`w-4 h-4 ${energyStateColors[energyState]}`} />
                    <span className={`${energyStateColors[energyState]} font-medium`}>
                        {energyStateLabels[energyState]}
                    </span>
                </div>

                {membersCount > 1 && (
                    <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-slate-600" />
                        <span className="text-slate-700">
                            {sharedStateLabels[sharedState]} • {sharedConsistencyIndex}% ativo
                        </span>
                    </div>
                )}

                {inactiveDays > 0 && (
                    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                        <TimerReset className="w-4 h-4" />
                        A cidade reage diariamente. Faça um registro hoje para reacender tudo.
                    </div>
                )}
            </div>
        </div>
    );
}
