"use client";

import { useState } from "react";
import { useCollection } from "@/hooks/useFirestore";
import { useTransactions } from "@/hooks/useTransactions";
import { Wallet, Plus, Trash2, X, Edit3, Eye, ArrowRightLeft, Download } from "lucide-react";
import type { Account } from "@/types";
import Link from "next/link";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Header } from "@/components/Navigation";
import { downloadCsv } from "@/lib/csv";
import { nowDateInputValue, parseDateInputToTimestamp } from "@/lib/dateInput";

export default function ContasPage() {
    const { data: contas, loading, add, remove, update } = useCollection<Account>("accounts");
    const { transfer } = useTransactions();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Account>>({
        name: "",
        balance: 0,
        type: "checking",
        color: "#0ea5e9"
    });
    const [transferData, setTransferData] = useState({
        fromAccountId: "",
        toAccountId: "",
        amount: 0,
        date: nowDateInputValue(),
        description: "",
    });

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const handleExportCsv = () => {
        if (!contas.length) return;

        const rows = contas.map((conta) => ({
            nome: conta.name,
            tipo: conta.type === 'checking' ? 'Conta Corrente' : conta.type === 'investment' ? 'Investimento' : 'Dinheiro',
            saldo_atual: conta.balance,
            saldo_inicial: conta.startingBalance ?? conta.balance,
            ultima_reconciliacao: conta.lastReconciledAt ? new Date(conta.lastReconciledAt).toISOString() : '',
            cor: conta.color,
        }));

        downloadCsv({
            filename: `contas-${nowDateInputValue()}.csv`,
            rows,
            columns: [
                { header: 'Nome', key: 'nome' },
                { header: 'Tipo', key: 'tipo' },
                { header: 'Saldo Atual', key: 'saldo_atual' },
                { header: 'Saldo Inicial', key: 'saldo_inicial' },
                { header: 'Última Reconciliacao', key: 'ultima_reconciliacao' },
                { header: 'Cor', key: 'cor' },
            ],
        });
    };

    const openModal = (conta?: Account) => {
        if (conta) {
            setEditingId(conta.id);
            setFormData({ name: conta.name, balance: conta.balance, type: conta.type, color: conta.color });
        } else {
            setEditingId(null);
            setFormData({ name: "", balance: 0, type: "checking", color: "#0ea5e9" });
        }
        setIsModalOpen(true);
    };

    const openTransferModal = () => {
        const fromDefault = contas[0]?.id || "";
        const toDefault = contas.find(c => c.id !== fromDefault)?.id || "";

        setTransferData({
            fromAccountId: fromDefault,
            toAccountId: toDefault,
            amount: 0,
            date: nowDateInputValue(),
            description: "",
        });
        setIsTransferModalOpen(true);
    };

    const MAX_BALANCE = 999999999.99;

    const handleDelete = (conta: Account) => {
        if (confirm(`Tem certeza que deseja excluir a conta "${conta.name}"? Esta ação não pode ser desfeita.`)) {
            remove(conta.id);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        if (Math.abs(Number(formData.balance)) > MAX_BALANCE) {
            alert('O valor máximo permitido é R$ 999.999.999,99');
            return;
        }

        const data = {
            name: formData.name,
            balance: Number(formData.balance),
            type: formData.type as any,
            color: formData.color || "#0ea5e9"
        };

        if (editingId) {
            await update(editingId, data);
        } else {
            await add(data as Account);
        }

        setIsModalOpen(false);
        setEditingId(null);
    };

    const handleTransferSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!transferData.fromAccountId || !transferData.toAccountId) {
            alert('Selecione conta de origem e destino.');
            return;
        }

        if (transferData.fromAccountId === transferData.toAccountId) {
            alert('A conta de origem e destino precisam ser diferentes.');
            return;
        }

        if (Number(transferData.amount) <= 0) {
            alert('O valor da transferência precisa ser maior que zero.');
            return;
        }

        if (Math.abs(Number(transferData.amount)) > MAX_BALANCE) {
            alert('O valor máximo permitido é R$ 999.999.999,99');
            return;
        }

        const fromAccount = contas.find(c => c.id === transferData.fromAccountId);
        const toAccount = contas.find(c => c.id === transferData.toAccountId);
        const defaultDescription = `Transferência: ${fromAccount?.name || 'Conta'} → ${toAccount?.name || 'Conta'}`;
        const parsedDate = parseDateInputToTimestamp(transferData.date);

        if (Number.isNaN(parsedDate)) {
            alert('Data inválida para a transferência.');
            return;
        }

        await transfer({
            fromAccountId: transferData.fromAccountId,
            toAccountId: transferData.toAccountId,
            amount: Number(transferData.amount),
            date: parsedDate,
            description: transferData.description.trim() || defaultDescription,
        });

        setIsTransferModalOpen(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <Header title="Contas Bancárias" subtitle="Gerencie suas contas e carteiras" />
                <div className="flex flex-col sm:flex-row gap-2">
                    <button
                        onClick={handleExportCsv}
                        disabled={contas.length === 0}
                        className="btn-secondary flex items-center gap-2 w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="w-5 h-5" />
                        Exportar CSV
                    </button>
                    <button
                        onClick={openTransferModal}
                        disabled={contas.length < 2}
                        className="btn-secondary flex items-center gap-2 w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        title={contas.length < 2 ? "Cadastre ao menos 2 contas para transferir" : "Transferir entre contas"}
                    >
                        <ArrowRightLeft className="w-5 h-5" />
                        Transferir
                    </button>
                    <button
                        onClick={() => openModal()}
                        className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
                    >
                        <Plus className="w-5 h-5" />
                        Nova Conta
                    </button>
                </div>
            </div>

            {contas.length === 0 ? (
                <div className="card p-12 text-center">
                    <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
                        <Wallet className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Nenhuma conta cadastrada</h3>
                    <p className="text-slate-500 mb-6">Adicione suas contas bancárias para começar a organizar suas finanças.</p>
                    <button onClick={() => openModal()} className="btn-primary">
                        <Plus className="w-5 h-5 mr-2 inline" />
                        Adicionar Primeira Conta
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contas.map((conta) => (
                        <div key={conta.id} className="card p-6 group hover:shadow-lg transition-all duration-300">
                            <div className="flex items-start gap-4">
                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg"
                                    style={{ backgroundColor: conta.color }}
                                >
                                    {conta.name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <Link href={`/dashboard/contas/${conta.id}`} className="hover:text-primary-600 transition-colors">
                                        <h3 className="font-semibold text-lg text-slate-900 truncate">{conta.name}</h3>
                                    </Link>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-slate-500 capitalize">
                                            {conta.type === 'checking' ? 'Conta Corrente' : conta.type === 'investment' ? 'Investimento' : 'Dinheiro'}
                                        </p>
                                        <Link href={`/dashboard/contas/${conta.id}`} className="text-xs text-slate-400 hover:text-primary-500 flex items-center gap-1">
                                            <Eye className="w-3 h-3" /> Detalhes
                                        </Link>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openModal(conta)}
                                        className="p-2 text-slate-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(conta)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-100">
                                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Saldo Atual</p>
                                <p className={`text-3xl font-bold ${conta.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(conta.balance)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="card p-0 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editingId ? 'Editar Conta' : 'Nova Conta'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
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
                                    placeholder="Ex: Nubank, Bradesco"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Conta</label>
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                    className="input"
                                >
                                    <option value="checking">💳 Conta Corrente / Pagamentos</option>
                                    <option value="investment">📈 Investimento / Poupança</option>
                                    <option value="cash">💵 Dinheiro em Espécie</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Saldo Inicial</label>
                                <CurrencyInput
                                    value={formData.balance ?? 0}
                                    onChange={v => setFormData({ ...formData, balance: v })}
                                    className="input"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Cor</label>
                                <div className="flex gap-2">
                                    {['#0ea5e9', '#a855f7', '#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6'].map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color })}
                                            className={`w-10 h-10 rounded-xl transition-all ${formData.color === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'
                                                }`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary flex-1">
                                    {editingId ? 'Salvar Alterações' : 'Criar Conta'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Transferência */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="card p-0 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-semibold text-slate-900">Transferir entre Contas</h2>
                            <button onClick={() => setIsTransferModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleTransferSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Conta de Origem</label>
                                <select
                                    value={transferData.fromAccountId}
                                    onChange={e => setTransferData({ ...transferData, fromAccountId: e.target.value })}
                                    className="input"
                                    required
                                >
                                    <option value="">Selecione a origem</option>
                                    {contas.map(conta => (
                                        <option key={conta.id} value={conta.id}>{conta.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Conta de Destino</label>
                                <select
                                    value={transferData.toAccountId}
                                    onChange={e => setTransferData({ ...transferData, toAccountId: e.target.value })}
                                    className="input"
                                    required
                                >
                                    <option value="">Selecione o destino</option>
                                    {contas.map(conta => (
                                        <option key={conta.id} value={conta.id}>{conta.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Valor</label>
                                    <CurrencyInput
                                        value={transferData.amount}
                                        onChange={v => setTransferData({ ...transferData, amount: v })}
                                        className="input"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Data</label>
                                    <input
                                        type="date"
                                        value={transferData.date}
                                        onChange={e => setTransferData({ ...transferData, date: e.target.value })}
                                        className="input"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Descrição (opcional)</label>
                                <input
                                    type="text"
                                    value={transferData.description}
                                    onChange={e => setTransferData({ ...transferData, description: e.target.value })}
                                    className="input"
                                    placeholder="Ex: Reserva de emergência"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsTransferModalOpen(false)} className="btn-secondary flex-1">
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary flex-1"
                                    disabled={!transferData.fromAccountId || !transferData.toAccountId || transferData.fromAccountId === transferData.toAccountId || Number(transferData.amount) <= 0}
                                >
                                    Confirmar Transferência
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
