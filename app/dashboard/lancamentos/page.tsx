"use client";

import { useState, useEffect } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useCollection } from "@/hooks/useFirestore";
import {
    Receipt, Plus, X, TrendingUp, TrendingDown,
    Calendar, CreditCard, Wallet, Check, Clock,
    ChevronLeft, ChevronRight, Filter, Edit3, Trash2
} from "lucide-react";
import { Header } from "@/components/Navigation";
import type { Transaction, Account, CreditCard as CardType, Category } from "@/types";

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

export default function LancamentosPage() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
    const [sourceFilter, setSourceFilter] = useState<'all' | 'account' | 'card'>('all');
    const [specificAccountId, setSpecificAccountId] = useState('');
    const [specificCardId, setSpecificCardId] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    const { transactions, loading, add, update, remove, markAsPaid, totals } = useTransactions(month, year);
    const { data: contas } = useCollection<Account>("accounts");
    const { data: cartoes } = useCollection<CardType>("credit_cards");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        description: '',
        amount: 0,
        type: 'expense' as 'expense' | 'income',
        date: new Date().toISOString().split('T')[0],
        status: 'pending' as 'paid' | 'pending',
        accountId: '',
        cardId: '',
        categoryId: 'outros',
    });

    const openModal = (transaction?: Transaction) => {
        if (transaction) {
            setEditingId(transaction.id);
            setFormData({
                description: transaction.description,
                amount: transaction.amount,
                type: transaction.type,
                date: new Date(transaction.date).toISOString().split('T')[0],
                status: transaction.status,
                accountId: transaction.accountId || '',
                cardId: transaction.cardId || '',
                categoryId: transaction.categoryId || 'outros',
            });
        } else {
            setEditingId(null);
            setFormData({
                description: '',
                amount: 0,
                type: 'expense',
                date: new Date().toISOString().split('T')[0],
                status: 'pending',
                accountId: '',
                cardId: '',
                categoryId: 'outros',
            });
        }
        setIsModalOpen(true);
    };

    const handleDelete = (t: Transaction) => {
        if (confirm(`Tem certeza que deseja excluir "${t.description}"? Esta ação não pode ser desfeita.`)) {
            remove(t.id);
        }
    };

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const formatDate = (timestamp: number) =>
        new Date(timestamp).toLocaleDateString('pt-BR');

    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const navigateMonth = (direction: 'prev' | 'next') => {
        if (direction === 'prev') {
            if (month === 1) {
                setMonth(12);
                setYear(year - 1);
            } else {
                setMonth(month - 1);
            }
        } else {
            if (month === 12) {
                setMonth(1);
                setYear(year + 1);
            } else {
                setMonth(month + 1);
            }
        }
    };

    const MAX_AMOUNT = 999999999.99;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.description || !formData.amount) return;

        if (Number(formData.amount) > MAX_AMOUNT) {
            alert('O valor máximo permitido é R$ 999.999.999,99');
            return;
        }

        if (Number(formData.amount) <= 0) {
            alert('O valor precisa ser maior que zero.');
            return;
        }

        if (editingId) {
            await update(editingId, {
                description: formData.description,
                amount: Number(formData.amount),
                type: formData.type,
                date: new Date(formData.date).getTime(),
                status: formData.status,
                accountId: formData.accountId || undefined,
                cardId: formData.cardId || undefined,
                categoryId: formData.categoryId,
            });
        } else {
            await add({
                description: formData.description,
                amount: Number(formData.amount),
                type: formData.type,
                date: new Date(formData.date).getTime(),
                status: formData.status,
                accountId: formData.accountId || undefined,
                cardId: formData.cardId || undefined,
                categoryId: formData.categoryId,
                userId: '',
                paidAt: formData.status === 'paid' ? Date.now() : undefined,
            });
        }

        setIsModalOpen(false);
        setEditingId(null);
    };

    // Filtrar transações
    const filteredTransactions = transactions.filter(t => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (sourceFilter === 'account' && !t.accountId) return false;
        if (sourceFilter === 'card' && !t.cardId) return false;
        if (specificAccountId && t.accountId !== specificAccountId) return false;
        if (specificCardId && t.cardId !== specificCardId) return false;
        if (categoryFilter && (t.categoryId || 'outros') !== categoryFilter) return false;
        return true;
    });

    const getCategory = (id?: string) => defaultCategories.find(c => c.id === id) || defaultCategories[7];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <Header title="Lançamentos" subtitle="Receitas e despesas" />
                <button
                    onClick={() => openModal()}
                    className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                    <Plus className="w-5 h-5" />
                    Novo Lançamento
                </button>
            </div>

            {/* Navegação de Mês */}
            <div className="flex items-center justify-center gap-4 mb-6">
                <button onClick={() => navigateMonth('prev')} className="p-2 hover:bg-slate-100 rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-semibold text-lg min-w-[120px] text-center">
                    {monthNames[month - 1]} {year}
                </span>
                <button onClick={() => navigateMonth('next')} className="p-2 hover:bg-slate-100 rounded-lg">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Resumo do Mês */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="card p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500">Receitas</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(totals.income)}</p>
                    </div>
                </div>
                <div className="card p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                        <TrendingDown className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500">Despesas</p>
                        <p className="text-xl font-bold text-red-600">{formatCurrency(totals.expense)}</p>
                    </div>
                </div>
                <div className="card p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500">Pendente</p>
                        <p className="text-xl font-bold text-amber-600">{formatCurrency(totals.pending)}</p>
                    </div>
                </div>
            </div>

            {/* Source Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4 max-w-md">
                {(['all', 'account', 'card'] as const).map(src => (
                    <button
                        key={src}
                        onClick={() => { setSourceFilter(src); setSpecificAccountId(''); setSpecificCardId(''); }}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${sourceFilter === src ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {src === 'all' ? '📋 Todos' : src === 'account' ? '🏦 Contas' : '💳 Cartões'}
                    </button>
                ))}
            </div>

            {/* Specific Account/Card Filter */}
            {sourceFilter === 'account' && contas.length > 0 && (
                <div className="mb-4">
                    <select
                        value={specificAccountId}
                        onChange={e => setSpecificAccountId(e.target.value)}
                        className="input max-w-xs"
                    >
                        <option value="">Todas as contas</option>
                        {contas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            )}
            {sourceFilter === 'card' && cartoes.length > 0 && (
                <div className="mb-4">
                    <select
                        value={specificCardId}
                        onChange={e => setSpecificCardId(e.target.value)}
                        className="input max-w-xs"
                    >
                        <option value="">Todos os cartões</option>
                        {cartoes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            )}

            {/* Category Chips */}
            <div className="flex flex-wrap gap-1.5 mb-4">
                <button
                    onClick={() => setCategoryFilter('')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!categoryFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                    Todas
                </button>
                {defaultCategories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setCategoryFilter(categoryFilter === cat.id ? '' : cat.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${categoryFilter === cat.id ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        style={categoryFilter === cat.id ? { backgroundColor: cat.color } : {}}
                    >
                        {cat.icon} {cat.name}
                    </button>
                ))}
            </div>

            {/* Type/Status Filters */}
            <div className="flex flex-wrap gap-2 mb-6">
                <button
                    onClick={() => setTypeFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${typeFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    Todos
                </button>
                <button
                    onClick={() => setTypeFilter('income')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${typeFilter === 'income' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                >
                    Receitas
                </button>
                <button
                    onClick={() => setTypeFilter('expense')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${typeFilter === 'expense' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                >
                    Despesas
                </button>
                <div className="w-px h-8 bg-slate-200 mx-2"></div>
                <button
                    onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'pending' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                        }`}
                >
                    Pendentes
                </button>
            </div>

            {/* Lista de Transações */}
            <div className="card overflow-hidden">
                {filteredTransactions.length === 0 ? (
                    <div className="p-12 text-center">
                        <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">Nenhum lançamento encontrado</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredTransactions.map((t) => {
                            const category = getCategory(t.categoryId);
                            const isFromPastMonth = (() => {
                                const d = new Date(t.date);
                                return d.getMonth() + 1 !== month || d.getFullYear() !== year;
                            })();
                            return (
                                <div key={t.id} className={`p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group ${isFromPastMonth ? 'bg-amber-50/50' : ''}`}>
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                                        style={{ backgroundColor: category.color + '20' }}
                                    >
                                        {category.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-900 truncate">{t.description}</p>
                                        <div className="flex items-center gap-2 text-sm text-slate-400">
                                            <span>{formatDate(t.date)}</span>
                                            {isFromPastMonth && <span className="text-amber-600 font-medium">• Mês anterior</span>}
                                            {t.cardId && <CreditCard className="w-3 h-3" />}
                                            {t.accountId && <Wallet className="w-3 h-3" />}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                            {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                                        </p>
                                        {t.status === 'pending' ? (
                                            <button
                                                onClick={() => markAsPaid(t.id)}
                                                className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 justify-end"
                                            >
                                                <Clock className="w-3 h-3" /> Pendente
                                            </button>
                                        ) : (
                                            <span className="text-xs text-green-600 flex items-center gap-1 justify-end">
                                                <Check className="w-3 h-3" /> Pago
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openModal(t)}
                                            className="p-2 text-slate-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(t)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="card p-0 w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-semibold text-slate-900">{editingId ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Tipo */}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'expense' })}
                                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${formData.type === 'expense'
                                        ? 'bg-red-600 text-white shadow-lg'
                                        : 'bg-red-50 text-red-600'
                                        }`}
                                >
                                    Despesa
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'income' })}
                                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${formData.type === 'income'
                                        ? 'bg-green-600 text-white shadow-lg'
                                        : 'bg-green-50 text-green-600'
                                        }`}
                                >
                                    Receita
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Descrição</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="input"
                                    placeholder="Ex: Supermercado, Salário..."
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Valor</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max="999999999.99"
                                        value={formData.amount || ''}
                                        onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                                        className="input"
                                        placeholder="0,00"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Data</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        className="input"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Categoria</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {defaultCategories.slice(0, 8).map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, categoryId: cat.id })}
                                            className={`p-3 rounded-xl text-center transition-all ${formData.categoryId === cat.id
                                                ? 'ring-2 ring-offset-2 ring-slate-400 scale-105'
                                                : 'hover:bg-slate-50'
                                                }`}
                                        >
                                            <span className="text-2xl">{cat.icon}</span>
                                            <p className="text-xs text-slate-500 mt-1 truncate">{cat.name}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    {formData.type === 'expense' ? 'Pagar com' : 'Receber em'}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {contas.map(conta => (
                                        <button
                                            key={conta.id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, accountId: conta.id, cardId: '' })}
                                            className={`p-3 rounded-xl text-left transition-all flex items-center gap-2 ${formData.accountId === conta.id
                                                ? 'ring-2 ring-offset-2 ring-slate-400'
                                                : 'bg-slate-50 hover:bg-slate-100'
                                                }`}
                                        >
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                                                style={{ backgroundColor: conta.color }}
                                            >
                                                {conta.name[0]}
                                            </div>
                                            <span className="text-sm truncate">{conta.name}</span>
                                        </button>
                                    ))}
                                    {formData.type === 'expense' && cartoes.map(cartao => (
                                        <button
                                            key={cartao.id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, cardId: cartao.id, accountId: '' })}
                                            className={`p-3 rounded-xl text-left transition-all flex items-center gap-2 ${formData.cardId === cartao.id
                                                ? 'ring-2 ring-offset-2 ring-slate-400'
                                                : 'bg-slate-50 hover:bg-slate-100'
                                                }`}
                                        >
                                            <CreditCard className="w-5 h-5" style={{ color: cartao.color }} />
                                            <span className="text-sm truncate">{cartao.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-3 pt-2">
                                <input
                                    type="checkbox"
                                    id="paid"
                                    checked={formData.status === 'paid'}
                                    onChange={e => setFormData({ ...formData, status: e.target.checked ? 'paid' : 'pending' })}
                                    className="w-5 h-5 rounded border-slate-300"
                                />
                                <label htmlFor="paid" className="text-sm text-slate-600">
                                    Já está pago
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary flex-1">
                                    {editingId ? 'Salvar Alterações' : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
