"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Navigation";
import { CurrencyInput } from "@/components/CurrencyInput";
import { useCollection } from "@/hooks/useFirestore";
import {
    Plus,
    Download,
    X,
    Edit3,
    Trash2,
    Check,
    Clock,
    FileText,
    User,
    TrendingUp,
    TrendingDown
} from "lucide-react";
import type { FinancialNote } from "@/types";
import { downloadCsv } from "@/lib/csv";
import {
    normalizeLegacyDateOnlyTimestamp,
    nowDateInputValue,
    parseDateInputToTimestamp,
    timestampToDateInputValue,
} from "@/lib/dateInput";

type NoteType = FinancialNote["type"];
type NoteStatus = FinancialNote["status"];

const noteTypeConfig: Record<NoteType, { label: string; color: string; lightColor: string }> = {
    general: { label: "Nota Livre", color: "text-slate-700", lightColor: "bg-slate-100" },
    to_receive: { label: "Me Deve", color: "text-green-700", lightColor: "bg-green-100" },
    to_pay: { label: "Eu Devo", color: "text-red-700", lightColor: "bg-red-100" },
};

const MAX_AMOUNT = 999999999.99;

export default function NotasPage() {
    const { data: notes, loading, add, update, remove } = useCollection<FinancialNote>("financial_notes");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        type: "general" as NoteType,
        status: "open" as NoteStatus,
        personName: "",
        amount: 0,
        dueDate: "",
    });

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    const formatDate = (timestamp: number) =>
        new Date(timestamp).toLocaleDateString("pt-BR");

    const openModal = (note?: FinancialNote) => {
        if (note) {
            setEditingId(note.id);
            setFormData({
                title: note.title || "",
                description: note.description || "",
                type: note.type || "general",
                status: note.status || "open",
                personName: note.personName || "",
                amount: note.amount || 0,
                dueDate: note.dueDate
                    ? timestampToDateInputValue(normalizeLegacyDateOnlyTimestamp(note.dueDate))
                    : "",
            });
        } else {
            setEditingId(null);
            setFormData({
                title: "",
                description: "",
                type: "general",
                status: "open",
                personName: "",
                amount: 0,
                dueDate: "",
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const handleDelete = async (note: FinancialNote) => {
        if (!confirm(`Excluir a nota "${note.title}"?`)) return;
        await remove(note.id);
    };

    const toggleStatus = async (note: FinancialNote) => {
        await update(note.id, {
            status: note.status === "open" ? "resolved" : "open",
            updatedAt: new Date().getTime(),
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const title = formData.title.trim();
        const description = formData.description.trim();
        const personName = formData.personName.trim();

        if (!title && !description) {
            alert("Preencha ao menos o título ou a descrição da nota.");
            return;
        }

        if (Number(formData.amount) > MAX_AMOUNT) {
            alert("O valor máximo permitido é R$ 999.999.999,99");
            return;
        }

        if (Number(formData.amount) < 0) {
            alert("O valor não pode ser negativo.");
            return;
        }

        const now = Date.now();
        const parsedDueDate = formData.dueDate ? parseDateInputToTimestamp(formData.dueDate) : null;

        if (formData.dueDate && (parsedDueDate === null || Number.isNaN(parsedDueDate))) {
            alert("Data de prazo inválida.");
            return;
        }

        const autoTitle =
            formData.type === "to_receive"
                ? `Cobrar de ${personName || "alguém"}`
                : formData.type === "to_pay"
                    ? `Pagar para ${personName || "alguém"}`
                    : "Nota financeira";

        const payload: Omit<FinancialNote, "id" | "createdAt"> & { createdAt?: number } = {
            title: title || autoTitle,
            description: description || "",
            type: formData.type,
            status: formData.status,
            personName: personName || null,
            amount: formData.amount > 0 ? Number(formData.amount) : null,
            dueDate: parsedDueDate,
            updatedAt: now,
        };

        if (editingId) {
            await update(editingId, payload);
        } else {
            await add({
                ...payload,
                createdAt: now,
            });
        }

        closeModal();
    };

    const sortedNotes = useMemo(() => {
        return [...notes].sort((a, b) => {
            if (a.status !== b.status) return a.status === "open" ? -1 : 1;
            const aTime = a.updatedAt || a.createdAt || 0;
            const bTime = b.updatedAt || b.createdAt || 0;
            return bTime - aTime;
        });
    }, [notes]);

    const openNotes = notes.filter(note => note.status === "open");
    const resolvedNotes = notes.filter(note => note.status === "resolved");
    const totalToReceive = openNotes
        .filter(note => note.type === "to_receive" && (note.amount || 0) > 0)
        .reduce((sum, note) => sum + (note.amount || 0), 0);
    const totalToPay = openNotes
        .filter(note => note.type === "to_pay" && (note.amount || 0) > 0)
        .reduce((sum, note) => sum + (note.amount || 0), 0);

    const handleExportCsv = () => {
        if (!sortedNotes.length) return;

        const rows = sortedNotes.map((note) => ({
            id: note.id,
            titulo: note.title,
            tipo: note.type,
            status: note.status,
            pessoa: note.personName || "",
            valor: note.amount ?? "",
            prazo: note.dueDate
                ? timestampToDateInputValue(normalizeLegacyDateOnlyTimestamp(note.dueDate))
                : "",
            descricao: note.description || "",
            criado_em: note.createdAt ? new Date(note.createdAt).toISOString() : "",
            atualizado_em: note.updatedAt ? new Date(note.updatedAt).toISOString() : "",
        }));

        downloadCsv({
            filename: `notas-financeiras-${nowDateInputValue()}.csv`,
            rows,
            columns: [
                { header: "ID", key: "id" },
                { header: "Titulo", key: "titulo" },
                { header: "Tipo", key: "tipo" },
                { header: "Status", key: "status" },
                { header: "Pessoa", key: "pessoa" },
                { header: "Valor", key: "valor" },
                { header: "Prazo", key: "prazo" },
                { header: "Descricao", key: "descricao" },
                { header: "Criado Em", key: "criado_em" },
                { header: "Atualizado Em", key: "atualizado_em" },
            ],
        });
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <Header title="Notas" subtitle="Bloco de notas financeiro, empréstimos e pendências" />
                <div className="flex flex-col sm:flex-row gap-2">
                    <button
                        onClick={handleExportCsv}
                        disabled={sortedNotes.length === 0}
                        className="btn-secondary flex items-center gap-2 w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="w-5 h-5" />
                        Exportar CSV
                    </button>
                    <button
                        onClick={() => openModal()}
                        className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
                    >
                        <Plus className="w-5 h-5" />
                        Nova Nota
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <div className="card p-4">
                    <p className="text-sm text-slate-500">Abertas</p>
                    <p className="text-2xl font-bold text-slate-900">{openNotes.length}</p>
                </div>
                <div className="card p-4">
                    <p className="text-sm text-slate-500">A Receber</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(totalToReceive)}</p>
                </div>
                <div className="card p-4">
                    <p className="text-sm text-slate-500">A Pagar</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(totalToPay)}</p>
                </div>
                <div className="card p-4">
                    <p className="text-sm text-slate-500">Resolvidas</p>
                    <p className="text-2xl font-bold text-slate-900">{resolvedNotes.length}</p>
                </div>
            </div>

            <div className="card overflow-hidden">
                {sortedNotes.length === 0 ? (
                    <div className="p-12 text-center">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">Nenhuma nota cadastrada</p>
                        <p className="text-xs text-slate-400 mt-1">Crie notas para registrar quem te deve, quem você deve e lembretes.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {sortedNotes.map(note => {
                            const config = noteTypeConfig[note.type];
                            const isResolved = note.status === "resolved";
                            const amount = note.amount || 0;
                            return (
                                <div key={note.id} className={`p-4 flex items-start gap-4 hover:bg-slate-50 ${isResolved ? "opacity-70" : ""}`}>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.lightColor}`}>
                                        {note.type === "to_receive" ? (
                                            <TrendingUp className="w-5 h-5 text-green-600" />
                                        ) : note.type === "to_pay" ? (
                                            <TrendingDown className="w-5 h-5 text-red-600" />
                                        ) : (
                                            <FileText className="w-5 h-5 text-slate-600" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold text-slate-900 truncate">{note.title}</p>
                                            <span className={`text-[11px] px-2 py-0.5 rounded-full ${config.lightColor} ${config.color}`}>
                                                {config.label}
                                            </span>
                                            <span className={`text-[11px] px-2 py-0.5 rounded-full ${isResolved ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"}`}>
                                                {isResolved ? "Resolvida" : "Em aberto"}
                                            </span>
                                        </div>

                                        {note.description && (
                                            <p className="text-sm text-slate-600 mt-1 break-words">{note.description}</p>
                                        )}

                                        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                                            {note.personName && (
                                                <span className="inline-flex items-center gap-1">
                                                    <User className="w-3 h-3" /> {note.personName}
                                                </span>
                                            )}
                                            {note.dueDate && <span>Prazo: {formatDate(note.dueDate)}</span>}
                                            <span>Atualizada em {formatDate(note.updatedAt || note.createdAt)}</span>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        {(amount > 0) && (
                                            <p className={`font-bold ${note.type === "to_receive" ? "text-green-600" : note.type === "to_pay" ? "text-red-600" : "text-slate-700"}`}>
                                                {note.type === "to_receive" ? "+" : note.type === "to_pay" ? "-" : ""} {formatCurrency(amount)}
                                            </p>
                                        )}
                                        <div className="flex items-center justify-end gap-1 mt-2">
                                            <button
                                                onClick={() => toggleStatus(note)}
                                                className={`p-2 rounded-lg transition-colors ${isResolved ? "text-amber-600 hover:bg-amber-50" : "text-green-600 hover:bg-green-50"}`}
                                                title={isResolved ? "Reabrir" : "Marcar resolvida"}
                                            >
                                                {isResolved ? <Clock className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => openModal(note)}
                                                className="icon-hitbox p-2 text-slate-500 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(note)}
                                                className="icon-hitbox p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="card p-0 w-full max-w-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-semibold text-slate-900">{editingId ? "Editar Nota" : "Nova Nota"}</h2>
                            <button onClick={closeModal} className="icon-hitbox p-2 hover:bg-slate-200 rounded-lg">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: "general" })}
                                    className={`py-3 rounded-xl font-medium transition-all ${formData.type === "general" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}
                                >
                                    Nota Livre
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: "to_receive" })}
                                    className={`py-3 rounded-xl font-medium transition-all ${formData.type === "to_receive" ? "bg-green-600 text-white" : "bg-green-50 text-green-700"}`}
                                >
                                    Me Deve
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: "to_pay" })}
                                    className={`py-3 rounded-xl font-medium transition-all ${formData.type === "to_pay" ? "bg-red-600 text-white" : "bg-red-50 text-red-700"}`}
                                >
                                    Eu Devo
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Título</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="input"
                                    placeholder="Ex: Empréstimo para João, Lembrar de cobrar..."
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        {formData.type === "to_receive" ? "Quem te deve?" : formData.type === "to_pay" ? "Para quem você deve?" : "Pessoa (opcional)"}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.personName}
                                        onChange={e => setFormData({ ...formData, personName: e.target.value })}
                                        className="input"
                                        placeholder="Nome da pessoa"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Prazo (opcional)</label>
                                    <input
                                        type="date"
                                        value={formData.dueDate}
                                        onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                        className="input"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Valor (opcional)</label>
                                    <CurrencyInput
                                        value={formData.amount}
                                        onChange={(value) => setFormData({ ...formData, amount: value })}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as NoteStatus })}
                                        className="input"
                                    >
                                        <option value="open">Em aberto</option>
                                        <option value="resolved">Resolvida</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Descrição</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="input min-h-[120px] resize-y"
                                    placeholder="Escreva os detalhes da situação..."
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary flex-1">
                                    {editingId ? "Salvar Alterações" : "Salvar Nota"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

