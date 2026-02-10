"use client";

import { useState } from "react";
import { useCollection } from "@/hooks/useFirestore";
import { Wallet, Plus, Trash2, X, Edit3 } from "lucide-react";
import type { Account } from "@/types";
import { Header } from "@/components/Navigation";

export default function ContasPage() {
    const { data: contas, loading, add, remove, update } = useCollection<Account>("accounts");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Account>>({
        name: "",
        balance: 0,
        type: "checking",
        color: "#0ea5e9"
    });

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

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
                <button
                    onClick={() => openModal()}
                    className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                    <Plus className="w-5 h-5" />
                    Nova Conta
                </button>
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
                                    <h3 className="font-semibold text-lg text-slate-900 truncate">{conta.name}</h3>
                                    <p className="text-sm text-slate-500 capitalize">
                                        {conta.type === 'checking' ? 'Conta Corrente' : conta.type === 'investment' ? 'Investimento' : 'Dinheiro'}
                                    </p>
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
                                <input
                                    type="number"
                                    step="0.01"
                                    max="999999999.99"
                                    value={formData.balance}
                                    onChange={e => setFormData({ ...formData, balance: Number(e.target.value) })}
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
        </div>
    );
}
