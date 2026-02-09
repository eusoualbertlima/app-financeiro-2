"use client";

import { useWorkspace, useCollection } from "@/hooks/useFirestore";
import {
    Wallet,
    CreditCard,
    TrendingUp,
    TrendingDown,
    Plus,
    ArrowUpRight,
    ArrowDownRight,
    ChevronRight
} from "lucide-react";
import Link from "next/link";
import type { Account, CreditCard as CardType } from "@/types";
import { Header } from "@/components/Navigation";

export default function DashboardPage() {
    const { workspace, loading: workspaceLoading } = useWorkspace();
    const { data: contas } = useCollection<Account>("accounts");
    const { data: cartoes } = useCollection<CardType>("credit_cards");

    const saldoTotal = contas.reduce((acc, conta) => acc + conta.balance, 0);
    const limiteTotal = cartoes.reduce((acc, cartao) => acc + cartao.limit, 0);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    if (workspaceLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <Header title="Dashboard" subtitle={workspace?.name} />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
                {/* Saldo Total */}
                <div className="stat-card balance">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Saldo Total</p>
                            <p className={`text-2xl lg:text-3xl font-bold ${saldoTotal >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                                {formatCurrency(saldoTotal)}
                            </p>
                            <p className="text-xs text-slate-400 mt-2">{contas.length} conta(s) ativa(s)</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                            <Wallet className="w-6 h-6 text-primary-600" />
                        </div>
                    </div>
                </div>

                {/* Limite Cartões */}
                <div className="stat-card limit">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Limite Disponível</p>
                            <p className="text-2xl lg:text-3xl font-bold text-slate-900">
                                {formatCurrency(limiteTotal)}
                            </p>
                            <p className="text-xs text-slate-400 mt-2">{cartoes.length} cartão(ões)</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-100 to-accent-200 flex items-center justify-center">
                            <CreditCard className="w-6 h-6 text-accent-600" />
                        </div>
                    </div>
                </div>

                {/* Receitas */}
                <div className="stat-card income">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Receitas do Mês</p>
                            <p className="text-2xl lg:text-3xl font-bold text-green-600">R$ 0,00</p>
                            <div className="flex items-center gap-1 mt-2">
                                <ArrowUpRight className="w-3 h-3 text-green-500" />
                                <span className="text-xs text-green-600 font-medium">0 lançamentos</span>
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>

                {/* Despesas */}
                <div className="stat-card expense">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Despesas do Mês</p>
                            <p className="text-2xl lg:text-3xl font-bold text-red-600">R$ 0,00</p>
                            <div className="flex items-center gap-1 mt-2">
                                <ArrowDownRight className="w-3 h-3 text-red-500" />
                                <span className="text-xs text-red-600 font-medium">0 lançamentos</span>
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
                            <TrendingDown className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contas */}
                <div className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="font-semibold text-slate-900">Contas Bancárias</h2>
                        <Link
                            href="/dashboard/contas"
                            className="text-sm text-primary-600 font-medium hover:text-primary-700 flex items-center gap-1"
                        >
                            Ver todas <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="p-6">
                        {contas.length === 0 ? (
                            <Link
                                href="/dashboard/contas"
                                className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50/50 transition-all duration-200"
                            >
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                    <Plus className="w-8 h-8" />
                                </div>
                                <span className="font-medium">Adicionar primeira conta</span>
                                <span className="text-sm mt-1">Nubank, Bradesco, Carteira...</span>
                            </Link>
                        ) : (
                            <div className="space-y-3">
                                {contas.slice(0, 4).map((conta) => (
                                    <div key={conta.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-lg"
                                            style={{ backgroundColor: conta.color }}
                                        >
                                            {conta.name[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-900 truncate">{conta.name}</p>
                                            <p className="text-sm text-slate-400 capitalize">
                                                {conta.type === 'checking' ? 'Conta Corrente' : conta.type === 'investment' ? 'Investimento' : 'Dinheiro'}
                                            </p>
                                        </div>
                                        <p className={`font-bold text-lg ${conta.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(conta.balance)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Cartões */}
                <div className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="font-semibold text-slate-900">Cartões de Crédito</h2>
                        <Link
                            href="/dashboard/cartoes"
                            className="text-sm text-primary-600 font-medium hover:text-primary-700 flex items-center gap-1"
                        >
                            Ver todos <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="p-6">
                        {cartoes.length === 0 ? (
                            <Link
                                href="/dashboard/cartoes"
                                className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl hover:border-accent-300 hover:text-accent-600 hover:bg-accent-50/50 transition-all duration-200"
                            >
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                    <CreditCard className="w-8 h-8" />
                                </div>
                                <span className="font-medium">Adicionar primeiro cartão</span>
                                <span className="text-sm mt-1">Nubank, Inter, XP...</span>
                            </Link>
                        ) : (
                            <div className="space-y-3">
                                {cartoes.slice(0, 4).map((cartao) => (
                                    <div key={cartao.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                                            style={{
                                                background: `linear-gradient(135deg, ${cartao.color}, ${cartao.color}dd)`
                                            }}
                                        >
                                            <CreditCard className="w-6 h-6 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-900 truncate">{cartao.name}</p>
                                            <p className="text-sm text-slate-400">
                                                Vence dia {cartao.dueDay} • <span className="capitalize">{cartao.brand}</span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-slate-900">{formatCurrency(cartao.limit)}</p>
                                            <p className="text-xs text-slate-400">limite</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
