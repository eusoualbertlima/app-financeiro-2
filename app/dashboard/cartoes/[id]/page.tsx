"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCollection } from "@/hooks/useFirestore";
import { useCardTransactions } from "@/hooks/useTransactions";
import { useCardStatements } from "@/hooks/useCardStatements";
import { useCardsLimitSummary } from "@/hooks/useCardLimits";
import { CurrencyInput } from "@/components/CurrencyInput";
import { DonutChart } from "@/components/Charts";
import {
    CreditCard, ChevronLeft, ChevronRight, ArrowLeft,
    Check, Clock, Edit3, TrendingDown, AlertCircle
} from "lucide-react";
import type { CreditCard as CardType, Account, CardStatementAdjustment } from "@/types";

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

export default function CartaoDetalhePage() {
    const params = useParams();
    const router = useRouter();
    const cardId = params.id as string;

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [showPayModal, setShowPayModal] = useState(false);
    const [showEditAmountModal, setShowEditAmountModal] = useState(false);
    const [editAmount, setEditAmount] = useState(0);
    const [payAccountId, setPayAccountId] = useState("");

    const { data: cartoes } = useCollection<CardType>("credit_cards");
    const { data: contas } = useCollection<Account>("accounts");
    const cartao = cartoes.find(c => c.id === cardId);
    const { summaryByCard } = useCardsLimitSummary(
        cartao ? [cartao] : [],
        { month, year }
    );
    const {
        statement, loading: stmtLoading,
        generateStatement, updateAmount, payStatement, reopenStatement
    } = useCardStatements(cardId, month, year);
    const { transactions, loading: transLoading, total } = useCardTransactions(
        cardId,
        month,
        year,
        cartao?.closingDay,
        statement?.id
    );
    const generateStatementRef = useRef(generateStatement);
    const updateAmountRef = useRef(updateAmount);

    useEffect(() => {
        generateStatementRef.current = generateStatement;
    }, [generateStatement]);

    useEffect(() => {
        updateAmountRef.current = updateAmount;
    }, [updateAmount]);

    // Auto-generate statement when we have data
    useEffect(() => {
        if (cartao && !stmtLoading && !statement && total > 0) {
            generateStatementRef.current(cartao.name, cartao.closingDay, cartao.dueDay, total);
        }
    }, [cartao, stmtLoading, statement, total]);

    // Update statement total when transactions change
    useEffect(() => {
        const manualDelta = Number(statement?.manualDelta || 0);
        const expectedTotal = Math.max(0, total + manualDelta);
        if (
            statement
            && !transLoading
            && statement.status === 'open'
            && Math.abs(expectedTotal - statement.totalAmount) > 0.009
        ) {
            updateAmountRef.current(total, { source: 'auto' });
        }
    }, [total, statement, transLoading]);

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

    const getCategory = (id?: string) =>
        defaultCategories.find(c => c.id === id) || defaultCategories[defaultCategories.length - 1];

    // Category breakdown for donut
    const categoryBreakdown = defaultCategories.map(cat => ({
        label: cat.name,
        icon: cat.icon,
        value: transactions.filter(t => (t.categoryId || 'outros') === cat.id).reduce((s, t) => s + t.amount, 0),
        color: cat.color,
    })).filter(c => c.value > 0);

    if (!cartao) {
        return (
            <div className="p-6 lg:p-8">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4">
                    <ArrowLeft className="w-5 h-5" /> Voltar
                </button>
                <p className="text-slate-400">Cartão não encontrado</p>
            </div>
        );
    }

    const effectiveInvoiceTotal = statement?.totalAmount ?? total;
    const selectedMonthOutstanding = summaryByCard[cartao.id]?.selectedMonthOutstanding;
    const totalOutstanding = summaryByCard[cartao.id]?.outstanding ?? effectiveInvoiceTotal;
    const faturaStatus = statement?.status || 'open';
    const selectedInvoiceOutstanding = faturaStatus === 'paid'
        ? 0
        : (selectedMonthOutstanding ?? effectiveInvoiceTotal);
    const available = cartao.limit - totalOutstanding;
    const usedPct = cartao.limit > 0 ? Math.min((Math.max(totalOutstanding, 0) / cartao.limit) * 100, 100) : 0;
    const statementAdjustments = Array.isArray(statement?.adjustments)
        ? ([...statement.adjustments] as CardStatementAdjustment[]).sort((a, b) => (b?.at || 0) - (a?.at || 0))
        : [];

    const handlePayFatura = async () => {
        if (!payAccountId) return;
        await payStatement(payAccountId);
        setShowPayModal(false);
        setPayAccountId("");
    };

    const handleEditAmount = async () => {
        await updateAmount(editAmount, {
            source: 'manual',
            baseAutoTotal: total,
            note: 'Ajuste manual da fatura',
            createIfMissing: {
                cardName: cartao.name,
                closingDay: cartao.closingDay,
                dueDay: cartao.dueDay,
            },
        });
        setShowEditAmountModal(false);
    };

    return (
        <div className="p-6 lg:p-8 max-w-4xl mx-auto">
            {/* Back Button */}
            <button onClick={() => router.push('/dashboard/cartoes')} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors">
                <ArrowLeft className="w-5 h-5" /> Voltar para Cartões
            </button>

            {/* Card Header */}
            <div
                className="rounded-2xl p-6 text-white mb-6 shadow-lg"
                style={{ background: `linear-gradient(135deg, ${cartao.color}, ${cartao.color}cc)` }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold">{cartao.name}</h1>
                        <p className="text-white/70 capitalize">{cartao.brand}</p>
                    </div>
                    <CreditCard className="w-10 h-10 text-white/50" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <p className="text-xs text-white/60 uppercase mb-1">Limite</p>
                        <p className="text-lg font-bold">{formatCurrency(cartao.limit)}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-white/60 uppercase mb-1">Em aberto</p>
                        <p className="text-lg font-bold">{formatCurrency(selectedInvoiceOutstanding)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-white/60 uppercase mb-1">Disponível</p>
                        <p className="text-lg font-bold">{formatCurrency(available)}</p>
                    </div>
                </div>
                <div className="mt-4">
                    <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${usedPct > 80 ? 'bg-red-400' : usedPct > 50 ? 'bg-amber-400' : 'bg-green-400'}`}
                            style={{ width: `${usedPct}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-white/50 mt-1">
                        <span>Fecha dia {cartao.closingDay}</span>
                        <span>Vence dia {cartao.dueDay}</span>
                    </div>
                </div>
            </div>

            {/* Month Navigation */}
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

            {/* Fatura Card */}
            <div className="card p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${faturaStatus === 'paid' ? 'bg-green-100' : faturaStatus === 'closed' ? 'bg-amber-100' : 'bg-blue-100'
                            }`}>
                            {faturaStatus === 'paid'
                                ? <Check className="w-5 h-5 text-green-600" />
                                : faturaStatus === 'closed'
                                    ? <AlertCircle className="w-5 h-5 text-amber-600" />
                                    : <Clock className="w-5 h-5 text-blue-600" />
                            }
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900">Fatura de {monthNames[month - 1]}</h3>
                            <p className="text-sm text-slate-400">
                                {faturaStatus === 'paid' ? 'Paga' : faturaStatus === 'closed' ? 'Fechada' : 'Aberta'}
                                {statement?.paidAt && ` em ${formatDate(statement.paidAt)}`}
                            </p>
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(effectiveInvoiceTotal)}
                    </p>
                </div>

                <div className="flex gap-2">
                    {faturaStatus !== 'paid' && statement && (
                        <button
                            onClick={() => setShowPayModal(true)}
                            className="btn-primary flex items-center gap-2 flex-1"
                        >
                            <Check className="w-4 h-4" /> Pagar Fatura
                        </button>
                    )}
                    {faturaStatus !== 'paid' && (
                        <button
                            onClick={() => {
                                setEditAmount(statement?.totalAmount ?? selectedInvoiceOutstanding ?? 0);
                                setShowEditAmountModal(true);
                            }}
                            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 flex items-center gap-2"
                        >
                            <Edit3 className="w-4 h-4" /> Ajustar
                        </button>
                    )}
                    {faturaStatus === 'paid' && (
                        <button
                            onClick={() => {
                                if (confirm('Tem certeza que deseja reabrir esta fatura? O saldo da conta será revertido.')) {
                                    reopenStatement();
                                }
                            }}
                            className="px-4 py-2 border border-amber-200 text-amber-600 rounded-xl hover:bg-amber-50 flex items-center gap-2"
                        >
                            <Clock className="w-4 h-4" /> Reabrir
                        </button>
                    )}
                </div>
            </div>

            {statementAdjustments.length > 0 && (
                <div className="card p-5 mb-6">
                    <h3 className="font-semibold text-slate-900 mb-3">Histórico de Ajustes</h3>
                    <div className="space-y-2">
                        {statementAdjustments.slice(0, 6).map((entry, idx) => (
                            <div key={`${entry.at || 0}-${idx}`} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-slate-700">
                                        {entry?.source === 'manual' ? 'Ajuste manual' : 'Sincronização automática'}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {entry?.at ? formatDate(entry.at) : '-'}
                                    </p>
                                </div>
                                <p className="text-sm text-slate-600 mt-1">
                                    {formatCurrency(Number(entry?.previousAmount || 0))}
                                    {' -> '}
                                    <span className="font-semibold text-slate-900">{formatCurrency(Number(entry?.newAmount || 0))}</span>
                                </p>
                                {Number.isFinite(Number(entry?.delta)) && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        Delta manual: {formatCurrency(Number(entry?.delta || 0))}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Transactions List */}
                <div className="card overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                        <h3 className="font-semibold text-slate-900">Transações ({transactions.length})</h3>
                    </div>
                    {transLoading ? (
                        <div className="p-8 text-center text-slate-400">Carregando...</div>
                    ) : transactions.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>Nenhuma transação neste mês</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                            {transactions.map(t => {
                                const cat = getCategory(t.categoryId);
                                return (
                                    <div key={t.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50">
                                        <span className="text-lg">{cat.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">{t.description}</p>
                                            <p className="text-xs text-slate-400">{formatDate(t.date)}</p>
                                        </div>
                                        <p className="text-sm font-bold text-red-600">- {formatCurrency(t.amount)}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Category Breakdown */}
                <div className="card p-5">
                    <h3 className="font-semibold text-slate-900 mb-4">Gastos por Categoria</h3>
                    <DonutChart segments={categoryBreakdown} size={180} />
                </div>
            </div>

            {/* Pay Modal */}
            {showPayModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="card p-6 w-full max-w-sm">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Pagar Fatura</h3>
                        <p className="text-2xl font-bold text-slate-900 mb-4">
                            {formatCurrency(effectiveInvoiceTotal)}
                        </p>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Pagar com qual conta?</label>
                        <select
                            value={payAccountId}
                            onChange={e => setPayAccountId(e.target.value)}
                            className="input mb-4"
                            required
                        >
                            <option value="">Selecione...</option>
                            {contas.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({formatCurrency(c.balance)})</option>
                            ))}
                        </select>
                        <div className="flex gap-2">
                            <button onClick={() => setShowPayModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-xl">
                                Cancelar
                            </button>
                            <button onClick={handlePayFatura} className="btn-primary flex-1" disabled={!payAccountId}>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Amount Modal */}
            {showEditAmountModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="card p-6 w-full max-w-sm">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Ajustar Valor da Fatura</h3>
                        <CurrencyInput
                            value={editAmount}
                            onChange={setEditAmount}
                            className="input mb-4"
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setShowEditAmountModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-xl">
                                Cancelar
                            </button>
                            <button onClick={handleEditAmount} className="btn-primary flex-1">
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
