"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useFirestore";
import { getWorkspaceAccessState } from "@/lib/billing";
import { getClientDevAdminAllowlist, hasDevAdminAccess } from "@/lib/devAdmin";
import { Header } from "@/components/Navigation";
import { Settings, User, Shield, Bell, Palette, LogOut, ChevronRight, UserPlus, Users, Copy, Check, CreditCard, Loader2 } from "lucide-react";
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

export default function ConfiguracoesPage() {
    const { user, signOut } = useAuth();
    const { workspace } = useWorkspace();
    const access = getWorkspaceAccessState(workspace);
    const isDevAdmin = hasDevAdminAccess({
        uid: user?.uid,
        email: user?.email,
        allowlist: getClientDevAdminAllowlist(),
    });
    const hasEffectiveAccess = access.hasAccess || isDevAdmin;
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteStatus, setInviteStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [inviteMessage, setInviteMessage] = useState("");
    const [copied, setCopied] = useState(false);
    const [billingLoading, setBillingLoading] = useState<"none" | "checkout" | "portal">("none");
    const [billingMessage, setBillingMessage] = useState("");
    const [acceptedLegal, setAcceptedLegal] = useState(false);

    useEffect(() => {
        if (!workspace) return;
        const alreadyAccepted = Boolean(workspace.legal?.acceptedTermsAt && workspace.legal?.acceptedPrivacyAt);
        if (alreadyAccepted) {
            setAcceptedLegal(true);
        }
    }, [workspace]);

    const sections = [
        {
            id: "compartilhar",
            icon: Users,
            title: "Compartilhar Finanças",
            description: "Convide alguém para compartilhar seus dados",
            color: "bg-primary-100 text-primary-600",
        },
        {
            id: "perfil",
            icon: User,
            title: "Perfil",
            description: "Informações da sua conta",
            color: "bg-blue-100 text-blue-600",
        },
        {
            id: "seguranca",
            icon: Shield,
            title: "Segurança",
            description: "Senha e autenticação",
            color: "bg-green-100 text-green-600",
        },
        {
            id: "notificacoes",
            icon: Bell,
            title: "Notificações",
            description: "Alertas e lembretes",
            color: "bg-amber-100 text-amber-600",
        },
        {
            id: "aparencia",
            icon: Palette,
            title: "Aparência",
            description: "Tema e personalização",
            color: "bg-purple-100 text-purple-600",
        },
    ];

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail || !workspace?.id) return;

        setInviteStatus("loading");

        try {
            // Search for user by email in Firebase Auth
            // Since we can't query Auth directly from client, we'll use a simple approach:
            // Look for workspaces owned by the email user
            // For now, we'll add the email to a pending_invites collection
            // and resolve it when the user logs in

            if (!workspace?.id) {
                setInviteStatus("error");
                setInviteMessage("Workspace não encontrado");
                return;
            }

            // Add invite to workspace
            await updateDoc(doc(db, "workspaces", workspace.id), {
                pendingInvites: arrayUnion(inviteEmail.toLowerCase()),
            });

            setInviteStatus("success");
            setInviteMessage(`✅ Email ${inviteEmail} autorizado! Nenhum email é enviado — basta a pessoa abrir o app e fazer login com a mesma conta Google. Ela verá automaticamente os seus dados.`);
            setInviteEmail("");
        } catch (error) {
            setInviteStatus("error");
            setInviteMessage("Erro ao enviar convite. Tente novamente.");
        }
    };

    const copyWorkspaceId = () => {
        if (workspace?.id) {
            navigator.clipboard.writeText(workspace.id);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const openCheckout = async () => {
        if (!workspace?.id || !user) return;
        if (!acceptedLegal) {
            setBillingMessage("Aceite os Termos e a Política de Privacidade para continuar.");
            return;
        }

        setBillingLoading("checkout");
        setBillingMessage("");
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
                    plan: workspace.billing?.plan || "monthly",
                    acceptedLegal: true,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error("Somente o dono do workspace pode iniciar ou alterar assinatura.");
                }
                throw new Error(data?.error || "Erro ao abrir checkout.");
            }

            if (!data?.url) {
                throw new Error(data?.error || "Erro ao abrir checkout.");
            }

            window.location.href = data.url;
        } catch (error) {
            console.error(error);
            setBillingMessage(error instanceof Error ? error.message : "Não foi possível abrir o checkout agora.");
        } finally {
            setBillingLoading("none");
        }
    };

    const openPortal = async () => {
        if (!workspace?.id || !user) return;

        setBillingLoading("portal");
        setBillingMessage("");
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
                    throw new Error("Somente o dono do workspace pode gerenciar assinatura.");
                }
                throw new Error(data?.error || "Erro ao abrir portal.");
            }

            if (!data?.url) {
                throw new Error(data?.error || "Erro ao abrir portal.");
            }

            window.location.href = data.url;
        } catch (error) {
            console.error(error);
            setBillingMessage(error instanceof Error ? error.message : "Não foi possível abrir o portal de assinatura agora.");
        } finally {
            setBillingLoading("none");
        }
    };

    return (
        <div className="p-6 lg:p-8 max-w-3xl mx-auto">
            <Header title="Configurações" subtitle="Gerencie sua conta e preferências" />

            {/* Perfil do Usuário */}
            <div className="card p-6 mb-6">
                <div className="flex items-center gap-4">
                    {user?.photoURL ? (
                        <img
                            src={user.photoURL}
                            alt=""
                            className="w-16 h-16 rounded-full ring-2 ring-primary-400/50"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-2xl font-bold">
                            {user?.displayName?.[0] || "?"}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900 truncate">
                            {user?.displayName || "Usuário"}
                        </h2>
                        <p className="text-sm text-slate-500 truncate">{user?.email}</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Conectado via Google
                        </p>
                    </div>
                </div>
            </div>

            {/* Billing */}
            <div className="card p-6 mb-6">
                <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-primary-600" />
                        <h3 className="font-semibold text-slate-900">Assinatura</h3>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${hasEffectiveAccess ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {isDevAdmin && !access.hasAccess ? "internal_active" : access.status}
                    </span>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                    {isDevAdmin && !access.hasAccess
                        ? "Acesso interno liberado por conta dev-admin (bypass de cobrança ativo somente para sua conta)."
                        : access.status === "trialing"
                        ? `Seu teste expira em ${access.trialDaysLeft || 0} dia(s).`
                        : hasEffectiveAccess
                            ? "Sua assinatura está ativa."
                            : "Seu acesso está bloqueado até a assinatura ser reativada."}
                </p>
                {workspace?.ownerId && user?.uid !== workspace.ownerId && (
                    <p className="text-xs text-amber-600 mb-4">
                        Apenas o dono do workspace pode alterar a assinatura.
                    </p>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                    <button
                        onClick={openCheckout}
                        className="btn-primary flex-1"
                        disabled={billingLoading !== "none" || !acceptedLegal || (workspace?.ownerId ? user?.uid !== workspace.ownerId : false)}
                    >
                        {billingLoading === "checkout" ? (
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Abrindo checkout...</span>
                        ) : "Assinar / Reativar"}
                    </button>
                    {workspace?.billing?.stripeCustomerId && (
                        <button
                            onClick={openPortal}
                            className="btn-secondary flex-1"
                            disabled={billingLoading !== "none" || (workspace?.ownerId ? user?.uid !== workspace.ownerId : false)}
                        >
                            {billingLoading === "portal" ? (
                                <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Abrindo portal...</span>
                            ) : "Gerenciar no Stripe"}
                        </button>
                    )}
                </div>
                <label className="mt-3 flex items-start gap-2 text-xs text-slate-500">
                    <input
                        type="checkbox"
                        checked={acceptedLegal}
                        onChange={(e) => setAcceptedLegal(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300"
                    />
                    <span>
                        Li e aceito os{" "}
                        <Link href="/termos" className="underline text-primary-600" target="_blank">Termos de Uso</Link>{" "}
                        e a{" "}
                        <Link href="/privacidade" className="underline text-primary-600" target="_blank">Política de Privacidade</Link>{" "}
                        e a{" "}
                        <Link href="/politica-comercial" className="underline text-primary-600" target="_blank">Política Comercial</Link>.
                    </span>
                </label>
                <p className="text-xs text-slate-500 mt-2">
                    Precisa de ajuda com cobrança ou cancelamento?{" "}
                    <Link href="/suporte" className="underline text-primary-600" target="_blank">Suporte</Link>.
                </p>
                {billingMessage && (
                    <p className="text-xs text-red-500 mt-2">{billingMessage}</p>
                )}
            </div>

            {/* Seções */}
            <div className="space-y-3 mb-6">
                {sections.map((section) => {
                    const Icon = section.icon;
                    return (
                        <div key={section.id}>
                            <button
                                onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                                className="card p-4 w-full flex items-center gap-4 text-left hover:shadow-md transition-all"
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${section.color}`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-slate-900">{section.title}</p>
                                    <p className="text-sm text-slate-500">{section.description}</p>
                                </div>
                                <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${activeSection === section.id ? 'rotate-90' : ''}`} />
                            </button>

                            {/* Compartilhar Section */}
                            {activeSection === section.id && section.id === "compartilhar" && (
                                <div className="card p-6 mt-2 ml-4 border-l-4 border-primary-400">
                                    <div className="flex items-center gap-2 mb-4">
                                        <UserPlus className="w-5 h-5 text-primary-500" />
                                        <h3 className="font-semibold text-slate-900">Compartilhar com outra pessoa</h3>
                                    </div>
                                    <p className="text-sm text-slate-500 mb-4">
                                        Digite o email do Google da pessoa que você quer compartilhar.
                                        <strong> Nenhum email será enviado</strong> — basta a pessoa abrir o app e fazer login com o Google.
                                        Ela será adicionada automaticamente.
                                    </p>

                                    <form onSubmit={handleInvite} className="flex gap-2 mb-4">
                                        <input
                                            type="email"
                                            value={inviteEmail}
                                            onChange={e => setInviteEmail(e.target.value)}
                                            placeholder="email@gmail.com"
                                            className="input flex-1"
                                            required
                                        />
                                        <button
                                            type="submit"
                                            className="btn-primary whitespace-nowrap"
                                            disabled={inviteStatus === "loading"}
                                        >
                                            {inviteStatus === "loading" ? "Salvando..." : "Autorizar"}
                                        </button>
                                    </form>

                                    {inviteMessage && (
                                        <div className={`p-3 rounded-xl text-sm ${inviteStatus === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                                            {inviteMessage}
                                        </div>
                                    )}

                                    {/* Workspace Info */}
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <p className="text-xs text-slate-400 mb-2">ID do Workspace (para suporte)</p>
                                        <div className="flex items-center gap-2">
                                            <code className="text-xs bg-slate-100 px-3 py-1.5 rounded-lg text-slate-600 flex-1 truncate">
                                                {workspace?.id}
                                            </code>
                                            <button
                                                onClick={copyWorkspaceId}
                                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Copiar"
                                            >
                                                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                                            </button>
                                        </div>
                                        {workspace && (
                                            <p className="text-xs text-slate-400 mt-2">
                                                {(workspace as any).pendingInvites?.length > 0
                                                    ? `📧 ${(workspace as any).pendingInvites.length} convite(s) pendente(s)`
                                                    : `👤 ${workspace.members?.length || 1} membro(s)`
                                                }
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Other sections - placeholder */}
                            {activeSection === section.id && section.id !== "compartilhar" && (
                                <div className="card p-6 mt-2 ml-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Settings className="w-5 h-5 text-slate-400" />
                                        <h3 className="font-semibold text-slate-900">{section.title}</h3>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-8 text-center">
                                        <p className="text-slate-500 text-sm">
                                            🚧 Esta seção está em desenvolvimento e estará disponível em breve.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Botão Sair */}
            <button
                onClick={signOut}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl font-medium transition-all duration-200"
            >
                <LogOut className="w-5 h-5" />
                Sair da Conta
            </button>

            {/* Versão */}
            <p className="text-center text-xs text-slate-400 mt-6">
                App Financeiro v2.0 • Feito com ❤️
            </p>
        </div>
    );
}
