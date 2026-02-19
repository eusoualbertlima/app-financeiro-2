"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, ArrowRight, Shield, Users, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function Home() {
    const { user, loading, signInWithGoogle } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) {
            router.push("/dashboard");
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Hero Section */}
            <div className="max-w-6xl mx-auto px-4 py-20">
                <div className="text-center">
                    <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-8">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        <span className="text-blue-200 text-sm font-medium">
                            Oferta Beta: Acesso Vitalício por <span className="text-white font-bold">R$ 97,00</span>
                        </span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                        App Financeiro 2.0
                    </h1>
                    <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
                        Gerencie suas finanças em casal com simplicidade e poder.
                        Tudo sincronizado em tempo real.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={signInWithGoogle}
                            className="inline-flex items-center justify-center gap-3 bg-white text-gray-900 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-100 transition-all hover:scale-105"
                        >
                            <svg className="w-6 h-6" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Começar Agora
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <Link
                            href="/pricing"
                            className="inline-flex items-center justify-center gap-2 border border-gray-500 text-gray-200 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-800 transition-all"
                        >
                            Ver Planos
                        </Link>
                    </div>
                    <p className="mt-4 text-sm text-gray-500">Teste grátis por 7 dias, cancele quando quiser.</p>
                </div>

                {/* Features */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24">
                    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                            <Users className="w-6 h-6 text-blue-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Compartilhado</h3>
                        <p className="text-gray-400 text-sm">
                            Você e sua parceira gerenciam as finanças juntos, em tempo real.
                        </p>
                    </div>

                    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                        <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4">
                            <TrendingUp className="w-6 h-6 text-green-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Visão Completa</h3>
                        <p className="text-gray-400 text-sm">
                            Dashboards, gráficos e relatórios para entender seus gastos.
                        </p>
                    </div>

                    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                        <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                            <Shield className="w-6 h-6 text-purple-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Seguro e Privado</h3>
                        <p className="text-gray-400 text-sm">
                            Seus dados são criptografados e visíveis apenas para você.
                        </p>
                    </div>
                </div>

                <footer className="mt-16 pt-6 border-t border-gray-800 text-center text-sm text-gray-500">
                    <div className="flex items-center justify-center gap-4">
                        <Link href="/termos" className="hover:text-gray-300 transition-colors">Termos de Uso</Link>
                        <span>•</span>
                        <Link href="/privacidade" className="hover:text-gray-300 transition-colors">Política de Privacidade</Link>
                        <span>•</span>
                        <Link href="/politica-comercial" className="hover:text-gray-300 transition-colors">Política Comercial</Link>
                        <span>•</span>
                        <Link href="/suporte" className="hover:text-gray-300 transition-colors">Suporte</Link>
                    </div>
                </footer>
            </div>
        </div>
    );
}
