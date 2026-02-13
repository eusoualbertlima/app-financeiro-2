import Link from "next/link";

export default function PoliticaComercialPage() {
    return (
        <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
            <div className="max-w-3xl mx-auto card p-6 lg:p-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Política Comercial</h1>
                <p className="text-sm text-slate-500 mb-6">Última atualização: 13 de fevereiro de 2026</p>

                <div className="space-y-5 text-sm text-slate-700 leading-relaxed">
                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">1. Planos e cobrança</h2>
                        <p>
                            O App Financeiro 2.0 oferece planos de assinatura mensal e anual com cobrança recorrente
                            processada via Stripe.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">2. Período de teste</h2>
                        <p>
                            Novos workspaces podem receber período de teste gratuito. Ao fim do teste, o acesso pode
                            ser bloqueado até ativação de assinatura válida.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">3. Cancelamento</h2>
                        <p>
                            O cancelamento pode ser solicitado a qualquer momento no portal de cobrança da Stripe.
                            Quando aplicável, a assinatura permanece ativa até o fim do ciclo já pago.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">4. Reembolso</h2>
                        <p>
                            Solicitações de reembolso são avaliadas caso a caso. Como política padrão, pedidos enviados
                            em até 7 dias corridos após a primeira cobrança podem ser considerados prioritariamente.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">5. Inadimplência</h2>
                        <p>
                            Em caso de falha de pagamento recorrente, o acesso pode ser limitado até regularização da assinatura.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">6. Suporte e SLA</h2>
                        <p>
                            O canal oficial de suporte responde em até 1 dia útil para primeira resposta. Consulte a{" "}
                            <Link href="/suporte" className="text-primary-600 hover:underline">
                                página de suporte
                            </Link>{" "}
                            para mais detalhes.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">7. Atualizações desta política</h2>
                        <p>
                            Esta política pode ser revisada periodicamente. Alterações relevantes serão refletidas nesta página.
                        </p>
                    </section>
                </div>

                <div className="mt-8 pt-5 border-t border-slate-200 text-sm space-x-4">
                    <Link href="/termos" className="text-primary-600 hover:underline">Termos de Uso</Link>
                    <Link href="/privacidade" className="text-primary-600 hover:underline">Política de Privacidade</Link>
                    <Link href="/" className="text-primary-600 hover:underline">Voltar ao início</Link>
                </div>
            </div>
        </main>
    );
}
