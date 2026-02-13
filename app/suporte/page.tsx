import Link from "next/link";
import { Mail, Clock3, CircleHelp, ShieldCheck } from "lucide-react";

const SUPPORT_EMAIL = "limaalberth20@gmail.com";

export default function SuportePage() {
    return (
        <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
            <div className="max-w-4xl mx-auto">
                <div className="card p-6 lg:p-8 mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Suporte e Contato</h1>
                    <p className="text-sm text-slate-500">Última atualização: 13 de fevereiro de 2026</p>
                    <p className="text-sm text-slate-700 mt-4 leading-relaxed">
                        Este canal atende dúvidas sobre cadastro, assinatura, cobrança, recuperação de acesso
                        e suporte técnico do App Financeiro 2.0.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <section className="card p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Mail className="w-5 h-5 text-primary-600" />
                            <h2 className="font-semibold text-slate-900">Canal oficial</h2>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">
                            Atendimento por e-mail (com histórico do caso e resposta por escrito):
                        </p>
                        <a
                            href={`mailto:${SUPPORT_EMAIL}?subject=Suporte%20App%20Financeiro%202.0`}
                            className="text-primary-600 font-medium hover:underline break-all"
                        >
                            {SUPPORT_EMAIL}
                        </a>
                    </section>

                    <section className="card p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Clock3 className="w-5 h-5 text-primary-600" />
                            <h2 className="font-semibold text-slate-900">SLA de atendimento</h2>
                        </div>
                        <ul className="text-sm text-slate-700 space-y-1">
                            <li>Primeira resposta: até 1 dia útil.</li>
                            <li>Questões de cobrança: prioridade alta.</li>
                            <li>Incidentes críticos: atualização contínua até resolução.</li>
                        </ul>
                    </section>

                    <section className="card p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <CircleHelp className="w-5 h-5 text-primary-600" />
                            <h2 className="font-semibold text-slate-900">Como abrir chamado</h2>
                        </div>
                        <ol className="text-sm text-slate-700 space-y-1 list-decimal list-inside">
                            <li>Informe o e-mail da conta Google usada no app.</li>
                            <li>Informe o ID do workspace (em Configurações).</li>
                            <li>Descreva o erro e, se possível, anexe print.</li>
                        </ol>
                    </section>

                    <section className="card p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <ShieldCheck className="w-5 h-5 text-primary-600" />
                            <h2 className="font-semibold text-slate-900">Privacidade no suporte</h2>
                        </div>
                        <p className="text-sm text-slate-700">
                            Não solicitamos senha da conta Google nem dados de cartão. Para temas de pagamento,
                            usamos o portal seguro da Stripe quando necessário.
                        </p>
                    </section>
                </div>

                <div className="mt-6 card p-4 text-sm text-slate-600">
                    <p>
                        Consulte também a{" "}
                        <Link href="/politica-comercial" className="text-primary-600 hover:underline">
                            Política Comercial
                        </Link>{" "}
                        para regras de cancelamento e reembolso.
                    </p>
                    <p className="mt-2">
                        <Link href="/" className="text-primary-600 hover:underline">
                            Voltar ao início
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
