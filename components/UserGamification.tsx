"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import type { WorkspaceBehavioralMetrics } from "@/types";
import { CheckCircle2, Lock, Sparkles } from "lucide-react";

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
            top: "#d1d5db",
            left: "#9ca3af",
            right: "#6b7280",
            ground: "#cbd5e1",
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
        top: "#93c5fd",
        left: "#3b82f6",
        right: "#2563eb",
        ground: "#bfdbfe",
        stroke: "#dbeafe",
        districtCore: "#60a5fa45",
        districtInvest: "#22d3ee35",
        districtLeisure: "#a78bfa38",
        districtFamily: "#34d39932",
        nodeActive: "#2563eb",
        nodeLocked: "#bfdbfe",
        nodeCurrent: "#1d4ed8",
    };
}

function cubePolygons(cube: IsoCube) {
    const q = cube.size * 0.56;
    const topY = cube.y - cube.height;

    const top: [number, number][] = [
        [cube.x, topY - q],
        [cube.x + cube.size, topY],
        [cube.x, topY + q],
        [cube.x - cube.size, topY],
    ];

    const base: [number, number][] = [
        [cube.x, cube.y - q],
        [cube.x + cube.size, cube.y],
        [cube.x, cube.y + q],
        [cube.x - cube.size, cube.y],
    ];

    const left: [number, number][] = [top[3], top[2], base[2], base[3]];
    const right: [number, number][] = [top[1], top[2], base[2], base[1]];

    return {
        top,
        left,
        right,
        topPath: top.map(([x, y]) => `${x},${y}`).join(" "),
        leftPath: left.map(([x, y]) => `${x},${y}`).join(" "),
        rightPath: right.map(([x, y]) => `${x},${y}`).join(" "),
    };
}

function stageCubes(stage: CityStage): IsoCube[] {
    if (stage === 1) {
        return [{ x: 210, y: 204, size: 48, height: 44, district: "core" }];
    }

    if (stage === 2) {
        return [
            { x: 210, y: 212, size: 48, height: 36, district: "core" },
            { x: 210, y: 185, size: 42, height: 34, district: "core" },
            { x: 210, y: 160, size: 36, height: 32, district: "core" },
            { x: 274, y: 214, size: 28, height: 30, district: "leisure", opacity: 0.94 },
            { x: 146, y: 216, size: 26, height: 28, district: "family", opacity: 0.94 },
        ];
    }

    return [
        { x: 210, y: 208, size: 50, height: 104, district: "core", opacity: 1 },
        { x: 164, y: 214, size: 40, height: 78, district: "core", opacity: 0.98 },
        { x: 258, y: 212, size: 40, height: 82, district: "core", opacity: 0.98 },
        { x: 114, y: 222, size: 32, height: 56, district: "invest", opacity: 0.95 },
        { x: 146, y: 216, size: 34, height: 70, district: "invest", opacity: 0.96 },
        { x: 308, y: 224, size: 30, height: 48, district: "leisure", opacity: 0.92 },
        { x: 282, y: 218, size: 34, height: 62, district: "leisure", opacity: 0.95 },
        { x: 182, y: 232, size: 26, height: 36, district: "family", opacity: 0.9 },
        { x: 240, y: 232, size: 26, height: 38, district: "family", opacity: 0.9 },
        { x: 86, y: 228, size: 24, height: 30, district: "invest", opacity: 0.86 },
        { x: 334, y: 230, size: 24, height: 28, district: "leisure", opacity: 0.84 },
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

function interpolatePair(a: [number, number], b: [number, number], t: number): [number, number] {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function facePoint(face: [number, number][], u: number, v: number): [number, number] {
    const topEdge = interpolatePair(face[0], face[1], u);
    const bottomEdge = interpolatePair(face[3], face[2], u);
    return interpolatePair(topEdge, bottomEdge, v);
}

function faceWindows(face: [number, number][], rows: number, cols: number) {
    const windows: Array<[number, number]> = [];
    for (let row = 1; row <= rows; row += 1) {
        for (let col = 1; col <= cols; col += 1) {
            const u = col / (cols + 1);
            const v = row / (rows + 1);
            windows.push(facePoint(face, u, v));
        }
    }
    return windows;
}

function districtAccentColor(district: DistrictKey) {
    if (district === "invest") return "#67e8f9";
    if (district === "leisure") return "#c4b5fd";
    if (district === "family") return "#6ee7b7";
    return "#fde68a";
}

function CityVisualizer({
    stage,
    isEnergized,
    didRecordToday,
    highlightDistrict,
}: {
    stage: CityStage;
    isEnergized: boolean;
    didRecordToday: boolean;
    highlightDistrict: DistrictKey;
}) {
    const palette = getPalette(isEnergized);
    const cubes = stageCubes(stage);
    const skyTop = isEnergized ? "#0f172a" : "#1f2937";
    const skyBottom = isEnergized ? "#1d4ed8" : "#374151";
    const cloudColor = isEnergized ? "#dbeafe" : "#9ca3af";
    const cloudShade = isEnergized ? "#bfdbfe" : "#6b7280";
    const sunColor = isEnergized ? "#fde68a" : "#6b7280";
    const roadColor = isEnergized ? "#1e3a8a" : "#475569";
    const roadLineColor = isEnergized ? "#fef3c7" : "#94a3b8";
    const parkColor = isEnergized ? "#86efac" : "#94a3b8";
    const treeLeaf = isEnergized ? "#34d399" : "#9ca3af";
    const treeTrunk = isEnergized ? "#8b5e3c" : "#6b7280";
    const windowOn = isEnergized ? "#fef08a" : "#f3f4f6";
    const windowOff = isEnergized ? "#93c5fd" : "#475569";
    const cloudGroups = [
        { x: 86, y: 60, scale: 1, delay: "0ms" },
        { x: 168, y: 48, scale: 0.8, delay: "900ms" },
        { x: 302, y: 66, scale: 0.95, delay: "1700ms" },
    ];
    const trees = [
        { x: 88, y: 212, scale: 0.9 },
        { x: 126, y: 230, scale: 0.8 },
        { x: 170, y: 244, scale: 0.74 },
        { x: 250, y: 246, scale: 0.74 },
        { x: 296, y: 230, scale: 0.82 },
        { x: 332, y: 214, scale: 0.9 },
    ];
    const skySparkles = [
        { x: 116, y: 82, r: 1.6, delay: "0ms" },
        { x: 194, y: 56, r: 1.4, delay: "600ms" },
        { x: 282, y: 78, r: 1.5, delay: "1100ms" },
        { x: 334, y: 98, r: 1.2, delay: "1500ms" },
    ];
    const lightPoints = [
        { x: 102, y: 244, r: 2.1, delay: "0ms" },
        { x: 138, y: 228, r: 2.3, delay: "160ms" },
        { x: 178, y: 252, r: 2.4, delay: "320ms" },
        { x: 210, y: 238, r: 2.6, delay: "90ms" },
        { x: 244, y: 252, r: 2.1, delay: "260ms" },
        { x: 282, y: 228, r: 2.2, delay: "430ms" },
        { x: 320, y: 242, r: 2.0, delay: "520ms" },
    ];

    return (
        <svg
            viewBox="0 0 420 300"
            preserveAspectRatio="xMidYMid slice"
            className="h-full w-full"
            role="img"
            aria-label="Visual da cidade financeira"
        >
            <defs>
                <linearGradient id="citySky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={skyTop} />
                    <stop offset="100%" stopColor={skyBottom} />
                </linearGradient>
                <linearGradient id="cityGround" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette.ground} stopOpacity={isEnergized ? 0.4 : 0.22} />
                    <stop offset="100%" stopColor={palette.ground} stopOpacity={isEnergized ? 0.14 : 0.08} />
                </linearGradient>
                <linearGradient id="cityRoad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={roadColor} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={roadColor} stopOpacity={0.55} />
                </linearGradient>
                <filter id="cityGlow" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor={isEnergized ? "#93c5fd" : "#94a3b8"} floodOpacity={isEnergized ? "0.7" : "0.2"} />
                </filter>
                <filter id="districtGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={isEnergized ? "#7dd3fc" : "#94a3b8"} floodOpacity={isEnergized ? "0.65" : "0.14"} />
                </filter>
                <radialGradient id="rewardWave" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fde68a" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
                </radialGradient>
            </defs>

            <rect x="0" y="0" width="420" height="300" fill="url(#citySky)" />

            <circle cx="350" cy="54" r="18" fill={sunColor} opacity={isEnergized ? 0.95 : 0.45} />

            <g>
                {cloudGroups.map((cloud) => (
                    <g
                        key={`${cloud.x}-${cloud.y}`}
                        className={isEnergized ? "cloud-drift" : undefined}
                        style={isEnergized ? ({ ["--cloud-delay" as string]: cloud.delay } as CSSProperties) : undefined}
                    >
                        <ellipse cx={cloud.x} cy={cloud.y} rx={20 * cloud.scale} ry={8 * cloud.scale} fill={cloudColor} opacity={0.9} />
                        <ellipse cx={cloud.x - 12 * cloud.scale} cy={cloud.y + 1} rx={11 * cloud.scale} ry={7 * cloud.scale} fill={cloudShade} opacity={0.8} />
                        <ellipse cx={cloud.x + 13 * cloud.scale} cy={cloud.y + 2} rx={10 * cloud.scale} ry={6 * cloud.scale} fill={cloudShade} opacity={0.75} />
                    </g>
                ))}
            </g>

            <polygon points="34,210 210,118 386,210 210,292" fill="url(#cityGround)" />
            <polygon points="68,210 210,136 352,210 210,284" fill={parkColor} opacity={isEnergized ? 0.22 : 0.08} />

            <path d="M102 242 L210 186 L318 242 L210 296 Z" fill="url(#cityRoad)" opacity={0.75} />
            <path d="M210 192 L210 294" stroke={roadLineColor} strokeWidth="2" strokeDasharray="5 8" opacity={0.7} />

            <polygon points="122,212 210,166 278,206 190,248" fill={palette.districtCore} opacity={highlightDistrict === "core" ? 0.75 : 0.34} filter={highlightDistrict === "core" ? "url(#districtGlow)" : undefined} />
            <polygon points="62,214 138,172 178,194 102,236" fill={palette.districtInvest} opacity={highlightDistrict === "invest" ? 0.74 : 0.28} filter={highlightDistrict === "invest" ? "url(#districtGlow)" : undefined} />
            <polygon points="278,204 344,210 318,234 258,228" fill={palette.districtLeisure} opacity={highlightDistrict === "leisure" ? 0.74 : 0.28} filter={highlightDistrict === "leisure" ? "url(#districtGlow)" : undefined} />
            <polygon points="174,226 246,224 224,254 156,256" fill={palette.districtFamily} opacity={highlightDistrict === "family" ? 0.74 : 0.26} filter={highlightDistrict === "family" ? "url(#districtGlow)" : undefined} />

            <g>
                {trees.map((tree) => (
                    <g key={`${tree.x}-${tree.y}`} opacity={isEnergized ? 1 : 0.72}>
                        <rect x={tree.x - 1.7} y={tree.y + 3} width={3.4} height={7 * tree.scale} rx="1" fill={treeTrunk} />
                        <circle cx={tree.x} cy={tree.y} r={5.6 * tree.scale} fill={treeLeaf} />
                        <circle cx={tree.x - 3 * tree.scale} cy={tree.y + 2} r={3.4 * tree.scale} fill={treeLeaf} opacity={0.9} />
                        <circle cx={tree.x + 3 * tree.scale} cy={tree.y + 1} r={3.2 * tree.scale} fill={treeLeaf} opacity={0.82} />
                    </g>
                ))}
            </g>

            {didRecordToday && (
                <g className="mission-wave">
                    <circle cx="210" cy="200" r="14" fill="url(#rewardWave)" />
                    <circle cx="210" cy="200" r="22" fill="none" stroke="#fef08a" strokeOpacity="0.4" strokeWidth="1.2" />
                </g>
            )}

            <g className={isEnergized ? "city-float" : undefined} filter={isEnergized ? "url(#cityGlow)" : undefined}>
                {cubes.map((cube, index) => {
                    const polygons = cubePolygons(cube);
                    const opacity = cube.opacity ?? 1;
                    const isHighlighted = cube.district === highlightDistrict;
                    const windowRows = Math.max(1, Math.floor(cube.height / 24));
                    const windowCols = Math.max(1, Math.floor(cube.size / 20));
                    const windowsRight = faceWindows(polygons.right, windowRows, windowCols);
                    const windowsLeft = faceWindows(polygons.left, Math.max(1, windowRows - 1), windowCols);
                    const roofPoints = [...polygons.top, polygons.top[0]].map(([x, y]) => `${x},${y}`).join(" ");
                    const style = {
                        ["--rise-delay" as string]: `${index * 75}ms`,
                    } as CSSProperties;
                    return (
                        <g
                            key={`${stage}-${cube.x}-${cube.y}-${index}`}
                            opacity={opacity}
                            className={`cube-rise ${isHighlighted ? "district-highlight" : ""}`.trim()}
                            style={style}
                        >
                            <polygon
                                points={polygons.leftPath}
                                fill={palette.left}
                                stroke={palette.stroke}
                                strokeWidth={isHighlighted ? "1.18" : "0.9"}
                                opacity={0.95}
                            />
                            <polygon
                                points={polygons.rightPath}
                                fill={palette.right}
                                stroke={palette.stroke}
                                strokeWidth={isHighlighted ? "1.18" : "0.9"}
                                opacity={0.96}
                            />
                            <polygon
                                points={polygons.topPath}
                                fill={palette.top}
                                stroke={palette.stroke}
                                strokeWidth={isHighlighted ? "1.2" : "0.92"}
                                opacity={0.98}
                            />
                            <polyline
                                points={roofPoints}
                                fill="none"
                                stroke={districtAccentColor(cube.district)}
                                strokeWidth={isHighlighted ? "1.9" : "1.1"}
                                opacity={0.85}
                            />
                            {windowsRight.map(([x, y], windowIndex) => (
                                <circle
                                    key={`right-${cube.x}-${cube.y}-${windowIndex}`}
                                    cx={x}
                                    cy={y}
                                    r={Math.max(1.3, cube.size * 0.05)}
                                    fill={didRecordToday ? windowOn : windowOff}
                                    fillOpacity={didRecordToday ? 0.95 : 0.55}
                                />
                            ))}
                            {windowsLeft.map(([x, y], windowIndex) => (
                                <circle
                                    key={`left-${cube.x}-${cube.y}-${windowIndex}`}
                                    cx={x}
                                    cy={y}
                                    r={Math.max(1.15, cube.size * 0.045)}
                                    fill={didRecordToday ? windowOn : windowOff}
                                    fillOpacity={didRecordToday ? 0.86 : 0.46}
                                />
                            ))}
                        </g>
                    );
                })}
            </g>

            {isEnergized && (
                <g>
                    {skySparkles.map((sparkle) => (
                        <circle
                            key={`${sparkle.x}-${sparkle.y}`}
                            cx={sparkle.x}
                            cy={sparkle.y}
                            r={sparkle.r}
                            fill="#e0f2fe"
                            className="sky-sparkle"
                            style={{ ["--sparkle-delay" as string]: sparkle.delay } as CSSProperties}
                        />
                    ))}
                </g>
            )}

            <g>
                {lightPoints.map((light) => (
                    <circle
                        key={`${light.x}-${light.y}`}
                        cx={light.x}
                        cy={light.y}
                        r={light.r}
                        className={didRecordToday ? "city-light" : undefined}
                        fill={didRecordToday ? windowOn : windowOff}
                        fillOpacity={didRecordToday ? 0.95 : 0.26}
                        style={didRecordToday ? ({ ["--light-delay" as string]: light.delay } as CSSProperties) : undefined}
                    />
                ))}
            </g>

            <style>{`
                .cloud-drift {
                    animation: cloudDrift 12s ease-in-out infinite;
                    animation-delay: var(--cloud-delay, 0ms);
                }
                .city-float {
                    animation: cityFloat 4.8s ease-in-out infinite;
                    transform-origin: 210px 208px;
                }
                .district-highlight {
                    animation: districtPulse 2.2s ease-in-out infinite;
                }
                .cube-rise {
                    animation: cubeRise 740ms cubic-bezier(0.2, 0.88, 0.24, 1) both;
                    animation-delay: var(--rise-delay, 0ms);
                    transform-origin: 210px 228px;
                }
                .city-light {
                    animation: cityLightPulse 1.8s ease-in-out infinite;
                    animation-delay: var(--light-delay, 0ms);
                }
                .mission-wave {
                    animation: missionWave 1.7s ease-out infinite;
                    transform-origin: 210px 200px;
                }
                .sky-sparkle {
                    animation: sparkleTwinkle 2.4s ease-in-out infinite;
                    animation-delay: var(--sparkle-delay, 0ms);
                }
                @keyframes cloudDrift {
                    0%, 100% { transform: translateX(0px); }
                    50% { transform: translateX(6px); }
                }
                @keyframes cityFloat {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-3px); }
                }
                @keyframes districtPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.82; }
                }
                @keyframes cubeRise {
                    0% { transform: translateY(16px) scale(0.94); opacity: 0; }
                    100% { transform: translateY(0px) scale(1); opacity: 1; }
                }
                @keyframes cityLightPulse {
                    0%, 100% { opacity: 0.45; filter: brightness(1); }
                    50% { opacity: 1; filter: brightness(1.35); }
                }
                @keyframes missionWave {
                    0% { opacity: 0.86; transform: scale(0.9); }
                    100% { opacity: 0; transform: scale(1.35); }
                }
                @keyframes sparkleTwinkle {
                    0%, 100% { opacity: 0.4; transform: scale(1); }
                    50% { opacity: 0.95; transform: scale(1.2); }
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
    const didRecordToday = Boolean(metrics.lastActionTimestamp && (metrics.inactiveDays || 0) === 0);
    const progress = stageProgress(stage, consistencyIndex);
    const nextTarget = nextTargetDays(stage);
    const daysToNext = nextTarget ? Math.max(0, nextTarget - consistencyIndex) : 0;
    const selectedMilestone = milestones[selectedMilestoneIndex] || milestones[0];
    const unlockedMilestones = milestones.filter((milestone) => consistencyIndex >= milestone.days).length;

    return (
        <section className={`card overflow-hidden ${className}`}>
            <div className="h-[460px] md:h-[560px] flex flex-col bg-slate-950">
                <div className="relative basis-[70%] min-h-0">
                    <CityVisualizer
                        stage={stage}
                        isEnergized={isEnergized}
                        didRecordToday={didRecordToday}
                        highlightDistrict={selectedDistrict}
                    />
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
                    <div className={`rounded-xl border px-3 py-2 text-[11px] ${didRecordToday ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-slate-700 bg-slate-950/65 text-slate-300"}`}>
                        {didRecordToday ? (
                            <span className="inline-flex items-center gap-1.5 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                                Missão diária concluída. A cidade recebeu energia extra hoje.
                            </span>
                        ) : (
                            <span>Missão de hoje pendente. Registre pelo menos uma ação para energizar sua cidade.</span>
                        )}
                    </div>

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
