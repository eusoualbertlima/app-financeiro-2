"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useFirestore";
import { getClientBehavioralRolloutMode, hasBehavioralRolloutAccess } from "@/lib/behavioralRollout";
import { getDefaultProfileIconSrc, normalizeProfileIcon } from "@/lib/profileIcons";
import {
    CoolAccountsIcon,
    CoolBuildingIcon,
    CoolCalendarIcon,
    CoolCloseIcon,
    CoolCreditCardIcon,
    CoolDashboardIcon,
    CoolLogOutIcon,
    CoolMenuIcon,
    CoolNoteIcon,
    CoolSettingsIcon,
    CoolShieldIcon,
    CoolTransactionsIcon,
    CoolTrendingUpIcon,
    CoolWarningIcon
} from "@/components/icons/CoolIcons";

type MenuItem = {
    href: string;
    icon: ComponentType<{ className?: string }>;
    label: string;
    adminOnly?: boolean;
    developerOnly?: boolean;
    behavioralOnly?: boolean;
};

const menuItems: MenuItem[] = [
    { href: "/dashboard", icon: CoolDashboardIcon, label: "Dashboard" },
    { href: "/dashboard/cidade", icon: CoolBuildingIcon, label: "Cidade", behavioralOnly: true },
    { href: "/dashboard/contas", icon: CoolAccountsIcon, label: "Contas" },
    { href: "/dashboard/cartoes", icon: CoolCreditCardIcon, label: "Cartões" },
    { href: "/dashboard/lancamentos", icon: CoolTransactionsIcon, label: "Lançamentos" },
    { href: "/dashboard/notas", icon: CoolNoteIcon, label: "Notas" },
    { href: "/dashboard/admin", icon: CoolShieldIcon, label: "Admin", developerOnly: true },
    { href: "/dashboard/alertas", icon: CoolWarningIcon, label: "Alertas", developerOnly: true },
    { href: "/dashboard/contas-fixas", icon: CoolCalendarIcon, label: "Contas Fixas" },
    { href: "/dashboard/configuracoes", icon: CoolSettingsIcon, label: "Configurações" },
];

function getVisibleMenuItems(
    items: MenuItem[],
    flags: { isAdmin: boolean; isDeveloperAdmin: boolean; hasBehavioralFeatureAccess: boolean }
) {
    return items.filter((item) => {
        if (item.adminOnly && !flags.isAdmin) return false;
        if (item.developerOnly && !flags.isDeveloperAdmin) return false;
        if (item.behavioralOnly && !flags.hasBehavioralFeatureAccess) return false;
        return true;
    });
}

export function Sidebar() {
    const pathname = usePathname();
    const { user, userProfile, signOut, isDeveloperAdmin } = useAuth();
    const { workspace } = useWorkspace();
    const isAdmin = workspace?.ownerId ? user?.uid === workspace.ownerId : false;
    const hasBehavioralFeatureAccess = hasBehavioralRolloutAccess({
        mode: getClientBehavioralRolloutMode(),
        isDeveloperAdmin,
    });
    const visibleMenuItems = getVisibleMenuItems(menuItems, { isAdmin, isDeveloperAdmin, hasBehavioralFeatureAccess });
    const avatarSrc =
        normalizeProfileIcon(user?.photoURL)
        || normalizeProfileIcon(userProfile?.photoURL)
        || (user?.photoURL || "").trim()
        || (userProfile?.photoURL || "").trim()
        || getDefaultProfileIconSrc();
    const displayName = user?.displayName || userProfile?.displayName || "Usuário";
    const email = user?.email || userProfile?.email || "";

    return (
        <aside className="sidebar hidden lg:flex flex-col overflow-hidden">
            {/* Logo */}
            <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-accent-500 rounded-xl flex items-center justify-center">
                        <CoolTrendingUpIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-white">Financeiro</h1>
                        <p className="text-xs text-slate-400">Gestão Inteligente</p>
                    </div>
                </div>
            </div>

            {/* Menu */}
            <nav className="flex-1 py-6 space-y-1 overflow-y-auto">
                {visibleMenuItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar-link ${isActive ? 'active' : ''}`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="flex-1">{item.label}</span>
                            {isActive && <ChevronRight className="w-4 h-4 text-primary-400" />}
                        </Link>
                    );
                })}
            </nav>

            {/* User */}
            <div className="p-4 border-t border-white/10">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 mb-3">
                    <img
                        src={avatarSrc}
                        alt={displayName}
                        className="w-10 h-10 rounded-full ring-2 ring-primary-400/50 object-cover"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{displayName}</p>
                        <p className="text-xs text-slate-400 truncate">{email}</p>
                    </div>
                </div>
                <button
                    onClick={signOut}
                    className="tap-target w-full flex items-center justify-center gap-2 px-4 py-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200"
                >
                    <CoolLogOutIcon className="w-4 h-4" />
                    <span>Sair da conta</span>
                </button>
            </div>
        </aside>
    );
}

export function MobileNav() {
    const pathname = usePathname();
    const { user, userProfile, signOut, isDeveloperAdmin } = useAuth();
    const { workspace } = useWorkspace();
    const [isOpen, setIsOpen] = useState(false);
    const isAdmin = workspace?.ownerId ? user?.uid === workspace.ownerId : false;
    const hasBehavioralFeatureAccess = hasBehavioralRolloutAccess({
        mode: getClientBehavioralRolloutMode(),
        isDeveloperAdmin,
    });
    const visibleMenuItems = getVisibleMenuItems(menuItems, { isAdmin, isDeveloperAdmin, hasBehavioralFeatureAccess });
    const activeItem = useMemo(
        () =>
            visibleMenuItems.find((item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))),
        [visibleMenuItems, pathname]
    );
    const avatarSrc =
        normalizeProfileIcon(user?.photoURL)
        || normalizeProfileIcon(userProfile?.photoURL)
        || (user?.photoURL || "").trim()
        || (userProfile?.photoURL || "").trim()
        || getDefaultProfileIconSrc();
    const displayName = user?.displayName || userProfile?.displayName || "Usuário";
    const email = user?.email || userProfile?.email || "";

    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [isOpen]);

    return (
        <>
            <header className="mobile-topbar lg:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
                <div className="mobile-topbar-inner">
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className="tap-target rounded-xl border border-slate-200 bg-white text-slate-700 px-3 inline-flex items-center justify-center"
                        aria-label="Abrir menu"
                        aria-expanded={isOpen}
                    >
                        <CoolMenuIcon className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-accent-500 rounded-lg flex items-center justify-center shrink-0">
                            <CoolTrendingUpIcon className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Financeiro</p>
                            <p className="text-sm font-semibold text-slate-900 truncate">{activeItem?.label || "Dashboard"}</p>
                        </div>
                    </div>

                    <Link
                        href="/dashboard/configuracoes"
                        className="tap-target rounded-xl border border-slate-200 bg-white text-slate-700 px-3 inline-flex items-center justify-center"
                        aria-label="Abrir configurações"
                    >
                        <CoolSettingsIcon className="w-5 h-5" />
                    </Link>
                </div>
            </header>

            <div
                className={`mobile-drawer-overlay lg:hidden ${isOpen ? "open" : ""}`}
                onClick={() => setIsOpen(false)}
                aria-hidden={!isOpen}
            />

            <aside className={`mobile-drawer lg:hidden ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
                <div className="mobile-drawer-head">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-accent-500 rounded-xl flex items-center justify-center">
                            <CoolTrendingUpIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-white">App Financeiro</h2>
                            <p className="text-xs text-slate-400">Gestão Inteligente</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="tap-target rounded-xl bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 px-3 inline-flex items-center justify-center"
                        aria-label="Fechar menu"
                    >
                        <CoolCloseIcon className="w-5 h-5" />
                    </button>
                </div>

                <nav className="mobile-drawer-nav">
                    {visibleMenuItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`mobile-drawer-link ${isActive ? "active" : ""}`}
                            >
                                <item.icon className="w-5 h-5 shrink-0" />
                                <span className="flex-1">{item.label}</span>
                                {isActive && <ChevronRight className="w-4 h-4 text-sky-300" />}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mobile-drawer-foot">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                        <img
                            src={avatarSrc}
                            alt={displayName}
                            className="w-10 h-10 rounded-full ring-2 ring-primary-400/50 object-cover"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate">{displayName}</p>
                            <p className="text-xs text-slate-400 truncate">{email}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void signOut()}
                        className="tap-target mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
                    >
                        <CoolLogOutIcon className="w-4 h-4" />
                        <span>Sair da conta</span>
                    </button>
                </div>
            </aside>
        </>
    );
}

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <header className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="text-slate-500 mt-1">{subtitle}</p>}
        </header>
    );
}
