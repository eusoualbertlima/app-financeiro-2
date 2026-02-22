"use client";

import { useMemo, useState } from "react";
import { useWorkspace, useCollection } from "@/hooks/useFirestore";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactions } from "@/hooks/useTransactions";
import { useBillPayments } from "@/hooks/useBills";
import { useCardsLimitSummary } from "@/hooks/useCardLimits";
import {
    Wallet,
    Building2,
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
import { BarChart, DonutChart, LineChart } from "@/components/Charts";
import { OnboardingGuide } from "@/components/OnboardingGuide";
import { getClientBehavioralRolloutMode, hasBehavioralRolloutAccess } from "@/lib/behavioralRollout";

type ChartPeriod = "daily" | "weekly" | "monthly" | "yearly";

type TimeBucket = {
    label: string;
    start: number;
    end: number;
};

const PERIOD_OPTIONS: Array<{ value: ChartPeriod; shortLabel: string; label: string }> = [
    { value: "daily", shortLabel: "D", label: "Diário" },
    { value: "weekly", shortLabel: "S", label: "Semanal" },
    { value: "monthly", shortLabel: "M", label: "Mensal" },
    { value: "yearly", shortLabel: "A", label: "Anual" },
];

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

const DEFAULT_CATEGORIES = [
    { id: "alimentacao", name: "Alimentação", icon: "🍔", color: "#f59e0b" },
    { id: "transporte", name: "Transporte", icon: "🚗", color: "#3b82f6" },
    { id: "moradia", name: "Moradia", icon: "🏠", color: "#8b5cf6" },
    { id: "saude", name: "Saúde", icon: "💊", color: "#ef4444" },
    { id: "lazer", name: "Lazer", icon: "🎮", color: "#ec4899" },
    { id: "educacao", name: "Educação", icon: "📚", color: "#14b8a6" },
    { id: "salario", name: "Salário", icon: "💰", color: "#22c55e" },
    { id: "outros", name: "Outros", icon: "📦", color: "#6b7280" },
];

function formatPeriodRangeLabel(period: ChartPeriod, start: number, endExclusive: number) {
    const startDate = new Date(start);
    const endDate = new Date(endExclusive - 1);

    if (period === "daily") {
        return startDate.toLocaleDateString("pt-BR");
    }
    if (period === "weekly") {
        return `${startDate.toLocaleDateString("pt-BR")} - ${endDate.toLocaleDateString("pt-BR")}`;
    }
    if (period === "monthly") {
        return `${MONTH_NAMES[startDate.getMonth()]} ${startDate.getFullYear()}`;
    }
    return `${startDate.getFullYear()}`;
}

function getPeriodRange(period: ChartPeriod, baseDate: Date) {
    const reference = new Date(baseDate);
    reference.setHours(0, 0, 0, 0);

    if (period === "daily") {
        const start = reference.getTime();
        const end = start + 24 * 60 * 60 * 1000;
        return { start, end };
    }

    if (period === "weekly") {
        const weekStart = new Date(reference);
        const day = weekStart.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        weekStart.setDate(weekStart.getDate() + diffToMonday);
        const start = weekStart.getTime();
        const end = start + 7 * 24 * 60 * 60 * 1000;
        return { start, end };
    }

    if (period === "monthly") {
        const monthStart = new Date(reference.getFullYear(), reference.getMonth(), 1).getTime();
        const monthEnd = new Date(reference.getFullYear(), reference.getMonth() + 1, 1).getTime();
        return { start: monthStart, end: monthEnd };
    }

    const yearStart = new Date(reference.getFullYear(), 0, 1).getTime();
    const yearEnd = new Date(reference.getFullYear() + 1, 0, 1).getTime();
    return { start: yearStart, end: yearEnd };
}

function createTimeBuckets(period: ChartPeriod, start: number, end: number): TimeBucket[] {
    if (period === "daily") {
        const buckets: TimeBucket[] = [];
        for (let hour = 0; hour < 24; hour += 4) {
            const bucketStart = start + hour * 60 * 60 * 1000;
            const bucketEnd = Math.min(end, bucketStart + 4 * 60 * 60 * 1000);
            buckets.push({
                label: `${String(hour).padStart(2, "0")}h`,
                start: bucketStart,
                end: bucketEnd,
            });
        }
        return buckets;
    }

    if (period === "weekly") {
        return WEEKDAY_NAMES.map((weekday, index) => {
            const bucketStart = start + index * 24 * 60 * 60 * 1000;
            const bucketEnd = Math.min(end, bucketStart + 24 * 60 * 60 * 1000);
            return { label: weekday, start: bucketStart, end: bucketEnd };
        });
    }

    if (period === "monthly") {
        const buckets: TimeBucket[] = [];
        let cursor = start;
        let week = 1;
        while (cursor < end) {
            const bucketEnd = Math.min(end, cursor + 7 * 24 * 60 * 60 * 1000);
            buckets.push({
                label: `S${week}`,
                start: cursor,
                end: bucketEnd,
            });
            cursor = bucketEnd;
            week += 1;
        }
        return buckets;
    }

    return MONTH_NAMES.map((month, index) => {
        const year = new Date(start).getFullYear();
        const bucketStart = new Date(year, index, 1).getTime();
        const bucketEnd = new Date(year, index + 1, 1).getTime();
        return { label: month, start: bucketStart, end: bucketEnd };
    }).filter((bucket) => bucket.start < end && bucket.end > start);
}

export default function DashboardPage() {
    const { isDeveloperAdmin } = useAuth();
    const { workspace, loading: workspaceLoading } = useWorkspace();
    const { data: contas } = useCollection<Account>("accounts");
    const { data: cartoes } = useCollection<CardType>("credit_cards");
    const { data: recurringBills } = useCollection<RecurringBill>("recurring_bills");
    const { summaryByCard, totals: cardTotals, loading: cardLimitsLoading } = useCardsLimitSummary(cartoes);

    // Dados do mês atual para cards/listas.
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const todayKey = `${currentYear}-${currentMonth}-${now.getDate()}`;
    const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("monthly");

    const { transactions, totals } = useTransactions(currentMonth, currentYear);
    const { transactions: allTransactions, loading: allTransactionsLoading } = useTransactions();
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

    const showBehavioralCityButton = hasBehavioralRolloutAccess({
        mode: getClientBehavioralRolloutMode(),
        isDeveloperAdmin,
    });

    const chartAnalytics = useMemo(() => {
        const periodRange = getPeriodRange(chartPeriod, now);
        const buckets = createTimeBuckets(chartPeriod, periodRange.start, periodRange.end);

        const inRangePaidTransactions = allTransactions.filter(
            (transaction) =>
                transaction.status === "paid"
                && transaction.source !== "transfer"
                && transaction.date >= periodRange.start
                && transaction.date < periodRange.end
        );

        const income = inRangePaidTransactions
            .filter((transaction) => transaction.type === "income")
            .reduce((acc, transaction) => acc + transaction.amount, 0);
        const expense = inRangePaidTransactions
            .filter((transaction) => transaction.type === "expense")
            .reduce((acc, transaction) => acc + transaction.amount, 0);

        const categorySegments = DEFAULT_CATEGORIES.map((category) => ({
            label: category.name,
            icon: category.icon,
            value: inRangePaidTransactions
                .filter(
                    (transaction) =>
                        transaction.type === "expense"
                        && (transaction.categoryId || "outros") === category.id
                )
                .reduce((sum, transaction) => sum + transaction.amount, 0),
            color: category.color,
        })).filter((category) => category.value > 0);

        const barData = buckets.map((bucket) => {
            const periodTransactions = inRangePaidTransactions.filter(
                (transaction) => transaction.date >= bucket.start && transaction.date < bucket.end
            );

            return {
                label: bucket.label,
                income: periodTransactions
                    .filter((transaction) => transaction.type === "income")
                    .reduce((acc, transaction) => acc + transaction.amount, 0),
                expense: periodTransactions
                    .filter((transaction) => transaction.type === "expense")
                    .reduce((acc, transaction) => acc + transaction.amount, 0),
            };
        });

        let runningBalance = 0;
        const linePoints = barData.map((point) => {
            runningBalance += point.income - point.expense;
            return {
                label: point.label,
                value: runningBalance,
            };
        });

        return {
            periodLabel: formatPeriodRangeLabel(chartPeriod, periodRange.start, periodRange.end),
            transactionsCount: inRangePaidTransactions.length,
            income,
            expense,
            balance: income - expense,
            categorySegments,
            barData,
            linePoints,
        };
    }, [chartPeriod, allTransactions, todayKey]);

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
            <Header title="Dashboard" subtitle={`${workspace?.name} • ${MONTH_NAMES[currentMonth - 1]} ${currentYear}`} />

            <OnboardingGuide
                workspaceId={workspace?.id}
                accountsCount={contas.length}
                cardsCount={cartoes.length}
                transactionsCount={transactions.length}
                recurringBillsCount={recurringBills.filter((bill) => bill.isActive).length}
            />

            {showBehavioralCityButton && (
                <div className="mb-6 flex justify-end">
                    <Link
                        href="/dashboard/cidade"
                        className="btn-secondary inline-flex items-center gap-2"
                    >
                        <Building2 className="w-4 h-4" />
                        Abrir Cidade Financeira
                    </Link>
                </div>
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

            {/* Gráficos por Período (R002) */}
            <div className="mb-6">
                <div className="card p-4 sm:p-5 mb-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="font-semibold text-slate-900">Análises por Período</h3>
                            <p className="text-sm text-slate-500">
                                {chartAnalytics.periodLabel} • {chartAnalytics.transactionsCount} lançamento(s) pago(s)
                            </p>
                        </div>
                        <div className="inline-flex w-full sm:w-auto items-center rounded-xl bg-slate-100 p-1">
                            {PERIOD_OPTIONS.map((option) => {
                                const isActive = chartPeriod === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setChartPeriod(option.value)}
                                        className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                            ? "bg-white text-primary-700 shadow-sm"
                                            : "text-slate-500 hover:text-slate-700"
                                            }`}
                                        aria-pressed={isActive}
                                    >
                                        <span className="sm:hidden">{option.shortLabel}</span>
                                        <span className="hidden sm:inline">{option.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {allTransactionsLoading ? (
                    <div className="card p-8 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <div className="card p-5">
                            <h3 className="font-semibold text-slate-900 mb-4">Despesas por Categoria</h3>
                            <DonutChart segments={chartAnalytics.categorySegments} size={180} />
                        </div>

                        <div className="card p-5">
                            <h3 className="font-semibold text-slate-900 mb-4">Receitas vs Despesas</h3>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                <div className="rounded-xl bg-green-50 p-2.5">
                                    <p className="text-[11px] text-slate-500 mb-1">Receitas</p>
                                    <p className="text-sm sm:text-base font-bold text-green-600">{formatCurrency(chartAnalytics.income)}</p>
                                </div>
                                <div className="rounded-xl bg-red-50 p-2.5">
                                    <p className="text-[11px] text-slate-500 mb-1">Despesas</p>
                                    <p className="text-sm sm:text-base font-bold text-red-600">{formatCurrency(chartAnalytics.expense)}</p>
                                </div>
                                <div className={`rounded-xl p-2.5 ${chartAnalytics.balance >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
                                    <p className="text-[11px] text-slate-500 mb-1">Balanço</p>
                                    <p className={`text-sm sm:text-base font-bold ${chartAnalytics.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                        {formatCurrency(chartAnalytics.balance)}
                                    </p>
                                </div>
                            </div>
                            <BarChart data={chartAnalytics.barData} />
                        </div>

                        <div className="card p-5 xl:col-span-3">
                            <h3 className="font-semibold text-slate-900 mb-1">Saldo Acumulado</h3>
                            <p className="text-sm text-slate-500 mb-4">
                                Evolução do saldo dentro do período selecionado
                            </p>
                            <div className="max-w-5xl mx-auto">
                                <LineChart
                                    points={chartAnalytics.linePoints}
                                    color={chartAnalytics.balance >= 0 ? "#22c55e" : "#ef4444"}
                                    heightClassName="h-32 sm:h-36 lg:h-40"
                                />
                            </div>
                        </div>
                    </div>
                )}
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
