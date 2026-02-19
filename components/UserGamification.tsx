"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { WorkspaceBehavioralMetrics } from "@/types";
import { Lock, Sparkles } from "lucide-react";

type CityStage = 1 | 2 | 3;
type DistrictKey = "core" | "invest" | "leisure" | "family";

type IsoPalette = {
    top: string;
    left: string;
    right: string;
    ground: string;
    stroke: string;
    districtCore: string;
    districtInvest: string;
    districtLeisure: string;
    districtFamily: string;
    nodeActive: string;
    nodeLocked: string;
    nodeCurrent: string;
};

type IsoCube = {
    x: number;
    y: number;
    size: number;
    height: number;
    district: DistrictKey;
    opacity?: number;
};

type Milestone = {
    days: number;
    label: string;
    reward: string;
};

function toCityStage(metrics: WorkspaceBehavioralMetrics): CityStage {
    if (metrics.structureStage === "consolidation") return 3;
    if (metrics.structureStage === "growth") return 2;
    return 1;
}

function toStageLabel(stage: CityStage) {
    if (stage === 3) return "Metrópole";
    if (stage === 2) return "Prédio";
    return "Residência";
}

function toRoleLabel(role: WorkspaceBehavioralMetrics["maturityRole"]) {
    if (role === "magnata") return "Magnata";
    if (role === "gestor_urbano") return "Gestor Urbano";
    if (role === "construtor") return "Construtor";
    return "Arquiteto";
}

function getPalette(isEnergized: boolean): IsoPalette {
    if (!isEnergized) {
        return {
            top: "#cbd5e1",
            left: "#94a3b8",
            right: "#64748b",
            ground: "#e2e8f0",
            stroke: "#94a3b8",
            districtCore: "#94a3b833",
            districtInvest: "#94a3b822",
            districtLeisure: "#94a3b81d",
            districtFamily: "#94a3b81a",
            nodeActive: "#64748b",
            nodeLocked: "#cbd5e1",
            nodeCurrent: "#334155",
        };
    }

    return {
        top: "#60a5fa",
        left: "#2563eb",
        right: "#1d4ed8",
        ground: "#bfdbfe",
        stroke: "#93c5fd",
        districtCore: "#60a5fa33",
        districtInvest: "#22d3ee2e",
        districtLeisure: "#a78bfa29",
        districtFamily: "#34d39924",
        nodeActive: "#2563eb",
        nodeLocked: "#bfdbfe",
        nodeCurrent: "#1d4ed8",
    };
}

function cubePolygons(cube: IsoCube) {
    const q = cube.size * 0.56;
    const topY = cube.y - cube.height;

    const top = [
        [cube.x, topY - q],
        [cube.x + cube.size, topY],
        [cube.x, topY + q],
        [cube.x - cube.size, topY],
    ];

    const base = [
        [cube.x, cube.y - q],
        [cube.x + cube.size, cube.y],
        [cube.x, cube.y + q],
        [cube.x - cube.size, cube.y],
    ];

    return {
        top: top.map(([x, y]) => `${x},${y}`).join(" "),
        left: [top[3], top[2], base[2], base[3]].map(([x, y]) => `${x},${y}`).join(" "),
        right: [top[1], top[2], base[2], base[1]].map(([x, y]) => `${x},${y}`).join(" "),
    };
}

function stageCubes(stage: CityStage): IsoCube[] {
    if (stage === 1) {
        return [{ x: 210, y: 166, size: 56, height: 64, district: "core" }];
    }

    if (stage === 2) {
        return [
            { x: 206, y: 182, size: 58, height: 44, district: "core" },
            { x: 206, y: 154, size: 52, height: 46, district: "core" },
            { x: 206, y: 122, size: 45, height: 40, district: "core" },
            { x: 276, y: 188, size: 34, height: 34, district: "leisure", opacity: 0.92 },
            { x: 146, y: 192, size: 30, height: 30, district: "family", opacity: 0.9 },
        ];
    }

    return [
        { x: 210, y: 178, size: 52, height: 96, district: "core", opacity: 1 },
        { x: 164, y: 186, size: 42, height: 70, district: "core", opacity: 0.98 },
        { x: 256, y: 182, size: 42, height: 74, district: "core", opacity: 0.98 },
        { x: 110, y: 196, size: 32, height: 46, district: "invest", opacity: 0.94 },
        { x: 144, y: 188, size: 34, height: 58, district: "invest", opacity: 0.96 },
        { x: 312, y: 200, size: 30, height: 42, district: "leisure", opacity: 0.9 },
        { x: 282, y: 194, size: 34, height: 54, district: "leisure", opacity: 0.94 },
        { x: 182, y: 212, size: 28, height: 30, district: "family", opacity: 0.9 },
        { x: 240, y: 212, size: 28, height: 32, district: "family", opacity: 0.9 },
        { x: 82, y: 206, size: 26, height: 28, district: "invest", opacity: 0.86 },
        { x: 334, y: 210, size: 24, height: 24, district: "leisure", opacity: 0.84 },
    ];
}

function districtNodeLabel(district: DistrictKey) {
    if (district === "invest") return "Investimentos";
    if (district === "leisure") return "Lazer";
    if (district === "family") return "Familiar";
    return "Centro";
}

function districtUnlocked(district: DistrictKey, metrics: WorkspaceBehavioralMetrics) {
    if (district === "core") return true;
    if (district === "invest") return (metrics.maturityScore || 0) >= 900 || metrics.structureStage !== "foundation";
    if (district === "leisure") return (metrics.maturityScore || 0) >= 1500 || metrics.structureStage === "consolidation";
    return (metrics.consistencyIndex || 0) >= 120;
}

function progressMilestones(): Milestone[] {
    return [
        { days: 1, label: "Base", reward: "Terreno energizado" },
        { days: 3, label: "Rua", reward: "Infraestrutura inicial" },
        { days: 7, label: "Iluminação", reward: "Cidade ativa à noite" },
        { days: 14, label: "Condomínio", reward: "Blocos residenciais" },
        { days: 30, label: "Distrito", reward: "Expansão urbana" },
        { days: 60, label: "Avenidas", reward: "Fluxo da cidade otimizado" },
        { days: 90, label: "Skyline", reward: "Primeiros arranha-céus" },
        { days: 180, label: "Hub", reward: "Centro financeiro avançado" },
        { days: 365, label: "Metrópole", reward: "Cidade em escala total" },
    ];
}

function nextTargetDays(stage: CityStage) {
    if (stage === 1) return 90;
    if (stage === 2) return 365;
    return null;
}

function stageProgress(stage: CityStage, consistencyIndex: number) {
    if (stage === 1) return Math.min(100, Math.round((consistencyIndex / 90) * 100));
    if (stage === 2) return Math.min(100, Math.round(((consistencyIndex - 90) / (365 - 90)) * 100));
    return 100;
}

function CityVisualizer({
    stage,
    isEnergized,
    highlightDistrict,
}: {
    stage: CityStage;
    isEnergized: boolean;
    highlightDistrict: DistrictKey;
}) {
    const palette = getPalette(isEnergized);
    const cubes = stageCubes(stage);

    return (
        <svg viewBox="0 0 420 300" className="h-full w-full" role="img" aria-label="Visual da cidade financeira">
            <defs>
                <linearGradient id="citySky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isEnergized ? "#0f172a" : "#111827"} />
                    <stop offset="100%" stopColor={isEnergized ? "#1e293b" : "#1f2937"} />
                </linearGradient>
                <filter id="cityGlow" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={isEnergized ? "#60a5fa" : "#94a3b8"} floodOpacity={isEnergized ? "0.65" : "0.2"} />
                </filter>
                <filter id="districtGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor={isEnergized ? "#7dd3fc" : "#94a3b8"} floodOpacity={isEnergized ? "0.7" : "0.18"} />
                </filter>
            </defs>

            <rect x="0" y="0" width="420" height="300" fill="url(#citySky)" />

            <polygon
                points="44,198 210,104 376,198 210,292"
                fill={palette.ground}
                opacity={isEnergized ? 0.2 : 0.12}
            />
            <polygon
                points="74,198 210,122 346,198 210,274"
                fill={palette.ground}
                opacity={isEnergized ? 0.12 : 0.08}
            />

            <polygon points="118,204 210,152 282,194 188,244" fill={palette.districtCore} opacity={highlightDistrict === "core" ? 0.7 : 0.3} filter={highlightDistrict === "core" ? "url(#districtGlow)" : undefined} />
            <polygon points="54,206 134,160 178,184 98,228" fill={palette.districtInvest} opacity={highlightDistrict === "invest" ? 0.72 : 0.24} filter={highlightDistrict === "invest" ? "url(#districtGlow)" : undefined} />
            <polygon points="282,194 346,198 320,226 262,222" fill={palette.districtLeisure} opacity={highlightDistrict === "leisure" ? 0.72 : 0.24} filter={highlightDistrict === "leisure" ? "url(#districtGlow)" : undefined} />
            <polygon points="176,220 246,218 224,250 158,252" fill={palette.districtFamily} opacity={highlightDistrict === "family" ? 0.72 : 0.24} filter={highlightDistrict === "family" ? "url(#districtGlow)" : undefined} />

            <g className={isEnergized ? "city-float" : undefined} filter={isEnergized ? "url(#cityGlow)" : undefined}>
                {cubes.map((cube, index) => {
                    const polygons = cubePolygons(cube);
                    const opacity = cube.opacity ?? 1;
                    const isHighlighted = cube.district === highlightDistrict;
                    return (
                        <g
                            key={`${cube.x}-${cube.y}-${index}`}
                            opacity={opacity}
                            className={isHighlighted ? "district-highlight" : undefined}
                        >
                            <polygon
                                points={polygons.left}
                                fill={palette.left}
                                stroke={palette.stroke}
                                strokeWidth={isHighlighted ? "1.15" : "0.8"}
                                opacity={isHighlighted ? 1 : 0.9}
                            />
                            <polygon
                                points={polygons.right}
                                fill={palette.right}
                                stroke={palette.stroke}
                                strokeWidth={isHighlighted ? "1.15" : "0.8"}
                                opacity={isHighlighted ? 1 : 0.9}
                            />
                            <polygon
                                points={polygons.top}
                                fill={palette.top}
                                stroke={palette.stroke}
                                strokeWidth={isHighlighted ? "1.15" : "0.8"}
                                opacity={isHighlighted ? 1 : 0.92}
                            />
                        </g>
                    );
                })}
            </g>

            <style>{`
                .city-float {
                    animation: cityFloat 4.6s ease-in-out infinite;
                    transform-origin: 210px 196px;
                }
                .district-highlight {
                    animation: districtPulse 2.2s ease-in-out infinite;
                }
                @keyframes cityFloat {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-3px); }
                }
                @keyframes districtPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.82; }
                }
            `}</style>
        </svg>
    );
}

type UserGamificationProps = {
    metrics: WorkspaceBehavioralMetrics;
    membersCount: number;
    className?: string;
};

export function UserGamification({ metrics, membersCount, className = "" }: UserGamificationProps) {
    const stage = toCityStage(metrics);
    const isEnergized = (metrics.inactiveDays || 0) === 0;
    const palette = getPalette(isEnergized);
    const districts: Array<{ key: DistrictKey; title: string; subtitle: string }> = [
        { key: "core", title: "Centro", subtitle: "Núcleo financeiro da cidade" },
        { key: "invest", title: "Investimentos", subtitle: "Capital em expansão" },
        { key: "leisure", title: "Lazer", subtitle: "Qualidade de vida e recompensas" },
        { key: "family", title: "Familiar", subtitle: "Base de segurança do casal" },
    ];
    const [selectedDistrict, setSelectedDistrict] = useState<DistrictKey>("core");
    const milestones = useMemo(() => progressMilestones(), []);
    const [selectedMilestoneIndex, setSelectedMilestoneIndex] = useState(0);
    const consistencyIndex = metrics.consistencyIndex || 0;
    const progress = stageProgress(stage, consistencyIndex);
    const nextTarget = nextTargetDays(stage);
    const daysToNext = nextTarget ? Math.max(0, nextTarget - consistencyIndex) : 0;
    const selectedMilestone = milestones[selectedMilestoneIndex] || milestones[0];
    const unlockedMilestones = milestones.filter((milestone) => consistencyIndex >= milestone.days).length;

    return (
        <section className={`card overflow-hidden ${className}`}>
            <div className="h-[460px] md:h-[560px] flex flex-col bg-slate-950">
                <div className="relative basis-[70%] min-h-0">
                    <CityVisualizer stage={stage} isEnergized={isEnergized} highlightDistrict={selectedDistrict} />
                    <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center">
                        <div className="rounded-full border border-white/15 bg-slate-900/50 px-3 py-1 text-[11px] font-medium text-slate-100 backdrop-blur">
                            Estágio {stage} · {toStageLabel(stage)}
                        </div>
                    </div>

                    <div className="absolute left-3 right-3 bottom-3 z-10 grid grid-cols-2 md:grid-cols-4 gap-2">
                        {districts.map((district) => {
                            const unlocked = districtUnlocked(district.key, metrics);
                            const selected = selectedDistrict === district.key;
                            return (
                                <button
                                    key={district.key}
                                    type="button"
                                    onClick={() => unlocked && setSelectedDistrict(district.key)}
                                    className={`rounded-xl border px-3 py-2 text-left transition-all backdrop-blur ${selected
                                        ? "border-white/50 bg-white/20"
                                        : "border-white/20 bg-slate-900/35 hover:bg-slate-900/50"
                                        } ${unlocked ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                                >
                                    <p className="text-[11px] font-semibold text-white inline-flex items-center gap-1">
                                        {!unlocked && <Lock className="w-3 h-3" />}
                                        {district.title}
                                    </p>
                                    <p className="text-[10px] text-slate-200/80 truncate">{district.subtitle}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <footer className="basis-[30%] border-t border-slate-700 bg-slate-900 px-4 py-3 md:px-5 flex flex-col gap-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                        <div>
                            <p className="uppercase tracking-wide text-[10px] text-slate-400">Nível</p>
                            <p className="text-slate-100 font-semibold">{toRoleLabel(metrics.maturityRole)}</p>
                        </div>
                        <div>
                            <p className="uppercase tracking-wide text-[10px] text-slate-400">Consistência</p>
                            <p className="text-slate-100 font-semibold">{consistencyIndex} dias</p>
                        </div>
                        <div>
                            <p className="uppercase tracking-wide text-[10px] text-slate-400">Maturidade</p>
                            <p className="text-slate-100 font-semibold">{metrics.maturityScore}</p>
                        </div>
                        <div>
                            <p className="uppercase tracking-wide text-[10px] text-slate-400">Modo Casal</p>
                            <p className="text-slate-100 font-semibold">
                                {membersCount > 1 ? `${metrics.sharedConsistencyIndex || 0}% ativo` : "Individual"}
                            </p>
                        </div>
                        <div>
                            <p className="uppercase tracking-wide text-[10px] text-slate-400">Distrito ativo</p>
                            <p className="text-slate-100 font-semibold">{districtNodeLabel(selectedDistrict)}</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-700 bg-slate-950/65 px-3 py-2">
                        <div className="flex items-center justify-between text-[11px]">
                            <p className="text-slate-300 inline-flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-cyan-300" />
                                Trilha de Progresso
                            </p>
                            {nextTarget ? (
                                <p className="text-slate-400">{daysToNext} dia(s) para próxima fase</p>
                            ) : (
                                <p className="text-cyan-200">Cidade no estágio máximo atual</p>
                            )}
                        </div>
                        <div className="mt-2 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: palette.nodeActive }} />
                        </div>
                        <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            {milestones.map((milestone, index) => {
                                const unlocked = consistencyIndex >= milestone.days;
                                const currentTarget = !unlocked && (index === unlockedMilestones);
                                return (
                                    <button
                                        key={milestone.days}
                                        type="button"
                                        onClick={() => setSelectedMilestoneIndex(index)}
                                        className={`relative shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition-all ${selectedMilestoneIndex === index
                                            ? "border-cyan-300 bg-cyan-500/15 text-cyan-100"
                                            : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                                            }`}
                                    >
                                        <span
                                            className="inline-block w-2 h-2 rounded-full mr-1"
                                            style={{
                                                backgroundColor: unlocked ? palette.nodeActive : currentTarget ? palette.nodeCurrent : palette.nodeLocked,
                                            }}
                                        />
                                        {milestone.days}d
                                        {currentTarget && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-300 animate-ping" />}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-300">
                            <strong>{selectedMilestone.label}</strong> · {selectedMilestone.reward}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link href="/dashboard/lancamentos" className="btn-primary !py-2 !px-3 text-xs">
                            Registrar agora
                        </Link>
                        <Link href="/dashboard/contas-fixas" className="btn-secondary !py-2 !px-3 text-xs">
                            Completar missão do dia
                        </Link>
                    </div>
                </footer>
            </div>
        </section>
    );
}
