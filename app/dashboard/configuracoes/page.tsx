"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Navigation";
import { Settings, User, Shield, Bell, Palette, LogOut, ChevronRight } from "lucide-react";

export default function ConfiguracoesPage() {
    const { user, signOut } = useAuth();
    const [activeSection, setActiveSection] = useState<string | null>(null);

    const sections = [
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

            {/* Seções */}
            <div className="space-y-3 mb-6">
                {sections.map((section) => {
                    const Icon = section.icon;
                    return (
                        <button
                            key={section.id}
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
                    );
                })}
            </div>

            {/* Conteúdo expandido */}
            {activeSection && (
                <div className="card p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Settings className="w-5 h-5 text-slate-400" />
                        <h3 className="font-semibold text-slate-900">
                            {sections.find(s => s.id === activeSection)?.title}
                        </h3>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-8 text-center">
                        <p className="text-slate-500 text-sm">
                            🚧 Esta seção está em desenvolvimento e estará disponível em breve.
                        </p>
                    </div>
                </div>
            )}

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
