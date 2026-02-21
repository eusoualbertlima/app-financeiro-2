"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCollection } from "@/hooks/useFirestore";
import { useTransactions } from "@/hooks/useTransactions";
import { LineChart } from "@/components/Charts";
import {
    Wallet, ChevronLeft, ChevronRight, ArrowLeft,
    TrendingUp, TrendingDown, Clock
} from "lucide-react";
import type { Account, Transaction } from "@/types";

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function isTransactionFromAccount(transaction: Transaction, accountId: string) {
    return transaction.accountId === accountId || transaction.paidAccountId === accountId;
}

function transactionDelta(transaction: Transaction) {
    return transaction.type === "income" ? transaction.amount : -transaction.amount;
}

function getMonthStart(month: number, year: number) {
    return new Date(year, month - 1, 1).getTime();
}

function getMonthEnd(month: number, year: number) {
    return new Date(year, month, 0, 23, 59, 59, 999).getTime();
}

export default function ContaDetalhePage() {
    const params = useParams();
    const router = useRouter();
    const accountId = params.id as string;

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());

    const { data: contas } = useCollection<Account>("accounts");
    const { transactions: allTransactions, loading } = useTransactions();

    const conta = contas.find(c => c.id === accountId);

    const accountTransactions = useMemo(
        () =>
            allTransactions
                .filter((transaction) => isTransactionFromAccount(transaction, accountId))
                .sort((a, b) => b.date - a.date),
        [allTransactions, accountId]
    );

    const paidAccountTransactions = useMemo(
        () => accountTransactions.filter(transaction => transaction.status === "paid"),
        [accountTransactions]
    );

    const monthStart = getMonthStart(month, year);
    const monthEnd = getMonthEnd(month, year);

    const monthTransactions = useMemo(
        () =>
            accountTransactions.filter((transaction) => {
                const isInMonth = transaction.date >= monthStart && transaction.date <= monthEnd;
                const isPendingFromPast = transaction.status === "pending" && transaction.date < monthStart;
                return isInMonth || isPendingFromPast;
            }),
        [accountTransactions, monthStart, monthEnd]
    );

    const monthPaidTransactions = useMemo(
        () => monthTransactions.filter(transaction => transaction.status === "paid"),
        [monthTransactions]
    );

    const income = monthPaidTransactions
        .filter(transaction => transaction.type === "income")
        .reduce((sum, transaction) => sum + transaction.amount, 0);

    const expense = monthPaidTransactions
        .filter(transaction => transaction.type === "expense")
        .reduce((sum, transaction) => sum + transaction.amount, 0);

    const monthBalance = income - expense;
    const accountBalance = conta?.balance || 0;

    const totalPaidDelta = paidAccountTransactions.reduce(
        (sum, transaction) => sum + transactionDelta(transaction),
        0
    );

    const estimatedOpeningBalance = accountBalance - totalPaidDelta;

    const paidDeltaBeforeMonth = paidAccountTransactions.reduce((sum, transaction) => {
        return transaction.date < monthStart ? sum + transactionDelta(transaction) : sum;
    }, 0);

    const paidDeltaUntilMonthEnd = paidAccountTransactions.reduce((sum, transaction) => {
        return transaction.date <= monthEnd ? sum + transactionDelta(transaction) : sum;
    }, 0);

    const monthStartBalance = estimatedOpeningBalance + paidDeltaBeforeMonth;
    const monthEndBalance = estimatedOpeningBalance + paidDeltaUntilMonthEnd;

    const balancePoints = useMemo(() => {
        return Array.from({ length: 6 }, (_, index) => {
            const offset = 5 - index;
            let targetMonth = month - offset;
            let targetYear = year;

            while (targetMonth <= 0) {
                targetMonth += 12;
                targetYear -= 1;
            }

            const targetMonthEnd = getMonthEnd(targetMonth, targetYear);
            const deltaUntilTargetMonth = paidAccountTransactions.reduce((sum, transaction) => {
                return transaction.date <= targetMonthEnd ? sum + transactionDelta(transaction) : sum;
            }, 0);

            return {
                label: monthNames[targetMonth - 1],
                value: estimatedOpeningBalance + deltaUntilTargetMonth,
            };
        });
    }, [month, year, paidAccountTransactions, estimatedOpeningBalance]);

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

    const formatDate = (ts: number) =>
        new Date(ts).toLocaleDateString("pt-BR");

    const prevMonth = () => {
        if (month === 1) {
            setMonth(12);
            setYear(currentYear => currentYear - 1);
            return;
        }
        setMonth(currentMonth => currentMonth - 1);
    };

    const nextMonth = () => {
        if (month === 12) {
            setMonth(1);
            setYear(currentYear => currentYear + 1);
            return;
        }
        setMonth(currentMonth => currentMonth + 1);
    };

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
            <button onClick={() => router.push('/dashboard/contas')} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors">
                <ArrowLeft className="w-5 h-5" /> Voltar para Contas
            </button>

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

                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                        <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-green-600">{formatCurrency(income)}</p>
                        <p className="text-xs text-green-500">Entradas do mês</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 text-center">
                        <TrendingDown className="w-5 h-5 text-red-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-red-600">{formatCurrency(expense)}</p>
                        <p className="text-xs text-red-500">Saídas do mês</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                        <Wallet className="w-5 h-5 text-slate-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-slate-700">{formatCurrency(monthBalance)}</p>
                        <p className="text-xs text-slate-500">Balanço do mês</p>
                    </div>
                </div>

                <div className="mt-3 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <span>Saldo inicial do mês: <strong className="text-slate-700">{formatCurrency(monthStartBalance)}</strong></span>
                    <span>Saldo no mês selecionado: <strong className="text-slate-700">{formatCurrency(monthEndBalance)}</strong></span>
                </div>
            </div>

            <div className="flex items-center justify-center gap-4 mb-6">
                <button onClick={prevMonth} className="icon-hitbox p-2 hover:bg-slate-100 rounded-lg">
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <h2 className="text-lg font-semibold text-slate-900 min-w-[140px] text-center">
                    {monthNames[month - 1]} {year}
                </h2>
                <button onClick={nextMonth} className="icon-hitbox p-2 hover:bg-slate-100 rounded-lg">
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                        <h3 className="font-semibold text-slate-900">Movimentações ({monthTransactions.length})</h3>
                    </div>
                    {loading ? (
                        <div className="p-8 text-center text-slate-400">Carregando...</div>
                    ) : monthTransactions.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <Wallet className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>Nenhuma movimentação neste mês</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                            {monthTransactions.map(transaction => (
                                <div key={transaction.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'}`}>
                                        {transaction.type === 'income'
                                            ? <TrendingUp className="w-4 h-4 text-green-600" />
                                            : <TrendingDown className="w-4 h-4 text-red-600" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">{transaction.description}</p>
                                        {transaction.notes && (
                                            <p className="text-xs text-slate-500 truncate">{transaction.notes}</p>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400">{formatDate(transaction.date)}</span>
                                            {transaction.status === 'pending' && (
                                                <span className="text-xs text-amber-500 flex items-center gap-0.5">
                                                    <Clock className="w-3 h-3" /> Pendente
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className={`text-sm font-bold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                        {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card p-5">
                    <h3 className="font-semibold text-slate-900 mb-4">Evolução do Saldo</h3>
                    <LineChart points={balancePoints} color={conta.color} />
                </div>
            </div>
        </div>
    );
}
