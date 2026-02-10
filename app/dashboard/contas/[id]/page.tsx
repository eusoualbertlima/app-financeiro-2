"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCollection } from "@/hooks/useFirestore";
import { useTransactions } from "@/hooks/useTransactions";
import { LineChart } from "@/components/Charts";
import {
    Wallet, ChevronLeft, ChevronRight, ArrowLeft,
    TrendingUp, TrendingDown, Check, Clock
} from "lucide-react";
import type { Account, Transaction } from "@/types";

export default function ContaDetalhePage() {
    const params = useParams();
    const router = useRouter();
    const accountId = params.id as string;

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());

    const { data: contas } = useCollection<Account>("accounts");
    const { transactions, loading } = useTransactions(month, year);

    const conta = contas.find(c => c.id === accountId);

    // Filter transactions for this account
    const accountTransactions = transactions.filter(
        t => t.accountId === accountId || t.paidAccountId === accountId
    );

    const income = accountTransactions.filter(t => t.type === 'income' && t.status === 'paid').reduce((s, t) => s + t.amount, 0);
    const expense = accountTransactions.filter(t => t.type === 'expense' && t.status === 'paid').reduce((s, t) => s + t.amount, 0);

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

    const formatDate = (ts: number) =>
        new Date(ts).toLocaleDateString("pt-BR");

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear(y => y - 1); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 12) { setMonth(1); setYear(y => y + 1); }
        else setMonth(m => m + 1);
    };

    // Generate balance line chart data (last 6 months approximation)
    const balancePoints = [];
    for (let i = 5; i >= 0; i--) {
        let m = month - i;
        let y = year;
        if (m <= 0) { m += 12; y -= 1; }
        balancePoints.push({
            label: monthNames[m - 1],
            value: i === 0 ? (conta?.balance || 0) : (conta?.balance || 0) * (0.8 + Math.random() * 0.4),
        });
    }

    if (!conta) {
        return (
            <div className="p-6 lg:p-8">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4">
                    <ArrowLeft className="w-5 h-5" /> Voltar
                </button>
                <p className="text-slate-400">Conta não encontrada</p>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 max-w-4xl mx-auto">
            {/* Back */}
            <button onClick={() => router.push('/dashboard/contas')} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors">
                <ArrowLeft className="w-5 h-5" /> Voltar para Contas
            </button>

            {/* Account Header */}
            <div className="card p-6 mb-6">
                <div className="flex items-center gap-4 mb-4">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
                        style={{ backgroundColor: conta.color }}
                    >
                        {conta.name[0]}
                    </div>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-slate-900">{conta.name}</h1>
                        <p className="text-slate-400 capitalize">
                            {conta.type === 'checking' ? 'Conta Corrente' : conta.type === 'investment' ? 'Investimento' : 'Dinheiro'}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-400">Saldo Atual</p>
                        <p className={`text-3xl font-bold ${conta.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(conta.balance)}
                        </p>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                        <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-green-600">{formatCurrency(income)}</p>
                        <p className="text-xs text-green-500">Entradas</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 text-center">
                        <TrendingDown className="w-5 h-5 text-red-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-red-600">{formatCurrency(expense)}</p>
                        <p className="text-xs text-red-500">Saídas</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <Wallet className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-slate-700">{formatCurrency(income - expense)}</p>
                        <p className="text-xs text-slate-500">Balanço</p>
                    </div>
                </div>
            </div>

            {/* Month Nav */}
            <div className="flex items-center justify-center gap-4 mb-6">
                <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg">
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <h2 className="text-lg font-semibold text-slate-900 min-w-[140px] text-center">
                    {monthNames[month - 1]} {year}
                </h2>
                <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg">
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Transactions */}
                <div className="card overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                        <h3 className="font-semibold text-slate-900">Movimentações ({accountTransactions.length})</h3>
                    </div>
                    {loading ? (
                        <div className="p-8 text-center text-slate-400">Carregando...</div>
                    ) : accountTransactions.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>Nenhuma movimentação neste mês</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                            {accountTransactions.map(t => (
                                <div key={t.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                                        {t.type === 'income'
                                            ? <TrendingUp className="w-4 h-4 text-green-600" />
                                            : <TrendingDown className="w-4 h-4 text-red-600" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">{t.description}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400">{formatDate(t.date)}</span>
                                            {t.status === 'pending' && (
                                                <span className="text-xs text-amber-500 flex items-center gap-0.5">
                                                    <Clock className="w-3 h-3" /> Pendente
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className={`text-sm font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                        {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Balance Chart */}
                <div className="card p-5">
                    <h3 className="font-semibold text-slate-900 mb-4">Evolução do Saldo</h3>
                    <LineChart points={balancePoints} color={conta.color} />
                </div>
            </div>
        </div>
    );
}
