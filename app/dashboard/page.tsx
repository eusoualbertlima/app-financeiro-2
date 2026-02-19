"use client";

import { useWorkspace, useCollection } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/hooks/useTransactions";
import { useBillPayments } from "@/hooks/useBills";
import { useCardsLimitSummary } from "@/hooks/useCardLimits";
import {
    Wallet,
    CreditCard,
    TrendingUp,
    TrendingDown,
    Plus,
    ArrowUpRight,
    ArrowDownRight,
    ChevronRight,
    CalendarDays,
    Check,
    Clock,
    AlertTriangle,
    Receipt
} from "lucide-react";
import Link from "next/link";
import type { Account, CreditCard as CardType, RecurringBill } from "@/types";
import { Header } from "@/components/Navigation";
import { DonutChart } from "@/components/Charts";
import { OnboardingGuide } from "@/components/OnboardingGuide";
import { BehavioralCityCard } from "@/components/BehavioralCityCard";
import { normalizeBehavioralMetrics } from "@/lib/behavioralMetrics";
import { getClientDevAdminAllowlist, hasDevAdminAccess } from "@/lib/devAdmin";

const clientDevAllowlist = getClientDevAdminAllowlist();

type BehavioralRolloutMode = "off" | "dev_admin" | "all";

function getBehavioralRolloutMode(): BehavioralRolloutMode {
    const raw = (process.env.NEXT_PUBLIC_BEHAVIORAL_CITY_ROLLOUT || "dev_admin").trim().toLowerCase();
    if (raw === "all") return "all";
    if (raw === "off") return "off";
    return "dev_admin";
}

export default function DashboardPage() {
    const { user } = useAuth();
    const { workspace, loading: workspaceLoading } = useWorkspace();
    const { data: contas } = useCollection<Account>("accounts");
    const { data: cartoes } = useCollection<CardType>("credit_cards");
    const { data: recurringBills } = useCollection<RecurringBill>("recurring_bills");
    const { summaryByCard, totals: cardTotals, loading: cardLimitsLoading } = useCardsLimitSummary(cartoes);

    // Dados do mês atual
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const { transactions, totals } = useTransactions(currentMonth, currentYear);
    const { payments, summary: billSummary } = useBillPayments(currentMonth, currentYear);

    const saldoTotal = contas.reduce((acc, conta) => acc + conta.balance, 0);
    const limiteTotal = cardTotals.totalLimit;
    const limiteDisponivel = cardLimitsLoading ? limiteTotal : cardTotals.totalAvailable;
    const limiteComprometido = cardLimitsLoading ? 0 : cardTotals.totalOutstanding;

    const paidExpenseTransactions = transactions.filter(
        (transaction) =>
            transaction.type === 'expense'
            && transaction.status === 'paid'
            && transaction.source !== 'transfer'
    );
    const paidFixedExpenseTransactions = paidExpenseTransactions.filter(
        (transaction) => transaction.source === 'bill_payment'
    );
    const paidManualExpenseTransactions = paidExpenseTransactions.filter(
        (transaction) => transaction.source !== 'bill_payment'
    );

    // totals.expense já inclui despesas manuais + contas fixas pagas (source='bill_payment')
    const totalDespesasMes = totals.expense;
    const totalReceitasMes = totals.income;

    // Contas fixas pendentes/atrasadas
    const pendingBills = payments
        .filter(p => p.status === 'pending' || p.status === 'overdue')
        .sort((a, b) => a.dueDay - b.dueDay);
    const pendingBillsAmount = pendingBills.reduce((acc, p) => acc + p.amount, 0);

    // Saldo Projetado (mês atual)
    // = Saldo Atual + receitas pendentes - (despesas pendentes + contas fixas pendentes/atrasadas + faturas em aberto)
    const pendingIncomeTransactions = transactions
        .filter(t => t.type === 'income' && t.status === 'pending' && t.source !== 'transfer')
        .reduce((acc, t) => acc + t.amount, 0);

    const pendingExpenseTransactions = transactions
        .filter(t => t.type === 'expense' && t.status === 'pending' && t.source !== 'transfer')
        .reduce((acc, t) => acc + t.amount, 0);

    const projectedPendingBillsAmount = pendingBillsAmount;

    // Reaproveita o mesmo agregado do card principal para manter consistência.
    const projectedUnpaidCardStatementsAmount = limiteComprometido;

    const projectedBalance = saldoTotal + pendingIncomeTransactions - (
        pendingExpenseTransactions
        + projectedPendingBillsAmount
        + projectedUnpaidCardStatementsAmount
    );

    // Últimas transações (5 mais recentes)
    const recentTransactions = transactions.slice(0, 5);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const behavioralMetrics = normalizeBehavioralMetrics(workspace?.behavioralMetrics, {
        members: workspace?.members || [],
    });
    const behavioralRolloutMode = getBehavioralRolloutMode();
    const isDeveloperAdmin = hasDevAdminAccess({
        uid: user?.uid,
        email: user?.email,
        allowlist: clientDevAllowlist,
    });
    const showBehavioralCityCard = behavioralRolloutMode === "all"
        || (behavioralRolloutMode === "dev_admin" && isDeveloperAdmin);

    const defaultCategories = [
        { id: 'alimentacao', name: 'Alimentação', icon: '🍔', color: '#f59e0b' },
        { id: 'transporte', name: 'Transporte', icon: '🚗', color: '#3b82f6' },
        { id: 'moradia', name: 'Moradia', icon: '🏠', color: '#8b5cf6' },
        { id: 'saude', name: 'Saúde', icon: '💊', color: '#ef4444' },
        { id: 'lazer', name: 'Lazer', icon: '🎮', color: '#ec4899' },
        { id: 'educacao', name: 'Educação', icon: '📚', color: '#14b8a6' },
        { id: 'salario', name: 'Salário', icon: '💰', color: '#22c55e' },
        { id: 'outros', name: 'Outros', icon: '📦', color: '#6b7280' },
    ];

    // Data for category donut chart
    const categorySegments = defaultCategories.map(cat => ({
        label: cat.name,
        icon: cat.icon,
        value: transactions.filter(t =>
            t.type === 'expense'
            && (t.categoryId || 'outros') === cat.id
            && t.status === 'paid'
            && t.source !== 'transfer'
        )
            .reduce((s, t) => s + t.amount, 0),
        color: cat.color,
    })).filter(c => c.value > 0);

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'paid':
                return { icon: Check, color: 'text-green-600', bg: 'bg-green-100', label: 'Pago' };
            case 'overdue':
                return { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', label: 'Atrasado' };
            default:
                return { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Pendente' };
        }
    };

    if (workspaceLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            <Header title="Dashboard" subtitle={`${workspace?.name} • ${monthNames[currentMonth - 1]} ${currentYear}`} />

            <OnboardingGuide
                workspaceId={workspace?.id}
                accountsCount={contas.length}
                cardsCount={cartoes.length}
                transactionsCount={transactions.length}
                recurringBillsCount={recurringBills.filter((bill) => bill.isActive).length}
            />

            {showBehavioralCityCard && (
                <BehavioralCityCard
                    metrics={behavioralMetrics}
                    membersCount={workspace?.members?.length || 1}
                />
            )}

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
                                {formatCurrency(limiteDisponivel)}
                            </p>
                            <p className="text-xs text-slate-400 mt-2">
                                {cartoes.length} cartão(ões) • Em aberto {formatCurrency(limiteComprometido)}
                            </p>
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
                            <p className="text-2xl lg:text-3xl font-bold text-green-600">
                                {formatCurrency(totalReceitasMes)}
                            </p>
                            <div className="flex items-center gap-1 mt-2">
                                <ArrowUpRight className="w-3 h-3 text-green-500" />
                                <span className="text-xs text-green-600 font-medium">
                                    {transactions.filter(t => t.type === 'income' && t.source !== 'transfer').length} lançamento(s)
                                </span>
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
                            <p className="text-2xl lg:text-3xl font-bold text-red-600">
                                {formatCurrency(totalDespesasMes)}
                            </p>
                            <div className="flex items-center gap-1 mt-2">
                                <ArrowDownRight className="w-3 h-3 text-red-500" />
                                <span className="text-xs text-red-600 font-medium">
                                    {paidManualExpenseTransactions.length} lançamento(s) + {paidFixedExpenseTransactions.length} conta(s) fixa(s)
                                </span>
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
                            <TrendingDown className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                </div>

                {/* Projeção */}
                <div className="stat-card">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Saldo Projetado</p>
                            <p className={`text-2xl lg:text-3xl font-bold ${projectedBalance >= 0 ? 'text-primary-600' : 'text-red-600'}`}>
                                {formatCurrency(projectedBalance)}
                            </p>
                            <div className="flex flex-col gap-0.5 mt-2">
                                <p className="text-xs text-slate-400">
                                    + {formatCurrency(pendingIncomeTransactions)} a receber
                                </p>
                                <p className="text-xs text-slate-400">
                                    - {formatCurrency(pendingExpenseTransactions)} pendente de lançamentos
                                </p>
                                <p className="text-xs text-slate-400">
                                    - {formatCurrency(projectedPendingBillsAmount)} contas fixas pendentes
                                </p>
                                <p className="text-xs text-slate-400">
                                    - {formatCurrency(projectedUnpaidCardStatementsAmount)} faturas em aberto
                                </p>
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
                            <CalendarDays className="w-6 h-6 text-primary-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Contas Fixas Pendentes */}
            {pendingBills.length > 0 && (
                <div className="card overflow-hidden mb-6">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-amber-500" />
                            <h2 className="font-semibold text-slate-900">Contas Fixas Pendentes</h2>
                            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                {pendingBills.length}
                            </span>
                        </div>
                        <Link
                            href="/dashboard/contas-fixas"
                            className="text-sm text-primary-600 font-medium hover:text-primary-700 flex items-center gap-1"
                        >
                            Ver todas <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {pendingBills.slice(0, 5).map((payment) => {
                            const status = getStatusInfo(payment.status);
                            const StatusIcon = status.icon;
                            return (
                                <div key={payment.id} className="px-6 py-3 flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl ${status.bg} flex items-center justify-center`}>
                                        <StatusIcon className={`w-5 h-5 ${status.color}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-900 text-sm">{payment.billName}</p>
                                        <p className="text-xs text-slate-400">Vence dia {payment.dueDay}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-slate-900">{formatCurrency(payment.amount)}</p>
                                        <p className={`text-xs font-medium ${status.color}`}>{status.label}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Resumo Contas Fixas */}
            {payments.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-slate-900">{billSummary.total}</p>
                        <p className="text-sm text-slate-500">Total Fixas</p>
                    </div>
                    <div className="card p-4 text-center border-l-4 border-green-500">
                        <p className="text-2xl font-bold text-green-600">{billSummary.paid}</p>
                        <p className="text-sm text-slate-500">Pagas</p>
                    </div>
                    <div className="card p-4 text-center border-l-4 border-amber-500">
                        <p className="text-2xl font-bold text-amber-600">{billSummary.pending}</p>
                        <p className="text-sm text-slate-500">Pendentes</p>
                    </div>
                    <div className="card p-4 text-center border-l-4 border-red-500">
                        <p className="text-2xl font-bold text-red-600">{billSummary.overdue}</p>
                        <p className="text-sm text-slate-500">Atrasadas</p>
                    </div>
                    <div className="card p-4 text-center border-l-4 border-slate-400">
                        <p className="text-2xl font-bold text-slate-600">{billSummary.skipped}</p>
                        <p className="text-sm text-slate-500">Puladas</p>
                    </div>
                </div>
            )}

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Donut: Despesas por Categoria */}
                <div className="card p-5">
                    <h3 className="font-semibold text-slate-900 mb-4">Despesas por Categoria</h3>
                    <DonutChart segments={categorySegments} size={180} />
                </div>

                {/* Resumo Receitas vs Despesas */}
                <div className="card p-5">
                    <h3 className="font-semibold text-slate-900 mb-4">Receitas vs Despesas</h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500">Receitas</span>
                                <span className="font-bold text-green-600">{formatCurrency(totalReceitasMes)}</span>
                            </div>
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${totalReceitasMes + totalDespesasMes > 0 ? (totalReceitasMes / (totalReceitasMes + totalDespesasMes)) * 100 : 50}%` }} />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500">Despesas</span>
                                <span className="font-bold text-red-600">{formatCurrency(totalDespesasMes)}</span>
                            </div>
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${totalReceitasMes + totalDespesasMes > 0 ? (totalDespesasMes / (totalReceitasMes + totalDespesasMes)) * 100 : 50}%` }} />
                            </div>
                        </div>
                        <div className="pt-3 border-t border-slate-100">
                            <div className="flex justify-between">
                                <span className="text-sm font-medium text-slate-500">Balanço do Mês</span>
                                <span className={`text-lg font-bold ${totalReceitasMes - totalDespesasMes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(totalReceitasMes - totalDespesasMes)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Últimos Lançamentos */}
                <div className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-primary-500" />
                            <h2 className="font-semibold text-slate-900">Últimos Lançamentos</h2>
                        </div>
                        <Link
                            href="/dashboard/lancamentos"
                            className="text-sm text-primary-600 font-medium hover:text-primary-700 flex items-center gap-1"
                        >
                            Ver todos <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="p-4">
                        {recentTransactions.length === 0 ? (
                            <Link
                                href="/dashboard/lancamentos"
                                className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50/50 transition-all duration-200"
                            >
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                    <Plus className="w-8 h-8" />
                                </div>
                                <span className="font-medium">Adicionar primeiro lançamento</span>
                                <span className="text-sm mt-1">Receitas, despesas...</span>
                            </Link>
                        ) : (
                            <div className="space-y-2">
                                {recentTransactions.map((t) => (
                                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                                            }`}>
                                            {t.type === 'income'
                                                ? <TrendingUp className="w-5 h-5 text-green-600" />
                                                : <TrendingDown className="w-5 h-5 text-red-600" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-900 text-sm truncate">{t.description}</p>
                                            <p className="text-xs text-slate-400">
                                                {new Date(t.date).toLocaleDateString('pt-BR')}
                                                {t.status === 'pending' && ' • Pendente'}
                                            </p>
                                        </div>
                                        <p className={`font-bold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                            {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Contas Bancárias */}
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
            </div>

            {/* Cartões - Seção separada abaixo */}
            <div className="card overflow-hidden mt-6">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                        <p className="font-bold text-slate-900">
                                            {formatCurrency(summaryByCard[cartao.id]?.available ?? cartao.limit)}
                                        </p>
                                        <p className="text-xs text-slate-400">disponível</p>
                                        <p className="text-[11px] text-slate-400">
                                            aberto {formatCurrency(summaryByCard[cartao.id]?.outstanding || 0)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
