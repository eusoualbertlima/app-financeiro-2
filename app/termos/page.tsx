import Link from "next/link";

export default function TermosPage() {
    return (
        <main className="min-h-screen bg-slate-50 p-6 lg:p-10">
            <div className="max-w-3xl mx-auto card p-6 lg:p-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Termos de Uso</h1>
                <p className="text-sm text-slate-500 mb-6">Última atualização: 12 de fevereiro de 2026</p>

                <div className="space-y-5 text-sm text-slate-700 leading-relaxed">
                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">1. Objeto</h2>
                        <p>
                            Estes termos regulam o uso do App Financeiro 2.0, uma plataforma para organização financeira pessoal.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">2. Conta e acesso</h2>
                        <p>
                            O acesso é realizado via autenticação Google. Você é responsável por manter sua conta segura e por toda atividade nela realizada.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">3. Assinatura e cobrança</h2>
                        <p>
                            Recursos pagos podem ser cobrados de forma recorrente por meio da Stripe. Cancelamentos e alterações de plano seguem as regras do provedor de pagamento e do plano contratado.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">4. Uso aceitável</h2>
                        <p>
                            É proibido usar a plataforma para atividades ilícitas, tentativa de fraude, engenharia reversa maliciosa ou comprometimento de segurança.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">5. Limitação de responsabilidade</h2>
                        <p>
                            O App Financeiro 2.0 fornece suporte à organização financeira e não constitui consultoria jurídica, contábil ou de investimentos.
                        </p>
                    </section>

                    <section>
                        <h2 className="font-semibold text-slate-900 mb-1">6. Alterações</h2>
                        <p>
                            Estes termos podem ser atualizados periodicamente. O uso contínuo após alterações implica concordância com a versão vigente.
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
