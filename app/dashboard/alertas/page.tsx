"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Navigation";
import { useOpsAlerts } from "@/hooks/useOpsAlerts";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import type { OpsAlert } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

type AlertLevelFilter = "all" | "error" | "warning" | "info";

const levelMeta = {
    error: {
        label: "Erro",
        icon: ShieldAlert,
        badge: "bg-red-100 text-red-700",
        row: "border-l-red-500",
    },
    warning: {
        label: "Aviso",
        icon: AlertTriangle,
        badge: "bg-amber-100 text-amber-700",
        row: "border-l-amber-500",
    },
    info: {
        label: "Info",
        icon: Info,
        badge: "bg-blue-100 text-blue-700",
        row: "border-l-blue-500",
    },
};

function formatDate(value?: number, timestamp?: string) {
    if (value) return new Date(value).toLocaleString("pt-BR");
    if (timestamp) return new Date(timestamp).toLocaleString("pt-BR");
    return "-";
}

export default function AlertasPage() {
    const { isDeveloperAdmin } = useAuth();
    const { alerts, loading } = useOpsAlerts(150, isDeveloperAdmin);
    const [filter, setFilter] = useState<AlertLevelFilter>("all");

    const filteredAlerts = useMemo(() => {
        if (filter === "all") return alerts;
        return alerts.filter((alert) => alert.level === filter);
    }, [alerts, filter]);

    const counts = useMemo(
        () => ({
            total: alerts.length,
            error: alerts.filter((alert) => alert.level === "error").length,
            warning: alerts.filter((alert) => alert.level === "warning").length,
            info: alerts.filter((alert) => alert.level === "info").length,
        }),
        [alerts]
    );

    if (!isDeveloperAdmin) {
        return (
            <div className="p-6 lg:p-8 max-w-6xl mx-auto">
                <Header title="Alertas" subtitle="Monitoramento interno de erros e avisos do sistema" />
                <div className="card p-8 text-center text-slate-600">
                    Acesso restrito ao time interno.
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 max-w-6xl mx-auto">
            <Header title="Alertas" subtitle="Monitoramento interno de erros e avisos do sistema" />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <button onClick={() => setFilter("all")} className={`card p-4 text-left ${filter === "all" ? "ring-2 ring-primary-500" : ""}`}>
                    <p className="text-sm text-slate-500">Total</p>
                    <p className="text-2xl font-bold text-slate-900">{counts.total}</p>
                </button>
                <button onClick={() => setFilter("error")} className={`card p-4 text-left ${filter === "error" ? "ring-2 ring-red-500" : ""}`}>
                    <p className="text-sm text-red-500">Erros</p>
                    <p className="text-2xl font-bold text-red-600">{counts.error}</p>
                </button>
                <button onClick={() => setFilter("warning")} className={`card p-4 text-left ${filter === "warning" ? "ring-2 ring-amber-500" : ""}`}>
                    <p className="text-sm text-amber-500">Avisos</p>
                    <p className="text-2xl font-bold text-amber-600">{counts.warning}</p>
                </button>
                <button onClick={() => setFilter("info")} className={`card p-4 text-left ${filter === "info" ? "ring-2 ring-blue-500" : ""}`}>
                    <p className="text-sm text-blue-500">Informações</p>
                    <p className="text-2xl font-bold text-blue-600">{counts.info}</p>
                </button>
            </div>

            <div className="card overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-500">Carregando alertas...</div>
                ) : filteredAlerts.length === 0 ? (
                    <div className="p-12 text-center">
                        <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                        <p className="text-slate-600">Nenhum alerta encontrado.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredAlerts.map((alert: OpsAlert) => {
                            const meta = levelMeta[alert.level] || levelMeta.info;
                            const Icon = meta.icon;
                            return (
                                <div key={alert.id} className={`p-4 border-l-4 ${meta.row} hover:bg-slate-50`}>
                                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${meta.badge}`}>
                                                    <Icon className="w-3 h-3" />
                                                    {meta.label}
                                                </span>
                                                <span className="text-xs text-slate-500">{alert.source}</span>
                                                <span className="text-xs text-slate-400">{formatDate(alert.createdAt, alert.timestamp)}</span>
                                            </div>
                                            <p className="text-sm font-medium text-slate-800 break-words">{alert.message}</p>
                                            {alert.context && Object.keys(alert.context).length > 0 && (
                                                <pre className="mt-2 text-xs bg-slate-100 rounded-lg p-2 overflow-auto text-slate-700">
                                                    {JSON.stringify(alert.context, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
