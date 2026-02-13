import Link from "next/link";

export default function PrivacidadePage() {
    return (
        <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
            <div className="max-w-3xl mx-auto card p-6 lg:p-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Política de Privacidade</h1>
                <p className="text-sm text-slate-500 mb-6">Última atualização: 12 de fevereiro de 2026</p>

                <div className="space-y-5 text-sm text-slate-700 leading-relaxed">
                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">1. Dados coletados</h2>
                        <p>
                            Coletamos dados de autenticação (nome, email e identificador do Google) e dados financeiros inseridos por você no aplicativo.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">2. Finalidade</h2>
                        <p>
                            Utilizamos os dados para autenticação, operação do produto, processamento de assinatura e melhoria da experiência.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">3. Compartilhamento</h2>
                        <p>
                            Não vendemos dados pessoais. Serviços de terceiros essenciais podem processar dados, como Firebase (infraestrutura) e Stripe (pagamentos).
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">4. Segurança</h2>
                        <p>
                            Adotamos medidas técnicas para proteger os dados, mas nenhum sistema é 100% imune. Recomendamos uso de conta Google segura.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">5. Direitos do titular</h2>
                        <p>
                            Você pode solicitar atualização ou exclusão de dados, respeitadas obrigações legais e técnicas aplicáveis.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">6. Contato</h2>
                        <p>
                            Para solicitações relacionadas à privacidade, utilize o canal oficial em{" "}
                            <Link href="/suporte" className="text-primary-600 hover:underline">
                                /suporte
                            </Link>.
                        </p>
                    </section>
                </div>

                <div className="mt-8 pt-5 border-t border-slate-200 text-sm">
                    <Link href="/" className="text-primary-600 hover:underline">Voltar ao início</Link>
                </div>
            </div>
        </main>
    );
}
