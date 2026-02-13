"use client";

import { Header } from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo, useState } from "react";
import {
    BadgeCheck,
    Building2,
    CircleX,
    Loader2,
    Mail,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    UserMinus,
    Users,
    Wrench,
} from "lucide-react";

type UserSummary = {
    uid: string;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    createdAt: number | null;
    authCreatedAt: number | null;
    lastSignInAt: number | null;
    lastSeenAt: number | null;
    profileUpdatedAt: number | null;
    lastActivityAt: number | null;
    emailVerified: boolean | null;
    disabled: boolean | null;
    providerIds: string[];
    subscriptionStatus: string | null;
    subscriptionPlan: string | null;
    hasProfileDoc: boolean;
    hasAuthRecord: boolean;
};

type ClientWorkspaceSummary = {
    workspaceId: string;
    name: string;
    createdAt: number | null;
    ownerId: string;
    owner: UserSummary | null;
    members: UserSummary[];
    pendingInvites: string[];
    billing: {
        status: string | null;
        plan: string | null;
        trialEndsAt: number | null;
        currentPeriodEnd: number | null;
        cancelAtPeriodEnd: boolean | null;
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
        updatedAt: number | null;
    };
    legal: {
        acceptedTermsAt: number | null;
        acceptedPrivacyAt: number | null;
        acceptedByUid: string | null;
        acceptedByEmail: string | null;
        acceptedByUser: UserSummary | null;
    };
};

type AdminClientsResponse = {
    generatedAt: number;
    totals: {
        workspaces: number;
        uniqueMembers: number;
        missingProfiles: number;
        pendingInvites: number;
        billingStatus: Record<string, number>;
    };
    clients: ClientWorkspaceSummary[];
};

type AdminApiError = {
    error?: string;
    details?: string;
};

type BackfillResponse = {
    ok: boolean;
    message: string;
    stats: {
        workspaces: number;
        usersInWorkspaces: number;
        authRecordsFound: number;
        updatedProfiles: number;
        skippedProfiles: number;
        missingAuthRecords: number;
    };
};

type AccessPayload = {
    action: "removeMember" | "addPendingInvite" | "removePendingInvite" | "deleteWorkspace";
    workspaceId: string;
    uid?: string;
    email?: string;
};

function formatDate(timestamp: number | null | undefined) {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleString("pt-BR");
}

function formatLabel(value: string | null | undefined, fallback = "-") {
    if (!value) return fallback;
    return value;
}

function formatBoolean(value: boolean | null | undefined, trueLabel = "Sim", falseLabel = "Não") {
    if (value === null || value === undefined) return "-";
    return value ? trueLabel : falseLabel;
}

function statusClasses(status: string | null) {
    if (status === "active") return "bg-green-100 text-green-700";
    if (status === "trialing") return "bg-blue-100 text-blue-700";
    if (status === "past_due") return "bg-amber-100 text-amber-700";
    if (status === "canceled" || status === "inactive") return "bg-red-100 text-red-700";
    return "bg-slate-100 text-slate-700";
}

export default function AdminDashboardPage() {
    const { user } = useAuth();
    const [data, setData] = useState<AdminClientsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorDetails, setErrorDetails] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [updatingKey, setUpdatingKey] = useState<string | null>(null);
    const [inviteDrafts, setInviteDrafts] = useState<Record<string, string>>({});
    const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const fetchData = async (isRefresh = false) => {
        if (!user) return;

        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);
        setErrorDetails(null);

        try {
            const token = await user.getIdToken();
            const response = await fetch("/api/admin/clients", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const payload = (await response.json()) as AdminClientsResponse & AdminApiError;

            if (!response.ok) {
                setErrorDetails(payload.details || null);
                throw new Error(payload.error || "Falha ao carregar painel administrativo.");
            }

            setData(payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro inesperado ao carregar painel.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const runAccessAction = async (payload: AccessPayload, actionKey: string) => {
        if (!user) return;

        setUpdatingKey(actionKey);
        setActionFeedback(null);

        try {
            const token = await user.getIdToken();
            const response = await fetch("/api/admin/clients/access", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const body = (await response.json()) as { message?: string; error?: string };
            if (!response.ok) {
                throw new Error(body.error || "Não foi possível atualizar o acesso.");
            }

            if (payload.action === "addPendingInvite") {
                setInviteDrafts((current) => ({ ...current, [payload.workspaceId]: "" }));
            }

            setActionFeedback({
                type: "success",
                text: body.message || "Ação concluída com sucesso.",
            });
            await fetchData(true);
        } catch (err) {
            setActionFeedback({
                type: "error",
                text: err instanceof Error ? err.message : "Erro ao atualizar acesso.",
            });
        } finally {
            setUpdatingKey(null);
        }
    };

    const runBackfillMissingProfiles = async () => {
        if (!user) return;

        setUpdatingKey("backfill-profiles");
        setActionFeedback(null);

        try {
            const token = await user.getIdToken();
            const response = await fetch("/api/admin/users/backfill", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const body = (await response.json()) as BackfillResponse & AdminApiError;
            if (!response.ok) {
                const message = body.details
                    ? `${body.error || "Não foi possível corrigir perfis ausentes."} (${body.details})`
                    : body.error || "Não foi possível corrigir perfis ausentes.";
                throw new Error(message);
            }

            const stats = body.stats;
            setActionFeedback({
                type: "success",
                text:
                    `${body.message} Atualizados: ${stats.updatedProfiles}. `
                    + `Ignorados: ${stats.skippedProfiles}. `
                    + `Sem Auth: ${stats.missingAuthRecords}.`,
            });
            await fetchData(true);
        } catch (err) {
            setActionFeedback({
                type: "error",
                text: err instanceof Error ? err.message : "Erro ao corrigir perfis ausentes.",
            });
        } finally {
            setUpdatingKey(null);
        }
    };

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid]);

    const filteredClients = useMemo(() => {
        if (!data) return [];
        const q = search.trim().toLowerCase();
        if (!q) return data.clients;

        return data.clients.filter((client) => {
            const ownerName = client.owner?.displayName?.toLowerCase() || "";
            const ownerEmail = client.owner?.email?.toLowerCase() || "";
            const workspaceName = client.name.toLowerCase();
            const workspaceId = client.workspaceId.toLowerCase();
            const memberMatch = client.members.some((member) => {
                const name = member.displayName?.toLowerCase() || "";
                const email = member.email?.toLowerCase() || "";
                const phone = member.phoneNumber?.toLowerCase() || "";
                return (
                    name.includes(q)
                    || email.includes(q)
                    || phone.includes(q)
                    || member.uid.toLowerCase().includes(q)
                );
            });

            return (
                workspaceName.includes(q)
                || workspaceId.includes(q)
                || ownerName.includes(q)
                || ownerEmail.includes(q)
                || memberMatch
            );
        });
    }, [data, search]);

    const billingStatusSummary = useMemo(() => {
        if (!data) return [];
        return Object.entries(data.totals.billingStatus).sort((a, b) => b[1] - a[1]);
    }, [data]);

    if (loading) {
        return (
            <div className="p-6 lg:p-8 max-w-7xl mx-auto">
                <Header title="Admin" subtitle="Carregando visão global de clientes..." />
                <div className="card p-12 flex items-center justify-center gap-3 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Buscando dados...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 lg:p-8 max-w-7xl mx-auto">
                <Header title="Admin" subtitle="Gestão de clientes e acessos" />
                <div className="card p-6 border-l-4 border-red-500">
                    <p className="text-red-700 font-medium">{error}</p>
                    <p className="text-sm text-slate-500 mt-2">
                        Verifique também `/api/billing/health` para validar credenciais Firebase Admin no servidor.
                    </p>
                    {errorDetails && (
                        <p className="text-xs text-slate-400 mt-2 break-words">Detalhe técnico: {errorDetails}</p>
                    )}
                    <button onClick={() => fetchData()} className="btn-secondary mt-4">
                        Tentar novamente
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <Header title="Admin" subtitle="Gestão global de clientes, acessos e assinatura" />

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="card p-4">
                    <p className="text-sm text-slate-500">Workspaces</p>
                    <p className="text-2xl font-bold text-slate-900">{data?.totals.workspaces || 0}</p>
                </div>
                <div className="card p-4">
                    <p className="text-sm text-slate-500">Usuários únicos</p>
                    <p className="text-2xl font-bold text-slate-900">{data?.totals.uniqueMembers || 0}</p>
                </div>
                <div className="card p-4">
                    <p className="text-sm text-slate-500">Perfis ausentes</p>
                    <p className="text-2xl font-bold text-amber-600">{data?.totals.missingProfiles || 0}</p>
                </div>
                <div className="card p-4">
                    <p className="text-sm text-slate-500">Convites pendentes</p>
                    <p className="text-2xl font-bold text-slate-900">{data?.totals.pendingInvites || 0}</p>
                </div>
                <div className="card p-4">
                    <p className="text-sm text-slate-500">Atualizado em</p>
                    <p className="text-sm font-semibold text-slate-900">{formatDate(data?.generatedAt)}</p>
                </div>
            </div>

            <div className="card p-4 mb-6 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar por workspace, email, nome, telefone ou UID"
                        className="input pl-9"
                    />
                </div>
                <div className="flex gap-2 flex-wrap lg:justify-end">
                    <button
                        onClick={runBackfillMissingProfiles}
                        className="btn-secondary inline-flex items-center justify-center gap-2 min-w-[220px]"
                        disabled={Boolean(updatingKey)}
                    >
                        {updatingKey === "backfill-profiles" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Wrench className="w-4 h-4" />
                        )}
                        Corrigir perfis ausentes
                    </button>
                    <button
                        onClick={() => fetchData(true)}
                        className="btn-secondary inline-flex items-center justify-center gap-2 min-w-[180px]"
                        disabled={refreshing || Boolean(updatingKey)}
                    >
                        {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Atualizar dados
                    </button>
                </div>
            </div>

            {actionFeedback && (
                <div className={`card p-3 mb-6 border-l-4 ${actionFeedback.type === "success" ? "border-green-500" : "border-red-500"}`}>
                    <p className={`text-sm font-medium ${actionFeedback.type === "success" ? "text-green-700" : "text-red-700"}`}>
                        {actionFeedback.text}
                    </p>
                </div>
            )}

            {billingStatusSummary.length > 0 && (
                <div className="card p-4 mb-6">
                    <p className="text-sm font-medium text-slate-700 mb-3">Status de assinatura (workspaces)</p>
                    <div className="flex flex-wrap gap-2">
                        {billingStatusSummary.map(([status, count]) => (
                            <span
                                key={status}
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusClasses(status)}`}
                            >
                                {status}: {count}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {filteredClients.length === 0 ? (
                <div className="card p-10 text-center text-slate-500">
                    Nenhum cliente encontrado para o filtro atual.
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredClients.map((client) => (
                        <div key={client.workspaceId} className="card p-5">
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Building2 className="w-4 h-4 text-primary-600" />
                                        <h2 className="font-semibold text-slate-900 truncate">{client.name}</h2>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusClasses(client.billing.status)}`}>
                                            {formatLabel(client.billing.status, "unknown")}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 break-all">Workspace ID: {client.workspaceId}</p>
                                    <p className="text-xs text-slate-400">Criado em: {formatDate(client.createdAt)}</p>
                                </div>
                                <div className="flex flex-col items-start lg:items-end gap-2">
                                    <div className="text-xs text-slate-500">
                                        Plano: <strong className="text-slate-700">{formatLabel(client.billing.plan, "sem plano")}</strong>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const confirmedId = window.prompt(
                                                `Para excluir permanentemente este workspace, digite o ID exato:\n${client.workspaceId}`
                                            );
                                            if (confirmedId !== client.workspaceId) {
                                                setActionFeedback({
                                                    type: "error",
                                                    text: "Exclusão cancelada: ID de confirmação não confere.",
                                                });
                                                return;
                                            }

                                            runAccessAction(
                                                {
                                                    action: "deleteWorkspace",
                                                    workspaceId: client.workspaceId,
                                                },
                                                `delete-workspace-${client.workspaceId}`
                                            );
                                        }}
                                        disabled={Boolean(updatingKey)}
                                        className="text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md px-2 py-1 disabled:opacity-50 inline-flex items-center gap-1"
                                    >
                                        <CircleX className="w-3 h-3" />
                                        Excluir workspace
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-slate-50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ShieldCheck className="w-4 h-4 text-slate-500" />
                                        <p className="text-sm font-semibold text-slate-800">Dono do workspace</p>
                                    </div>
                                    <p className="text-sm text-slate-900">
                                        {formatLabel(client.owner?.displayName, "Sem nome")}
                                    </p>
                                    <p className="text-xs text-slate-500 break-all">{formatLabel(client.owner?.email, "Sem email")}</p>
                                    <p className="text-xs text-slate-500">Telefone: {formatLabel(client.owner?.phoneNumber, "Não informado")}</p>
                                    <p className="text-xs text-slate-500">Email verificado: {formatBoolean(client.owner?.emailVerified)}</p>
                                    <p className="text-xs text-slate-500">Conta desabilitada: {formatBoolean(client.owner?.disabled)}</p>
                                    <p className="text-xs text-slate-500">Último acesso no app: {formatDate(client.owner?.lastActivityAt)}</p>
                                    <p className="text-xs text-slate-500">Último login Google: {formatDate(client.owner?.lastSignInAt)}</p>
                                    <p className="text-xs text-slate-500">Último heartbeat de sessão: {formatDate(client.owner?.lastSeenAt)}</p>
                                    <p className="text-xs text-slate-500">Criado (auth): {formatDate(client.owner?.authCreatedAt)}</p>
                                    <p className="text-xs text-slate-500">
                                        Provedores: {client.owner?.providerIds?.length ? client.owner.providerIds.join(", ") : "-"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Assinatura (perfil): {formatLabel(client.owner?.subscriptionStatus)}
                                        {" • "}
                                        Plano: {formatLabel(client.owner?.subscriptionPlan)}
                                    </p>
                                    <p className="text-xs text-slate-400 break-all">UID: {client.ownerId || "-"}</p>
                                    <div className="mt-1 flex gap-2 flex-wrap">
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${client.owner?.hasAuthRecord ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                            Auth: {client.owner?.hasAuthRecord ? "ok" : "ausente"}
                                        </span>
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${client.owner?.hasProfileDoc ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                            Perfil Firestore: {client.owner?.hasProfileDoc ? "ok" : "ausente"}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users className="w-4 h-4 text-slate-500" />
                                        <p className="text-sm font-semibold text-slate-800">Membros ({client.members.length})</p>
                                    </div>
                                    <div className="space-y-2 max-h-52 overflow-auto pr-1">
                                        {client.members.length === 0 ? (
                                            <p className="text-xs text-slate-500">Sem membros registrados.</p>
                                        ) : (
                                            client.members.map((member) => (
                                                <div key={member.uid} className="text-xs bg-white rounded-lg border border-slate-200 p-2">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-slate-800">{formatLabel(member.displayName, "Sem nome")}</p>
                                                            <p className="text-slate-500 break-all">{formatLabel(member.email, "Sem email")}</p>
                                                            <p className="text-slate-500">Telefone: {formatLabel(member.phoneNumber, "Não informado")}</p>
                                                            <p className="text-slate-500">
                                                                Verificado: {formatBoolean(member.emailVerified)}
                                                                {" • "}
                                                                Desabilitado: {formatBoolean(member.disabled)}
                                                            </p>
                                                            <p className="text-slate-500">Último acesso app: {formatDate(member.lastActivityAt)}</p>
                                                            <p className="text-slate-500">Último login Google: {formatDate(member.lastSignInAt)}</p>
                                                            <p className="text-slate-500">Último heartbeat: {formatDate(member.lastSeenAt)}</p>
                                                            <p className="text-slate-500">Criado (auth): {formatDate(member.authCreatedAt)}</p>
                                                            <p className="text-slate-500">
                                                                Provedores: {member.providerIds?.length ? member.providerIds.join(", ") : "-"}
                                                            </p>
                                                            <p className="text-slate-500">
                                                                Assinatura: {formatLabel(member.subscriptionStatus)}
                                                                {" • "}
                                                                Plano: {formatLabel(member.subscriptionPlan)}
                                                            </p>
                                                            <p className="text-slate-400 break-all">UID: {member.uid}</p>
                                                            <div className="mt-1 flex gap-2 flex-wrap">
                                                                <span className={`text-[11px] px-2 py-0.5 rounded-full ${member.hasAuthRecord ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                                                    Auth: {member.hasAuthRecord ? "ok" : "ausente"}
                                                                </span>
                                                                <span className={`text-[11px] px-2 py-0.5 rounded-full ${member.hasProfileDoc ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                                                    Perfil: {member.hasProfileDoc ? "ok" : "ausente"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {member.uid !== client.ownerId && (
                                                            <button
                                                                onClick={() =>
                                                                    runAccessAction(
                                                                        {
                                                                            action: "removeMember",
                                                                            workspaceId: client.workspaceId,
                                                                            uid: member.uid,
                                                                        },
                                                                        `remove-member-${client.workspaceId}-${member.uid}`
                                                                    )
                                                                }
                                                                disabled={Boolean(updatingKey)}
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded px-2 py-1 whitespace-nowrap disabled:opacity-50"
                                                                title="Remover acesso"
                                                            >
                                                                <span className="inline-flex items-center gap-1">
                                                                    <UserMinus className="w-3 h-3" />
                                                                    Remover
                                                                </span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BadgeCheck className="w-4 h-4 text-slate-500" />
                                        <p className="text-sm font-semibold text-slate-800">Aceite legal</p>
                                    </div>
                                    <p className="text-xs text-slate-600">Termos: {formatDate(client.legal.acceptedTermsAt)}</p>
                                    <p className="text-xs text-slate-600">Privacidade: {formatDate(client.legal.acceptedPrivacyAt)}</p>
                                    <p className="text-xs text-slate-500 break-all">
                                        Aceito por UID: {formatLabel(client.legal.acceptedByUid)}
                                    </p>
                                    <p className="text-xs text-slate-500 break-all">
                                        Aceito por email: {formatLabel(client.legal.acceptedByEmail)}
                                    </p>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Mail className="w-4 h-4 text-slate-500" />
                                        <p className="text-sm font-semibold text-slate-800">Billing e convites</p>
                                    </div>
                                    <p className="text-xs text-slate-600">Trial até: {formatDate(client.billing.trialEndsAt)}</p>
                                    <p className="text-xs text-slate-600">Período atual até: {formatDate(client.billing.currentPeriodEnd)}</p>
                                    <p className="text-xs text-slate-600">
                                        Cancela no fim do ciclo: {client.billing.cancelAtPeriodEnd ? "Sim" : "Não"}
                                    </p>
                                    <p className="text-xs text-slate-500 break-all">Stripe customer: {formatLabel(client.billing.stripeCustomerId)}</p>
                                    <p className="text-xs text-slate-500 break-all">Stripe subscription: {formatLabel(client.billing.stripeSubscriptionId)}</p>
                                    <p className="text-xs text-slate-500">Billing atualizado em: {formatDate(client.billing.updatedAt)}</p>
                                    <div className="mt-3 flex gap-2">
                                        <input
                                            value={inviteDrafts[client.workspaceId] || ""}
                                            onChange={(event) =>
                                                setInviteDrafts((current) => ({
                                                    ...current,
                                                    [client.workspaceId]: event.target.value,
                                                }))
                                            }
                                            placeholder="novo-email@cliente.com"
                                            className="input !py-2 !px-3 text-xs"
                                        />
                                        <button
                                            onClick={() => {
                                                const email = (inviteDrafts[client.workspaceId] || "").trim();
                                                if (!email) return;
                                                runAccessAction(
                                                    {
                                                        action: "addPendingInvite",
                                                        workspaceId: client.workspaceId,
                                                        email,
                                                    },
                                                    `add-invite-${client.workspaceId}`
                                                );
                                            }}
                                            disabled={Boolean(updatingKey)}
                                            className="btn-secondary !px-3 !py-2 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Adicionar
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">Convites pendentes: {client.pendingInvites.length}</p>
                                    {client.pendingInvites.length > 0 && (
                                        <div className="mt-1 space-y-1">
                                            {client.pendingInvites.map((invite) => (
                                                <div key={invite} className="flex items-center justify-between gap-2 text-xs bg-white rounded-lg border border-slate-200 px-2 py-1.5">
                                                    <p className="text-slate-500 break-all">{invite}</p>
                                                    <button
                                                        onClick={() =>
                                                            runAccessAction(
                                                                {
                                                                    action: "removePendingInvite",
                                                                    workspaceId: client.workspaceId,
                                                                    email: invite,
                                                                },
                                                                `remove-invite-${client.workspaceId}-${invite}`
                                                            )
                                                        }
                                                        disabled={Boolean(updatingKey)}
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded px-2 py-1 whitespace-nowrap disabled:opacity-50"
                                                    >
                                                        Remover
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
