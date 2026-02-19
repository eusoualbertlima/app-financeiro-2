"use client";

import { useState, useEffect } from "react";
import { useRecurringBills, useBillPayments } from "@/hooks/useBills";
import { useCollection } from "@/hooks/useFirestore";
import { CurrencyInput } from "@/components/CurrencyInput";
import {
    CalendarDays, Plus, X, Check, Clock, AlertTriangle,
    ChevronLeft, ChevronRight, Edit3, Trash2, Undo2, SkipForward
} from "lucide-react";
import { Header } from "@/components/Navigation";
import type { Account, BillPayment } from "@/types";

export default function ContasFixasPage() {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());

    const { bills, loading: billsLoading, add, update, remove } = useRecurringBills();
    const { payments, loading: paymentsLoading, generatePayments, markAsPaid, markAsPending, markAsSkipped, summary } = useBillPayments(month, year);
    const { data: contas } = useCollection<Account>("accounts");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [payModalOpen, setPayModalOpen] = useState<string | null>(null);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [payAmount, setPayAmount] = useState(0);
    const [payNote, setPayNote] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        amount: 0,
        dueDay: 10,
    });

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const navigateMonth = (direction: 'prev' | 'next') => {
        if (direction === 'prev') {
            if (month === 1) { setMonth(12); setYear(year - 1); }
            else { setMonth(month - 1); }
        } else {
            if (month === 12) { setMonth(1); setYear(year + 1); }
            else { setMonth(month + 1); }
        }
    };

    // Gerar pagamentos quando mudar de mês
    useEffect(() => {
        if (!billsLoading && !paymentsLoading && bills.length > 0) {
            generatePayments();
        }
    }, [bills, month, year, billsLoading, paymentsLoading, generatePayments]);

    const openModal = (bill?: any) => {
        if (bill) {
            setEditingId(bill.id);
            setFormData({ name: bill.name, amount: bill.amount, dueDay: bill.dueDay });
        } else {
            setEditingId(null);
            setFormData({ name: '', amount: 0, dueDay: 10 });
        }
        setIsModalOpen(true);
    };

    const MAX_AMOUNT = 999999999.99;

    const handleDelete = (bill: any) => {
        if (confirm(`Tem certeza que deseja excluir a conta fixa "${bill.name}"? Esta ação não pode ser desfeita.`)) {
            remove(bill.id);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.amount) return;

        if (Number(formData.amount) > MAX_AMOUNT) {
            alert('O valor máximo permitido é R$ 999.999.999,99');
            return;
        }

        if (Number(formData.amount) <= 0) {
            alert('O valor precisa ser maior que zero.');
            return;
        }

        if (editingId) {
            await update(editingId, formData);
        } else {
            await add(formData);
        }

        setIsModalOpen(false);
        setEditingId(null);
    };

    const handlePay = async (paymentId: string) => {
        if (Number(payAmount) > MAX_AMOUNT) {
            alert('O valor máximo permitido é R$ 999.999.999,99');
            return;
        }

        if (Number(payAmount) <= 0) {
            alert('O valor precisa ser maior que zero.');
            return;
        }

        await markAsPaid(paymentId, Number(payAmount), selectedAccount || undefined, payNote.trim() || undefined);
        setPayModalOpen(null);
        setSelectedAccount('');
        setPayAmount(0);
        setPayNote('');
    };

    const handleSkip = async (paymentId: string, billName: string) => {
        const shouldSkip = confirm(`Pular "${billName}" apenas em ${monthNames[month - 1]} ${year}?`);
        if (!shouldSkip) return;
        await markAsSkipped(paymentId);
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'paid':
                return { icon: Check, color: 'text-green-600', bg: 'bg-green-100', label: 'Pago' };
            case 'overdue':
                return { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', label: 'Atrasado' };
            case 'skipped':
                return { icon: SkipForward, color: 'text-slate-600', bg: 'bg-slate-100', label: 'Pulada' };
            default:
                return { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Pendente' };
        }
    };

    const loading = billsLoading || paymentsLoading;
    const sortedPayments = [...payments].sort((a, b) => a.dueDay - b.dueDay);
    const selectedPayment = payModalOpen
        ? sortedPayments.find((payment: BillPayment) => payment.id === payModalOpen) || null
        : null;

    if (loading && payments.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <Header title="Contas Fixas" subtitle="Despesas recorrentes" />
                <button
                    onClick={() => openModal()}
                    className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                    <Plus className="w-5 h-5" />
                    Nova Conta Fixa
                </button>
            </div>

            {/* Navegação de Mês */}
            <div className="flex items-center justify-center gap-4 mb-6">
                <button onClick={() => navigateMonth('prev')} className="p-2 hover:bg-slate-100 rounded-lg">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-semibold text-lg min-w-[160px] text-center">
                    {monthNames[month - 1]} {year}
                </span>
                <button onClick={() => navigateMonth('next')} className="p-2 hover:bg-slate-100 rounded-lg">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                <div className="card p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900">{summary.total}</p>
                    <p className="text-sm text-slate-500">Total</p>
                </div>
                <div className="card p-4 text-center border-l-4 border-green-500">
                    <p className="text-2xl font-bold text-green-600">{summary.paid}</p>
                    <p className="text-sm text-slate-500">Pagas</p>
                </div>
                <div className="card p-4 text-center border-l-4 border-amber-500">
                    <p className="text-2xl font-bold text-amber-600">{summary.pending}</p>
                    <p className="text-sm text-slate-500">Pendentes</p>
                </div>
                <div className="card p-4 text-center border-l-4 border-red-500">
                    <p className="text-2xl font-bold text-red-600">{summary.overdue}</p>
                    <p className="text-sm text-slate-500">Atrasadas</p>
                </div>
                <div className="card p-4 text-center border-l-4 border-slate-400">
                    <p className="text-2xl font-bold text-slate-600">{summary.skipped}</p>
                    <p className="text-sm text-slate-500">Puladas</p>
                </div>
            </div>

            {/* Lista de Pagamentos do Mês */}
            {payments.length === 0 && bills.length === 0 ? (
                <div className="card p-12 text-center">
                    <CalendarDays className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Nenhuma conta fixa cadastrada</h3>
                    <p className="text-slate-500 mb-6">Cadastre suas despesas recorrentes como aluguel, internet, luz...</p>
                    <button onClick={() => openModal()} className="btn-primary">
                        <Plus className="w-5 h-5 mr-2 inline" />
                        Cadastrar Primeira Conta
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedPayments.map((payment) => {
                        const status = getStatusInfo(payment.status);
                        const StatusIcon = status.icon;
                        return (
                            <div key={payment.id} className="card p-4 flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl ${status.bg} flex items-center justify-center`}>
                                    <StatusIcon className={`w-6 h-6 ${status.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900">{payment.billName}</p>
                                    <p className="text-sm text-slate-400">Vence dia {payment.dueDay}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-slate-900">{formatCurrency(payment.amount)}</p>
                                    <p className={`text-xs font-medium ${status.color}`}>{status.label}</p>
                                </div>
                                <div className="flex gap-1">
                                    {(payment.status === 'pending' || payment.status === 'overdue') ? (
                                        <>
                                            <button
                                                onClick={() => handleSkip(payment.id, payment.billName)}
                                                className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                                                title="Pular apenas este mês"
                                            >
                                                <SkipForward className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setPayModalOpen(payment.id);
                                                    setSelectedAccount('');
                                                    setPayAmount(payment.amount);
                                                    setPayNote('');
                                                }}
                                                className="p-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg transition-colors"
                                                title="Marcar como pago"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => markAsPending(payment.id)}
                                            className="p-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
                                            title={payment.status === 'paid' ? "Desfazer pagamento" : "Reativar cobrança"}
                                        >
                                            <Undo2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Gerenciamento de Contas Fixas (lista compacta) */}
            {bills.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                        Gerenciar Contas Fixas
                    </h3>
                    <div className="card overflow-hidden">
                        <div className="divide-y divide-slate-100">
                            {bills.map(bill => (
                                <div key={bill.id} className="p-4 flex items-center gap-4 hover:bg-slate-50">
                                    <div className="flex-1">
                                        <p className="font-medium text-slate-900">{bill.name}</p>
                                        <p className="text-sm text-slate-400">
                                            {formatCurrency(bill.amount)} • Dia {bill.dueDay}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => openModal(bill)}
                                        className="p-2 text-slate-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(bill)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Novo/Editar Conta Fixa */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="card p-0 w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editingId ? 'Editar Conta Fixa' : 'Nova Conta Fixa'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Nome da Conta</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="input"
                                    placeholder="Ex: Aluguel, Internet, Luz..."
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Valor</label>
                                    <CurrencyInput
                                        value={formData.amount}
                                        onChange={v => setFormData({ ...formData, amount: v })}
                                        className="input"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Dia Vencimento</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={formData.dueDay}
                                        onChange={e => setFormData({ ...formData, dueDay: Number(e.target.value) })}
                                        className="input"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary flex-1">
                                    {editingId ? 'Salvar Alterações' : 'Criar Conta Fixa'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Pagamento */}
            {payModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="card p-6 w-full max-w-sm">
                        <h3 className="text-lg font-semibold mb-4">Confirmar Pagamento</h3>

                        <p className="text-sm text-slate-500 mb-4">
                            Confirme o valor pago e a conta de saída.
                        </p>

                        <div className="mb-4 p-3 rounded-lg bg-slate-50">
                            <p className="text-xs text-slate-500">Conta fixa</p>
                            <p className="font-medium text-slate-900">{selectedPayment?.billName || 'Conta Fixa'}</p>
                            {selectedPayment && (
                                <p className="text-xs text-slate-500 mt-1">
                                    Valor previsto: {formatCurrency(selectedPayment.amount)}
                                </p>
                            )}
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Valor pago</label>
                            <CurrencyInput
                                value={payAmount}
                                onChange={setPayAmount}
                                className="input"
                            />
                        </div>

                        <div className="space-y-2 mb-6">
                            {contas.map(conta => (
                                <button
                                    key={conta.id}
                                    onClick={() => setSelectedAccount(conta.id)}
                                    className={`w-full p-3 rounded-xl text-left flex items-center gap-3 transition-all ${selectedAccount === conta.id
                                        ? 'ring-2 ring-primary-500 bg-primary-50'
                                        : 'bg-slate-50 hover:bg-slate-100'
                                        }`}
                                >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                                        style={{ backgroundColor: conta.color }}
                                    >
                                        {conta.name[0]}
                                    </div>
                                    <span>{conta.name}</span>
                                </button>
                            ))}
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Observação (opcional)</label>
                            <textarea
                                value={payNote}
                                onChange={(e) => setPayNote(e.target.value)}
                                className="input min-h-[88px] resize-y"
                                placeholder="Ex: valor com desconto, ajuste pontual, taxa extra..."
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setPayModalOpen(null)} className="btn-secondary flex-1">
                                Cancelar
                            </button>
                            <button onClick={() => handlePay(payModalOpen)} className="btn-primary flex-1">
                                <Check className="w-4 h-4 mr-2 inline" />
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
