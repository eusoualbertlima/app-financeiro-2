"use client";

import type { WorkspaceBehavioralMetrics } from "@/types";

type CityStage = 1 | 2 | 3;

type IsoPalette = {
    top: string;
    left: string;
    right: string;
    ground: string;
    stroke: string;
};

type IsoCube = {
    x: number;
    y: number;
    size: number;
    height: number;
    opacity?: number;
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
        };
    }

    return {
        top: "#60a5fa",
        left: "#2563eb",
        right: "#1d4ed8",
        ground: "#bfdbfe",
        stroke: "#93c5fd",
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
        return [{ x: 190, y: 180, size: 52, height: 54 }];
    }

    if (stage === 2) {
        return [
            { x: 190, y: 184, size: 58, height: 42 },
            { x: 190, y: 154, size: 50, height: 40 },
            { x: 190, y: 126, size: 44, height: 36 },
        ];
    }

    return [
        { x: 102, y: 188, size: 34, height: 40, opacity: 0.95 },
        { x: 150, y: 176, size: 40, height: 64, opacity: 1 },
        { x: 190, y: 184, size: 46, height: 86, opacity: 1 },
        { x: 236, y: 174, size: 40, height: 70, opacity: 0.98 },
        { x: 278, y: 186, size: 34, height: 50, opacity: 0.94 },
        { x: 170, y: 202, size: 30, height: 28, opacity: 0.86 },
        { x: 224, y: 204, size: 30, height: 32, opacity: 0.88 },
    ];
}

function CityVisualizer({ stage, isEnergized }: { stage: CityStage; isEnergized: boolean }) {
    const palette = getPalette(isEnergized);
    const cubes = stageCubes(stage);

    return (
        <svg viewBox="0 0 380 260" className="h-full w-full" role="img" aria-label="Visual da cidade financeira">
            <defs>
                <linearGradient id="citySky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isEnergized ? "#0f172a" : "#111827"} />
                    <stop offset="100%" stopColor={isEnergized ? "#1e293b" : "#1f2937"} />
                </linearGradient>
                <filter id="cityGlow" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={isEnergized ? "#60a5fa" : "#94a3b8"} floodOpacity={isEnergized ? "0.65" : "0.2"} />
                </filter>
            </defs>

            <rect x="0" y="0" width="380" height="260" fill="url(#citySky)" />

            <polygon
                points="40,188 190,102 340,188 190,274"
                fill={palette.ground}
                opacity={isEnergized ? 0.2 : 0.12}
            />
            <polygon
                points="64,188 190,116 316,188 190,260"
                fill={palette.ground}
                opacity={isEnergized ? 0.12 : 0.08}
            />

            <g filter={isEnergized ? "url(#cityGlow)" : undefined}>
                {cubes.map((cube, index) => {
                    const polygons = cubePolygons(cube);
                    const opacity = cube.opacity ?? 1;
                    return (
                        <g key={`${cube.x}-${cube.y}-${index}`} opacity={opacity}>
                            <polygon points={polygons.left} fill={palette.left} stroke={palette.stroke} strokeWidth="0.8" />
                            <polygon points={polygons.right} fill={palette.right} stroke={palette.stroke} strokeWidth="0.8" />
                            <polygon points={polygons.top} fill={palette.top} stroke={palette.stroke} strokeWidth="0.8" />
                        </g>
                    );
                })}
            </g>
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

    return (
        <section className={`card overflow-hidden ${className}`}>
            <div className="grid h-[360px] md:h-[420px] grid-rows-[7fr_3fr]">
                <div className="relative">
                    <CityVisualizer stage={stage} isEnergized={isEnergized} />
                    <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
                        <div className="rounded-full border border-white/15 bg-slate-900/50 px-3 py-1 text-[11px] font-medium text-slate-100 backdrop-blur">
                            Estágio {stage} · {toStageLabel(stage)}
                        </div>
                    </div>
                </div>

                <footer className="border-t border-slate-200/80 bg-white px-4 py-3 md:px-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-500">
                        <div>
                            <p className="uppercase tracking-wide text-[10px]">Nível</p>
                            <p className="text-slate-800 font-semibold">{toRoleLabel(metrics.maturityRole)}</p>
                        </div>
                        <div>
                            <p className="uppercase tracking-wide text-[10px]">Consistência</p>
                            <p className="text-slate-800 font-semibold">{metrics.consistencyIndex} dias</p>
                        </div>
                        <div>
                            <p className="uppercase tracking-wide text-[10px]">Maturidade</p>
                            <p className="text-slate-800 font-semibold">{metrics.maturityScore}</p>
                        </div>
                        <div>
                            <p className="uppercase tracking-wide text-[10px]">Modo Casal</p>
                            <p className="text-slate-800 font-semibold">
                                {membersCount > 1 ? `${metrics.sharedConsistencyIndex || 0}% ativo` : "Individual"}
                            </p>
                        </div>
                    </div>
                </footer>
            </div>
        </section>
    );
}
