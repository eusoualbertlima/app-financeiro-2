"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useFirestore";
import { resolveWorkspaceAccessDecision } from "@/lib/accessPolicy";
import { Header } from "@/components/Navigation";
import { Settings, User, Shield, Bell, Palette, LogOut, ChevronRight, UserPlus, Users, Copy, Check, CreditCard, Loader2, UserMinus } from "lucide-react";
import { updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

type BillingPlan = "monthly" | "yearly";

function normalizePlan(value: string | null | undefined): BillingPlan | null {
    if (value === "monthly" || value === "yearly") return value;
    return null;
}

export default function ConfiguracoesPage() {
    const { user, isDeveloperAdmin, signOut } = useAuth();
    const { workspace } = useWorkspace();
    const accessDecision = resolveWorkspaceAccessDecision({
        workspace,
        user: {
            uid: user?.uid,
            email: user?.email,
            isDeveloperAdmin,
        },
    });
    const access = accessDecision.accessState;
    const hasEffectiveAccess = accessDecision.hasEffectiveAccess;
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteStatus, setInviteStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [inviteMessage, setInviteMessage] = useState("");
    const [copied, setCopied] = useState(false);
    const [billingLoading, setBillingLoading] = useState<"none" | "checkout" | "portal">("none");
    const [billingMessage, setBillingMessage] = useState("");
    const [acceptedLegal, setAcceptedLegal] = useState(false);
    const [checkoutPlan, setCheckoutPlan] = useState<BillingPlan>("monthly");
    const [planHydrated, setPlanHydrated] = useState(false);
    const [leaveStatus, setLeaveStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [leaveMessage, setLeaveMessage] = useState("");
    const [profileDisplayName, setProfileDisplayName] = useState("");
    const [profilePhotoURL, setProfilePhotoURL] = useState("");
    const [profilePreviewName, setProfilePreviewName] = useState("");
    const [profilePreviewPhotoURL, setProfilePreviewPhotoURL] = useState("");
    const [profileStatus, setProfileStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [profileMessage, setProfileMessage] = useState("");

    useEffect(() => {
        if (!workspace) return;
        const alreadyAccepted = Boolean(workspace.legal?.acceptedTermsAt && workspace.legal?.acceptedPrivacyAt);
        if (alreadyAccepted) {
            setAcceptedLegal(true);
        }
    }, [workspace]);

    useEffect(() => {
        if (!workspace || planHydrated) return;

        const workspacePlan = normalizePlan(workspace.billing?.plan);
        const shouldUseWorkspacePlan = workspace.billing?.status === "active" ? workspacePlan : null;
        const storedPlan = typeof window !== "undefined"
            ? normalizePlan(window.localStorage.getItem("checkout:preferredPlan"))
            : null;

        setCheckoutPlan(storedPlan || shouldUseWorkspacePlan || "monthly");
        setPlanHydrated(true);
    }, [workspace, planHydrated]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem("checkout:preferredPlan", checkoutPlan);
    }, [checkoutPlan]);

    useEffect(() => {
        const nextName = (user?.displayName || "").trim();
        const nextPhoto = (user?.photoURL || "").trim();
        setProfileDisplayName(nextName);
        setProfilePhotoURL(nextPhoto);
        setProfilePreviewName(nextName);
        setProfilePreviewPhotoURL(nextPhoto);
    }, [user?.displayName, user?.photoURL]);

    const selectCheckoutPlan = (plan: BillingPlan) => {
        setCheckoutPlan(plan);
        setBillingMessage("");
    };
    const isWorkspaceOwner = Boolean(workspace?.ownerId && user?.uid && workspace.ownerId === user.uid);

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
        if (!inviteEmail || !workspace?.id || !user) return;

        setInviteStatus("loading");
        setInviteMessage("");

        try {
            const token = await user.getIdToken();
            const response = await fetch("/api/workspace/invite", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    workspaceId: workspace.id,
                    email: inviteEmail,
                }),
            });

            const data = (await response.json()) as {
                ok?: boolean;
                message?: string;
                error?: string;
                code?: string;
                inviteAdded?: boolean;
            };

            if (!response.ok) {
                throw new Error(data.error || "Erro ao autorizar email.");
            }

            setInviteStatus("success");
            setInviteMessage(data.message || `✅ Email ${inviteEmail} autorizado!`);
            setInviteEmail("");
        } catch (error) {
            setInviteStatus("error");
            setInviteMessage(error instanceof Error ? error.message : "Nao foi possivel autorizar este email.");
        }
    };

    const handleLeaveWorkspace = async () => {
        if (!workspace?.id || !user || isWorkspaceOwner) return;

        const confirmed = window.confirm(
            "Deseja sair deste workspace? Você perderá acesso aos dados compartilhados."
        );
        if (!confirmed) return;

        setLeaveStatus("loading");
        setLeaveMessage("");

        try {
            const token = await user.getIdToken();
            const response = await fetch("/api/workspace/leave", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    workspaceId: workspace.id,
                }),
            });

            const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
            if (!response.ok) {
                throw new Error(data.error || "Nao foi possivel sair do workspace.");
            }

            setLeaveStatus("success");
            setLeaveMessage(data.message || "Você saiu do workspace com sucesso.");
            window.setTimeout(() => {
                window.location.reload();
            }, 800);
        } catch (error) {
            setLeaveStatus("error");
            setLeaveMessage(error instanceof Error ? error.message : "Nao foi possivel sair do workspace.");
        }
    };

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const nextDisplayName = profileDisplayName.trim();
        const nextPhotoURL = profilePhotoURL.trim();

        if (!nextDisplayName) {
            setProfileStatus("error");
            setProfileMessage("Informe um nickname/nome de exibição.");
            return;
        }

        setProfileStatus("loading");
        setProfileMessage("");

        try {
            await updateProfile(user, {
                displayName: nextDisplayName,
                photoURL: nextPhotoURL || null,
            });

            await setDoc(
                doc(db, "users", user.uid),
                {
                    uid: user.uid,
                    email: user.email || "",
                    displayName: nextDisplayName,
                    photoURL: nextPhotoURL || "",
                    updatedAt: Date.now(),
                    lastSeenAt: Date.now(),
                },
                { merge: true }
            );

            setProfilePreviewName(nextDisplayName);
            setProfilePreviewPhotoURL(nextPhotoURL);
            setProfileStatus("success");
            setProfileMessage("Perfil atualizado com sucesso.");
        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            setProfileStatus("error");
            setProfileMessage("Nao foi possivel atualizar o perfil agora.");
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
                    plan: checkoutPlan,
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
                    {profilePreviewPhotoURL ? (
                        <img
                            src={profilePreviewPhotoURL}
                            alt={profilePreviewName || "Usuário"}
                            className="w-16 h-16 rounded-full ring-2 ring-primary-400/50 object-cover"
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-2xl font-bold">
                            {(profilePreviewName || user?.displayName || "?")[0] || "?"}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900 truncate">
                            {profilePreviewName || user?.displayName || "Usuário"}
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
                        {hasEffectiveAccess && !access.hasAccess
                            ? accessDecision.reason === "dev_admin"
                                ? "internal_active"
                                : "workspace_internal_active"
                            : access.status}
                    </span>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                    {hasEffectiveAccess && !access.hasAccess
                        ? accessDecision.reason === "dev_admin"
                        ? "Acesso interno liberado por conta dev-admin (bypass de cobrança ativo somente para sua conta)."
                        : "Acesso interno liberado para membros deste workspace porque o dono é uma conta dev-admin."
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
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                    <button
                        type="button"
                        onClick={() => selectCheckoutPlan("monthly")}
                        className={`rounded-lg py-2 text-sm font-semibold transition-colors ${checkoutPlan === "monthly"
                            ? "bg-primary-600 text-white"
                            : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        Mensal
                    </button>
                    <button
                        type="button"
                        onClick={() => selectCheckoutPlan("yearly")}
                        className={`rounded-lg py-2 text-sm font-semibold transition-colors ${checkoutPlan === "yearly"
                            ? "bg-primary-600 text-white"
                            : "text-slate-600 hover:text-slate-900"
                            }`}
                    >
                        Anual
                    </button>
                </div>
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
                                    {!isWorkspaceOwner && (
                                        <p className="text-xs text-amber-600 mb-4">
                                            Apenas o dono do workspace pode autorizar novos membros.
                                        </p>
                                    )}

                                    <form onSubmit={handleInvite} className="flex gap-2 mb-4">
                                        <input
                                            type="email"
                                            value={inviteEmail}
                                            onChange={e => setInviteEmail(e.target.value)}
                                            placeholder="email@gmail.com"
                                            className="input flex-1"
                                            disabled={!isWorkspaceOwner}
                                            required
                                        />
                                        <button
                                            type="submit"
                                            className="btn-primary whitespace-nowrap"
                                            disabled={inviteStatus === "loading" || !isWorkspaceOwner}
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
                                                className="icon-hitbox p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Copiar"
                                            >
                                                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                                            </button>
                                        </div>
                                        {workspace && (
                                            <p className="text-xs text-slate-400 mt-2">
                                                {(workspace.pendingInvites?.length || 0) > 0
                                                    ? `📧 ${workspace.pendingInvites?.length || 0} convite(s) pendente(s)`
                                                    : `👤 ${workspace.members?.length || 1} membro(s)`
                                                }
                                            </p>
                                        )}
                                    </div>

                                    {!isWorkspaceOwner && (
                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <p className="text-xs text-slate-500 mb-3">
                                                Você está como convidado neste workspace.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleLeaveWorkspace}
                                                disabled={leaveStatus === "loading"}
                                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-60"
                                            >
                                                {leaveStatus === "loading" ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Saindo...
                                                    </>
                                                ) : (
                                                    <>
                                                        <UserMinus className="w-4 h-4" />
                                                        Sair deste workspace
                                                    </>
                                                )}
                                            </button>
                                            {leaveMessage && (
                                                <p
                                                    className={`text-xs mt-2 ${
                                                        leaveStatus === "success" ? "text-green-600" : "text-red-600"
                                                    }`}
                                                >
                                                    {leaveMessage}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Other sections - placeholder */}
                            {activeSection === section.id && section.id === "perfil" && (
                                <div className="card p-6 mt-2 ml-4 border-l-4 border-blue-400">
                                    <div className="flex items-center gap-2 mb-4">
                                        <User className="w-5 h-5 text-blue-500" />
                                        <h3 className="font-semibold text-slate-900">Editar perfil</h3>
                                    </div>
                                    <form onSubmit={handleProfileSave} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Nickname (nome de exibição)
                                            </label>
                                            <input
                                                type="text"
                                                value={profileDisplayName}
                                                onChange={(event) => setProfileDisplayName(event.target.value)}
                                                className="input"
                                                placeholder="Ex: Albert Lima"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                URL da foto de perfil
                                            </label>
                                            <input
                                                type="url"
                                                value={profilePhotoURL}
                                                onChange={(event) => setProfilePhotoURL(event.target.value)}
                                                className="input"
                                                placeholder="https://..."
                                            />
                                            <p className="text-xs text-slate-400 mt-2">
                                                Dica: cole uma URL pública da imagem. Deixe vazio para usar inicial do nome.
                                            </p>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={profileStatus === "loading"}
                                            className="btn-primary w-full sm:w-auto"
                                        >
                                            {profileStatus === "loading" ? "Salvando..." : "Salvar perfil"}
                                        </button>
                                        {profileMessage && (
                                            <p
                                                className={`text-sm ${
                                                    profileStatus === "success" ? "text-green-600" : "text-red-600"
                                                }`}
                                            >
                                                {profileMessage}
                                            </p>
                                        )}
                                    </form>
                                </div>
                            )}

                            {activeSection === section.id && section.id !== "compartilhar" && section.id !== "perfil" && (
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

