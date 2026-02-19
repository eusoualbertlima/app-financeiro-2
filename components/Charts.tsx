"use client";

// ===== Donut Chart (Despesas por Categoria) =====
interface DonutSegment {
    label: string;
    value: number;
    color: string;
    icon?: string;
}

export function DonutChart({ segments, size = 200 }: { segments: DonutSegment[]; size?: number }) {
    const total = segments.reduce((acc, s) => acc + s.value, 0);
    if (total === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <svg width={size} height={size} viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="70" fill="none" stroke="#e2e8f0" strokeWidth="24" />
                </svg>
                <p className="text-sm mt-2">Sem dados</p>
            </div>
        );
    }

    const radius = 70;
    const circumference = 2 * Math.PI * radius;

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

    const chartSegments = segments.reduce<{
        offset: number;
        items: Array<DonutSegment & { dashLength: number; gap: number; offset: number }>;
    }>((acc, segment) => {
        const pct = segment.value / total;
        const dashLength = pct * circumference;
        const gap = circumference - dashLength;

        acc.items.push({
            ...segment,
            dashLength,
            gap,
            offset: acc.offset,
        });
        acc.offset += dashLength;
        return acc;
    }, { offset: 0, items: [] }).items;

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative">
                <svg width={size} height={size} viewBox="0 0 200 200" className="transform -rotate-90">
                    {chartSegments.map((seg, i) => (
                        <circle
                            key={i}
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="24"
                            strokeDasharray={`${seg.dashLength} ${seg.gap}`}
                            strokeDashoffset={-seg.offset}
                            strokeLinecap="round"
                            className="transition-all duration-500"
                        />
                    ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(total)}</p>
                    <p className="text-xs text-slate-400">Total</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full max-w-xs">
                {segments.slice(0, 6).map((seg, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                        <span className="text-xs text-slate-600 truncate">{seg.icon} {seg.label}</span>
                        <span className="text-xs text-slate-400 ml-auto">{Math.round((seg.value / total) * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ===== Bar Chart (Receitas vs Despesas) =====
interface BarData {
    label: string;
    income: number;
    expense: number;
}

export function BarChart({ data }: { data: BarData[] }) {
    const maxValue = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);

    const formatCompact = (v: number) => {
        if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
        return v.toFixed(0);
    };

    return (
        <div className="w-full">
            <div className="flex items-end gap-2 h-40">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="flex gap-0.5 items-end h-32 w-full justify-center">
                            <div
                                className="w-3 bg-green-400 rounded-t transition-all duration-500"
                                style={{ height: `${(d.income / maxValue) * 100}%`, minHeight: d.income > 0 ? 4 : 0 }}
                                title={`Receita: ${formatCompact(d.income)}`}
                            />
                            <div
                                className="w-3 bg-red-400 rounded-t transition-all duration-500"
                                style={{ height: `${(d.expense / maxValue) * 100}%`, minHeight: d.expense > 0 ? 4 : 0 }}
                                title={`Despesa: ${formatCompact(d.expense)}`}
                            />
                        </div>
                        <span className="text-[10px] text-slate-400">{d.label}</span>
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-green-400" />
                    <span className="text-xs text-slate-500">Receitas</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-red-400" />
                    <span className="text-xs text-slate-500">Despesas</span>
                </div>
            </div>
        </div>
    );
}

// ===== Line Chart (Evolução do Saldo) =====
interface LinePoint {
    label: string;
    value: number;
}

export function LineChart({ points, color = "#6366f1" }: { points: LinePoint[]; color?: string }) {
    if (points.length === 0) return null;

    const width = 320;
    const height = 120;
    const padding = { top: 10, right: 10, bottom: 20, left: 10 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const values = points.map((p) => p.value);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 1);
    const range = maxVal - minVal || 1;

    const getX = (i: number) => padding.left + (i / Math.max(points.length - 1, 1)) * chartW;
    const getY = (v: number) => padding.top + chartH - ((v - minVal) / range) * chartH;

    const pathD = points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(p.value)}`)
        .join(" ");

    const areaD = pathD + ` L ${getX(points.length - 1)} ${getY(minVal)} L ${getX(0)} ${getY(minVal)} Z`;

    return (
        <div className="w-full">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
                <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                {/* Area fill */}
                <path d={areaD} fill="url(#lineGradient)" />
                {/* Line */}
                <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {/* Points */}
                {points.map((p, i) => (
                    <g key={i}>
                        <circle cx={getX(i)} cy={getY(p.value)} r="3" fill="white" stroke={color} strokeWidth="2" />
                        <text x={getX(i)} y={height - 4} textAnchor="middle" className="text-[9px] fill-slate-400">
                            {p.label}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
