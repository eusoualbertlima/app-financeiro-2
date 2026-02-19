"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Building2,
    Wallet,
    CreditCard,
    Receipt,
    FileText,
    AlertTriangle,
    Settings,
    LogOut,
    TrendingUp,
    ChevronRight,
    CalendarDays,
    Shield
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useFirestore";
import { getClientDevAdminAllowlist, hasDevAdminAccess } from "@/lib/devAdmin";
import { getClientBehavioralRolloutMode, hasBehavioralRolloutAccess } from "@/lib/behavioralRollout";

type MenuItem = {
    href: string;
    icon: LucideIcon;
    label: string;
    adminOnly?: boolean;
    developerOnly?: boolean;
    behavioralOnly?: boolean;
};

const menuItems: MenuItem[] = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/dashboard/cidade", icon: Building2, label: "Cidade", behavioralOnly: true },
    { href: "/dashboard/contas", icon: Wallet, label: "Contas" },
    { href: "/dashboard/cartoes", icon: CreditCard, label: "Cartões" },
    { href: "/dashboard/lancamentos", icon: Receipt, label: "Lançamentos" },
    { href: "/dashboard/notas", icon: FileText, label: "Notas" },
    { href: "/dashboard/admin", icon: Shield, label: "Admin", developerOnly: true },
    { href: "/dashboard/alertas", icon: AlertTriangle, label: "Alertas", developerOnly: true },
    { href: "/dashboard/contas-fixas", icon: CalendarDays, label: "Contas Fixas" },
    { href: "/dashboard/configuracoes", icon: Settings, label: "Configurações" },
];

const clientDevAdminAllowlist = getClientDevAdminAllowlist();

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

const mobileMenuOrder = [
    "/dashboard",
    "/dashboard/cidade",
    "/dashboard/contas",
    "/dashboard/cartoes",
    "/dashboard/lancamentos",
    "/dashboard/notas",
    "/dashboard/contas-fixas",
];

export function Sidebar() {
    const pathname = usePathname();
    const { user, signOut } = useAuth();
    const { workspace } = useWorkspace();
    const isAdmin = workspace?.ownerId ? user?.uid === workspace.ownerId : false;
    const isDeveloperAdmin = hasDevAdminAccess({
        uid: user?.uid,
        email: user?.email,
        allowlist: clientDevAdminAllowlist,
    });
    const hasBehavioralFeatureAccess = hasBehavioralRolloutAccess({
        mode: getClientBehavioralRolloutMode(),
        isDeveloperAdmin,
    });
    const visibleMenuItems = getVisibleMenuItems(menuItems, { isAdmin, isDeveloperAdmin, hasBehavioralFeatureAccess });

    return (
        <aside className="sidebar hidden lg:flex flex-col z-50">
            {/* Logo */}
            <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-accent-500 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg text-white">Financeiro</h1>
                        <p className="text-xs text-slate-400">Gestão Inteligente</p>
                    </div>
                </div>
            </div>

            {/* Menu */}
            <nav className="flex-1 py-6 space-y-1">
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
                    {user?.photoURL ? (
                        <Image
                            src={user.photoURL}
                            alt={user.displayName || "Usuário"}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full ring-2 ring-primary-400/50"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-bold">
                            {user?.displayName?.[0]}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{user?.displayName}</p>
                        <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                    </div>
                </div>
                <button
                    onClick={signOut}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Sair da conta</span>
                </button>
            </div>
        </aside>
    );
}

export function MobileNav() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { workspace } = useWorkspace();
    const isAdmin = workspace?.ownerId ? user?.uid === workspace.ownerId : false;
    const isDeveloperAdmin = hasDevAdminAccess({
        uid: user?.uid,
        email: user?.email,
        allowlist: clientDevAdminAllowlist,
    });
    const hasBehavioralFeatureAccess = hasBehavioralRolloutAccess({
        mode: getClientBehavioralRolloutMode(),
        isDeveloperAdmin,
    });
    const visibleMenuItems = getVisibleMenuItems(menuItems, { isAdmin, isDeveloperAdmin, hasBehavioralFeatureAccess });
    const mobileMenuItems = mobileMenuOrder
        .map((href) => visibleMenuItems.find(item => item.href === href))
        .filter((item): item is MenuItem => Boolean(item));

    return (
        <nav className="mobile-nav lg:hidden">
            <div className="flex gap-1 overflow-x-auto py-2 px-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {mobileMenuItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex min-w-[72px] shrink-0 flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 ${isActive
                                ? "text-primary-500 bg-primary-50"
                                : "text-slate-400 hover:text-slate-600"
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                            <span className="text-xs font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
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
