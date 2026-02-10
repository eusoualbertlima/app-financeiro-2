"use client";

import { useState } from "react";
import { useCollection } from "@/hooks/useFirestore";
import { useCardTransactions } from "@/hooks/useTransactions";
import { CreditCard as CardIcon, Plus, Trash2, X, Edit3, Eye } from "lucide-react";
import type { CreditCard } from "@/types";
import { Header } from "@/components/Navigation";
import Link from "next/link";

// Componente para mostrar gastos de cada cartão
function CardSpent({ cardId, limit }: { cardId: string; limit: number }) {
    const now = new Date();
    const { total, loading } = useCardTransactions(cardId, now.getMonth() + 1, now.getFullYear());
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const available = limit - total;
    const usedPercent = limit > 0 ? Math.min((total / limit) * 100, 100) : 0;

    if (loading) return null;

    return (
        <div className="mt-4 pt-3 border-t border-white/20">
            <div className="flex justify-between text-xs text-white/70 mb-2">
                <span>Gasto: {formatCurrency(total)}</span>
                <span>Disponível: {formatCurrency(available)}</span>
            </div>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${usedPercent > 80 ? 'bg-red-400' : usedPercent > 50 ? 'bg-amber-400' : 'bg-green-400'}`}
                    style={{ width: `${usedPercent}%` }}
                />
            </div>
        </div>
    );
}

const brandLogos: Record<string, string> = {
    mastercard: '🔴🟡',
    visa: '🔵',
    amex: '🟢',
    elo: '🟠',
    other: '💳'
};

export default function CartoesPage() {
    const { data: cartoes, loading, add, remove, update } = useCollection<CreditCard>("credit_cards");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<CreditCard>>({
        name: "",
        limit: 0,
        closingDay: 1,
        dueDay: 10,
        brand: "mastercard",
        color: "#1a1a2e"
    });

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const openModal = (cartao?: CreditCard) => {
        if (cartao) {
            setEditingId(cartao.id);
            setFormData({
                name: cartao.name,
                limit: cartao.limit,
                closingDay: cartao.closingDay,
                dueDay: cartao.dueDay,
                brand: cartao.brand,
                color: cartao.color
            });
        } else {
            setEditingId(null);
            setFormData({ name: "", limit: 0, closingDay: 1, dueDay: 10, brand: "mastercard", color: "#1a1a2e" });
        }
        setIsModalOpen(true);
    };

    const MAX_LIMIT = 999999999.99;

    const handleDelete = (cartao: CreditCard) => {
        if (confirm(`Tem certeza que deseja excluir o cartão "${cartao.name}"? Esta ação não pode ser desfeita.`)) {
            remove(cartao.id);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        if (Number(formData.limit) > MAX_LIMIT) {
            alert('O limite máximo permitido é R$ 999.999.999,99');
            return;
        }

        if (Number(formData.limit) <= 0) {
            alert('O limite precisa ser maior que zero.');
            return;
        }

        const data = {
            name: formData.name,
            limit: Number(formData.limit),
            closingDay: Number(formData.closingDay),
            dueDay: Number(formData.dueDay),
            brand: formData.brand as any,
            color: formData.color || "#1a1a2e"
        };

        if (editingId) {
            await update(editingId, data);
        } else {
            await add(data as CreditCard);
        }

        setIsModalOpen(false);
        setEditingId(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-accent-200 border-t-accent-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <Header title="Cartões de Crédito" subtitle="Gerencie seus cartões e limites" />
                <button
                    onClick={() => openModal()}
                    className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center !bg-gradient-to-r !from-accent-500 !to-accent-600 !shadow-accent-500/30"
                >
                    <Plus className="w-5 h-5" />
                    Novo Cartão
                </button>
            </div>

            {cartoes.length === 0 ? (
                <div className="card p-12 text-center">
                    <div className="w-20 h-20 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-6">
                        <CardIcon className="w-10 h-10 text-accent-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Nenhum cartão cadastrado</h3>
                    <p className="text-slate-500 mb-6">Adicione seus cartões de crédito para controlar suas faturas.</p>
                    <button onClick={() => openModal()} className="btn-primary !bg-gradient-to-r !from-accent-500 !to-accent-600">
                        <Plus className="w-5 h-5 mr-2 inline" />
                        Adicionar Primeiro Cartão
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {cartoes.map((cartao) => (
                        <div
                            key={cartao.id}
                            className="relative rounded-2xl p-6 text-white overflow-hidden group shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                            style={{
                                background: `linear-gradient(135deg, ${cartao.color}, ${cartao.color}aa)`
                            }}
                        >
                            {/* Padrão decorativo */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6"></div>

                            {/* Ações */}
                            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => openModal(cartao)}
                                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                                >
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(cartao)}
                                    className="p-2 bg-white/20 hover:bg-red-500/50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Conteúdo */}
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="text-2xl">{brandLogos[cartao.brand] || brandLogos.other}</div>
                                    <CardIcon className="w-8 h-8 opacity-50" />
                                </div>

                                <Link href={`/dashboard/cartoes/${cartao.id}`} className="hover:underline">
                                    <h3 className="text-xl font-bold mb-1">{cartao.name}</h3>
                                </Link>
                                <div className="flex items-center gap-2">
                                    <p className="text-white/70 text-sm capitalize">{cartao.brand}</p>
                                    <Link href={`/dashboard/cartoes/${cartao.id}`} className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1 transition-colors">
                                        <Eye className="w-3 h-3" /> Ver fatura
                                    </Link>
                                </div>

                                <div className="mt-6 pt-4 border-t border-white/20 grid grid-cols-3 gap-3">
                                    <div>
                                        <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Limite</p>
                                        <p className="text-lg font-bold">{formatCurrency(cartao.limit)}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Fechamento</p>
                                        <p className="text-lg font-bold">Dia {cartao.closingDay}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Vencimento</p>
                                        <p className="text-lg font-bold">Dia {cartao.dueDay}</p>
                                    </div>
                                </div>
                                <CardSpent cardId={cartao.id} limit={cartao.limit} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="card p-0 w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-semibold text-slate-900">
                                {editingId ? 'Editar Cartão' : 'Novo Cartão'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Nome do Cartão</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="input"
                                    placeholder="Ex: Nubank, Inter, XP"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Limite</label>
                                    <input
                                        type="number"
                                        min="0.01"
                                        max="999999999.99"
                                        step="0.01"
                                        value={formData.limit}
                                        onChange={e => setFormData({ ...formData, limit: Number(e.target.value) })}
                                        className="input"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Bandeira</label>
                                    <select
                                        value={formData.brand}
                                        onChange={e => setFormData({ ...formData, brand: e.target.value as any })}
                                        className="input"
                                    >
                                        <option value="mastercard">🔴🟡 Mastercard</option>
                                        <option value="visa">🔵 Visa</option>
                                        <option value="amex">🟢 Amex</option>
                                        <option value="elo">🟠 Elo</option>
                                        <option value="other">💳 Outra</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Dia Fechamento</label>
                                    <input
                                        type="number"
                                        min="1" max="31"
                                        value={formData.closingDay}
                                        onChange={e => setFormData({ ...formData, closingDay: Number(e.target.value) })}
                                        className="input"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Dia Vencimento</label>
                                    <input
                                        type="number"
                                        min="1" max="31"
                                        value={formData.dueDay}
                                        onChange={e => setFormData({ ...formData, dueDay: Number(e.target.value) })}
                                        className="input"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Cor do Cartão</label>
                                <div className="flex gap-2">
                                    {['#1a1a2e', '#16213e', '#0f3460', '#533483', '#1b4332', '#3c1742', '#3d0066', '#1a0033'].map(color => (
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
                                <button type="submit" className="btn-primary flex-1 !bg-gradient-to-r !from-accent-500 !to-accent-600">
                                    {editingId ? 'Salvar Alterações' : 'Criar Cartão'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
