"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { Loader2, ArrowRight, Shield, Users, TrendingUp, CheckCircle2, ChevronDown, Check, Columns, Sparkles, Lock, CreditCard, Activity } from "lucide-react";
import Link from "next/link";

type BillingPlan = "monthly" | "yearly";

export default function ExperientialLandingPage() {
    const { user, loading, signInWithGoogle, signInWithEmail } = useAuth();
    const router = useRouter();

    // Auth States
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [emailLoginLoading, setEmailLoginLoading] = useState(false);
    const [emailLoginError, setEmailLoginError] = useState("");

    // UI States
    const [activeFaq, setActiveFaq] = useState<number | null>(null);
    const [scrolledState, setScrolledState] = useState(0); // 0 to 1 for generic scroll effects

    // Refs for Scrollytelling
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!loading && user) {
            router.push("/dashboard");
        }
    }, [user, loading, router]);

    // Handle scroll for dynamic animations
    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current) return;
            const scrollY = window.scrollY;
            const windowHeight = window.innerHeight;
            // Calculate a generic scroll percentage (0 to 1) relative to first fold
            const ratio = Math.min(scrollY / windowHeight, 1);
            setScrolledState(ratio);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    const handleEmailLogin = async (event: FormEvent) => {
        event.preventDefault();
        setEmailLoginError("");
        if (!email.trim() || !password) {
            setEmailLoginError("Preencha email e senha."); return;
        }
        setEmailLoginLoading(true);
        try {
            await signInWithEmail(email.trim(), password);
        } catch (error) {
            setEmailLoginError(error instanceof Error ? error.message : "Erro ao entrar.");
        } finally {
            setEmailLoginLoading(false);
        }
    };

    const startCheckout = async (plan: BillingPlan) => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem("checkout:preferredPlan", plan);
        }
        if (user) { router.push(`/checkout?plan=${plan}`); return; }
        await signInWithGoogle();
    };

    const toggleFaq = (index: number) => {
        setActiveFaq(activeFaq === index ? null : index);
    };

    return (
        <div ref={containerRef} className="min-h-screen bg-[#070709] text-slate-100 font-sans overflow-x-hidden selection:bg-indigo-500/30">

            {/* Ambient Animated Mesh/Aurora Backgrounds */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-600/10 blur-[150px] animate-aurora mix-blend-screen" />
                <div className="absolute top-[20%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-fuchsia-600/10 blur-[150px] animate-aurora mix-blend-screen" style={{ animationDelay: '2s' }} />
                <div className="absolute top-[60%] left-[20%] w-[40vw] h-[40vw] rounded-full bg-blue-600/10 blur-[150px] animate-aurora mix-blend-screen" style={{ animationDelay: '4s' }} />

                {/* Noise Texture Overlay for Premium Feel */}
                <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />
            </div>

            {/* Premium Glassmorphism Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05] bg-[#070709]/60 backdrop-blur-2xl transition-all">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3 group cursor-pointer">
                        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)] group-hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.8)] transition-all">
                            <span className="font-bold text-white text-xs tracking-wider">AF</span>
                            <div className="absolute inset-0 rounded-xl bg-white/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="font-bold tracking-tight text-white/90">App Financeiro</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link href="#pricing" className="text-sm font-medium text-slate-400 hover:text-white transition-colors hidden sm:block">
                            Assinatura
                        </Link>
                        <button
                            onClick={signInWithGoogle}
                            className="relative group px-5 py-2 rounded-full overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/[0.08] group-hover:bg-white/[0.12] transition-colors" />
                            <div className="absolute inset-0 border border-white/10 rounded-full" />
                            <span className="relative text-sm font-medium text-white">Acessar</span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section (Immersive, Scale-in on scroll) */}
            <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-4 z-10 pt-20">

                <div className="inline-flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-full px-4 py-1.5 mb-10 backdrop-blur-md animate-fade-in-up">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span className="bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent text-sm font-medium">
                        Finalmente. Finanças desenhadas para a Vida a Dois.
                    </span>
                </div>

                <h1
                    className="text-6xl md:text-8xl font-black mb-6 tracking-tighter leading-[1.1] max-w-5xl mx-auto text-center"
                    style={{ transform: `scale(${1 - scrolledState * 0.1})`, opacity: 1 - scrolledState * 1.5 }}
                >
                    O fim das <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400">brigas por dinheiro</span><br />no seu relacionamento.
                </h1>

                <p
                    className="text-xl md:text-2xl text-slate-400/90 mb-12 max-w-3xl mx-auto leading-relaxed text-center font-light"
                    style={{ opacity: 1 - scrolledState * 2 }}
                >
                    Substituímos o estresse do fim do mês por um painel inteligente. Reúna as contas da casa, acompanhe o que é em conjunto e preserve os gastos individuais. Tudo numa única tela.
                </p>

                <div className="relative group" style={{ opacity: 1 - scrolledState * 2 }}>
                    {/* Conic Gradient Glowing Border Effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-indigo-500 rounded-[2rem] blur-md opacity-70 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-spin-slow" />
                    <button
                        onClick={() => startCheckout("yearly")}
                        className="relative flex items-center justify-center gap-3 bg-[#0a0a0c] text-white px-10 py-5 rounded-[1.8rem] font-bold text-lg hover:bg-[#111115] transition-colors border border-white/10"
                    >
                        Criar Conta da Casa
                        <ArrowRight className="w-5 h-5 text-indigo-400 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                <p className="mt-8 text-xs text-slate-500 flex items-center justify-center gap-2 tracking-wide uppercase font-semibold">
                    <Shield className="w-3 h-3" /> Faturamento seguro via Stripe
                </p>
            </section>

            {/* Experiential Mockup / Scrollytelling Entry Point */}
            <section className="relative z-20 w-full max-w-6xl mx-auto px-4 -mt-10 pb-32">
                <div className="relative w-full aspect-[16/10] md:aspect-[21/9] rounded-2xl border border-white/10 bg-[#0a0a0c]/80 backdrop-blur-3xl p-4 shadow-2xl overflow-hidden group">
                    {/* Inner Screen Faux UI */}
                    <div className="w-full h-full bg-[#050505] rounded-xl border border-white/5 relative overflow-hidden flex flex-col">
                        {/* Fake Header */}
                        <div className="h-14 border-b border-white/5 flex items-center px-6 gap-4">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold ring-2 ring-indigo-500/30">H</div>
                            <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center text-xs font-bold ring-2 ring-fuchsia-500/30 -ml-2">M</div>
                            <span className="text-sm font-semibold text-slate-300 ml-2">Painel da Casa</span>
                        </div>
                        {/* Fake Content Area to represent the App */}
                        <div className="flex-1 p-6 flex items-center justify-center">
                            <div className="text-center opacity-40">
                                <Activity className="w-16 h-16 mx-auto mb-4 text-indigo-400 animate-pulse" />
                                <p className="text-slate-400 font-medium">Dashboard Real renderizado aqui</p>
                                <p className="text-xs text-slate-500">Visão Individual e Compartilhada em tempo real.</p>
                            </div>
                        </div>

                        {/* Animated Gradient sweeps across screen on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:animate-[marquee_2s_ease-in-out_infinite] pointer-events-none" />
                    </div>
                </div>
            </section>

            {/* Social Proof Infinite Marquee */}
            <section className="py-10 border-y border-white/5 bg-[#0a0a0c]/50 relative z-10 overflow-hidden flex items-center">
                <div className="absolute left-0 w-32 h-full bg-gradient-to-r from-[#070709] to-transparent z-10" />
                <div className="absolute right-0 w-32 h-full bg-gradient-to-l from-[#070709] to-transparent z-10" />

                <div className="flex whitespace-nowrap animate-marquee">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <div key={i} className="inline-flex items-center gap-3 px-8 text-slate-500 font-medium text-sm border-r border-white/5 last:border-0 opacity-60">
                            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                            Novo controle financeiro iniciado agora
                        </div>
                    ))}
                    {/* Duplicate for seamless infinite loop */}
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                        <div key={`dup-${i}`} className="inline-flex items-center gap-3 px-8 text-slate-500 font-medium text-sm border-r border-white/5 last:border-0 opacity-60">
                            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                            Novo controle financeiro iniciado agora
                        </div>
                    ))}
                </div>
            </section>

            {/* Bento Grid Feature Section (Linear Style) */}
            <section className="py-32 px-4 relative z-10">
                <div className="max-w-6xl mx-auto">
                    <div className="mb-20">
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Porque as planilhas pararam no tempo?</h2>
                        <p className="text-xl text-slate-400 max-w-2xl leading-relaxed">
                            Porque elas exigem trabalho manual robótico. Nós automatizamos a organização do seu dinheiro e escalamos a infraestrutura perfeitamente para quando você for morar com alguém.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Large Bento Card */}
                        <div className="md:col-span-2 bg-gradient-to-br from-white/[0.05] to-white/[0.01] border border-white/[0.05] rounded-3xl p-10 relative overflow-hidden group hover:border-white/10 transition-colors">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                            <Users className="w-10 h-10 text-indigo-400 mb-6" />
                            <h3 className="text-2xl font-semibold mb-4 text-white">Autonomia Solo. Expansão para Casais.</h3>
                            <p className="text-slate-400 leading-relaxed mb-8 max-w-md">
                                Como solteiro, você tem os gráficos e as projeções mais viscerais sobre o seu fluxo de caixa. Como casal, basta um clique para ativar a "Vida a Dois": cada um entra com seu e-mail e as despesas da casa sincronizam no celular de ambos.
                            </p>
                            <div className="flex gap-4">
                                <div className="bg-[#0a0a0c] border border-white/5 px-4 py-2 rounded-lg text-xs font-medium text-emerald-400 flex items-center gap-2 shadow-inner shadow-white/5">
                                    <Activity className="w-3 h-3" /> Arquitetura Escalável
                                </div>
                            </div>
                        </div>

                        {/* Standard Bento Card */}
                        <div className="bg-gradient-to-br from-white/[0.05] to-white/[0.01] border border-white/[0.05] rounded-3xl p-10 relative overflow-hidden hover:border-white/10 transition-colors">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-[60px] translate-x-1/4 -translate-y-1/4" />
                            <Columns className="w-10 h-10 text-fuchsia-400 mb-6" />
                            <h3 className="text-2xl font-semibold mb-4 text-white">A Tese do "Meu, Seu, Nosso"</h3>
                            <p className="text-slate-400 leading-relaxed text-sm">
                                Fez o upgrade para Casal? O App separa automaticamente as contas de luz ou supermercado da "Casa" (Nosso) das faturas de Cartão de Crédito particulares (Meu/Seu).
                            </p>
                        </div>

                        {/* Standard Bento Card */}
                        <div className="bg-gradient-to-br from-white/[0.05] to-white/[0.01] border border-white/[0.05] rounded-3xl p-10 relative overflow-hidden hover:border-white/10 transition-colors">
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[60px] -translate-x-1/4 translate-y-1/4" />
                            <Lock className="w-10 h-10 text-blue-400 mb-6" />
                            <h3 className="text-2xl font-semibold mb-4 text-white">Blindagem Total de Dados</h3>
                            <p className="text-slate-400 leading-relaxed text-sm">
                                Não exigimos senhas de banco e evitamos open finance obscuros. Ninguém usa seus dados de consumo para lhe empurrar cartão de corretora. Seu ecossistema é privado, via Google Cloud.
                            </p>
                        </div>

                        {/* Wide Thin Fast Feature Card */}
                        <div className="md:col-span-2 bg-[#050505] border border-white/[0.05] rounded-3xl p-8 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-1">Acesso Imediato Web</h3>
                                <p className="text-sm text-slate-500">Sem instalar nada. Acesse via Safari, Chrome, PC ou Mac.</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:bg-indigo-500/10 transition-colors">
                                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-400" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Immersive Pricing Section */}
            <section id="pricing" className="py-32 px-4 relative z-10">
                {/* Radial gradient background to highlight pricing */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-full w-full max-w-4xl mx-auto bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

                <div className="max-w-5xl mx-auto relative">
                    <div className="text-center mb-20 section-header">
                        <h2 className="text-5xl md:text-6xl font-black mb-6 tracking-tight">Assinatura Única Para A Casa.</h2>
                        <p className="text-xl text-slate-400">Só um paga. Os dois acessam. <br /> Comece agora com 7 dias cobertos pela nossa garantia de paz.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">

                        {/* Plano Mensal - Minimalist */}
                        <div className="rounded-[2.5rem] border border-white/[0.05] bg-white/[0.01] p-10 flex flex-col hover:bg-white/[0.03] transition-colors">
                            <h3 className="text-2xl font-semibold text-white">Casal Mensal</h3>
                            <p className="text-slate-400 mt-2 text-sm">Paz no relacionamento custa menos que um Ifood num fim de semana.</p>

                            <div className="mt-12 mb-10">
                                <span className="text-6xl font-black text-white tracking-tighter">R$ 49</span>
                                <span className="text-slate-500 font-medium">/mês</span>
                            </div>

                            <ul className="space-y-4 text-slate-300 mb-12 flex-grow text-sm font-medium">
                                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-slate-500 shrink-0" /> Inclusão de Parceiro(a) 100% Gratuita</li>
                                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-slate-500 shrink-0" /> Dashboard Completo e Compartilhado</li>
                                <li className="flex items-center gap-3"><Check className="w-5 h-5 text-slate-500 shrink-0" /> Suporte Premium aos assinantes</li>
                            </ul>

                            <button
                                onClick={() => startCheckout("monthly")}
                                className="w-full bg-[#0a0a0c] text-white py-5 rounded-2xl font-bold hover:bg-[#111115] transition-all flex items-center justify-center gap-2 border border-white/10"
                            >
                                Assinar Plano Mensal <ArrowRight className="w-4 h-4 opacity-50" />
                            </button>
                        </div>

                        {/* Plano Anual - Premium Focus */}
                        <div className="rounded-[2.5rem] border border-indigo-500/30 bg-gradient-to-b from-indigo-500/10 to-transparent p-1 relative shadow-2xl flex flex-col transform md:-translate-y-6">
                            {/* Inner Box to create gradient border effect */}
                            <div className="bg-[#0a0a0c] rounded-[2.4rem] p-10 h-full flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[80px]" />

                                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />

                                <span className="inline-block w-fit px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-bold tracking-wider mb-6">
                                    ESCOLHA ESTRATÉGICA
                                </span>

                                <h3 className="text-2xl font-semibold text-white">Elite Anual</h3>
                                <p className="text-slate-400 mt-2 text-sm">Organize a estrutura patrimonial da família garantindo proteção contra aumentos.</p>

                                <div className="mt-12 mb-4">
                                    <span className="text-6xl font-black text-white tracking-tighter">R$ 497</span>
                                    <span className="text-slate-500 font-medium">/ano</span>
                                </div>
                                <div className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-fuchsia-400 mb-10">
                                    Equivale a R$ 41,41 por mês (Você zera o atrito do ano inteiro).
                                </div>

                                <ul className="space-y-4 text-slate-200 mb-12 flex-grow text-sm font-medium">
                                    <li className="flex items-center gap-3"><Check className="w-5 h-5 text-indigo-400 shrink-0" /> Tudo do plano mensal habilitado</li>
                                    <li className="flex items-center gap-3"><Check className="w-5 h-5 text-indigo-400 shrink-0" /> Desconto Matemático (2 meses gratuitos)</li>
                                    <li className="flex items-center gap-3"><Check className="w-5 h-5 text-indigo-400 shrink-0" /> Prioridade em Recursos Exclusivos B2C</li>
                                </ul>

                                <button
                                    onClick={() => startCheckout("yearly")}
                                    className="w-full bg-white text-[#0a0a0c] py-5 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                >
                                    Assinar com Desconto <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Minimalist FAQ (Clean Accordion) */}
            <section className="py-24 px-4 relative z-10 border-t border-white/[0.02] bg-gradient-to-b from-transparent to-[#050505]">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold tracking-tight">Perguntas Rápidas</h2>
                    </div>

                    <div className="space-y-3">
                        {[
                            {
                                q: "A cobrança dos 7 dias entra na hora?",
                                a: "Não. A Stripe valida o seu meio de pagamento para liberar o cofre, mas o débito exato de 49 ou 497 só cai depois do 7º dia. Cancele no 5º dia, aperte um botão, e nada acontece na fatura."
                            },
                            {
                                q: "Nós precisamos baixar o App numa Store (Apple/Play)?",
                                a: "Não, essa é a beleza do ecosistema moderno. O App Financeiro opera como um PWA de alta fluidez. Basta clicar no link de Acesso, logar do Safari ou Chrome (celular duplo ou PC) e vocês já estão no painel."
                            },
                            {
                                q: "Posso cancelar no mês que eu quiser?",
                                a: "Sim. A assinatura mensal não tem trava de fidelidade corporativa. Ficam enquanto as ferramentas trouxerem paz para o ambiente da casa."
                            }
                        ].map((faq, index) => (
                            <div key={index} className="border border-white/[0.05] rounded-xl bg-white/[0.01] hover:bg-white/[0.03] transition-colors overflow-hidden">
                                <button
                                    className="w-full text-left px-6 py-5 flex items-center justify-between font-medium text-slate-200"
                                    onClick={() => toggleFaq(index)}
                                >
                                    {faq.q}
                                    <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${activeFaq === index ? "rotate-180" : ""}`} />
                                </button>
                                <div
                                    className={`px-6 text-slate-400 text-sm leading-relaxed overflow-hidden transition-all duration-300 ease-in-out ${activeFaq === index ? "max-h-40 pb-5 opacity-100" : "max-h-0 opacity-0"}`}
                                >
                                    {faq.a}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Developer Login Fallback - Super Clean */}
            <section className="py-20 px-4 relative z-10 max-w-sm mx-auto">
                <form
                    onSubmit={handleEmailLogin}
                    className="flex flex-col gap-4 text-center group"
                >
                    <span className="text-xs font-medium uppercase tracking-widest text-slate-600 mb-2">Já tem conta?</span>
                    <input
                        type="email"
                        autoComplete="email"
                        placeholder="E-mail"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors text-center"
                    />
                    <input
                        type="password"
                        autoComplete="current-password"
                        placeholder="Senha"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="w-full bg-[#0a0a0c] border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors text-center"
                    />
                    <button
                        type="submit"
                        disabled={emailLoginLoading}
                        className="mt-2 w-full flex items-center justify-center gap-2 text-slate-400 bg-white/[0.02] hover:bg-white/[0.05] hover:text-white border border-white/5 py-3 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
                    >
                        {emailLoginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fazer Login Rápido"}
                    </button>
                    {emailLoginError && <p className="mt-2 text-xs text-red-400">{emailLoginError}</p>}
                </form>
            </section>

            <footer className="border-t border-white/[0.05] bg-[#050505] py-12 px-4 relative z-10 text-center text-sm font-medium text-slate-600">
                <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">
                    <div className="flex items-center gap-2 opacity-50">
                        <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center border border-white/10">
                            <span className="font-bold text-white text-[8px]">AF</span>
                        </div>
                        <span>App Financeiro</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
                        <Link href="/termos" className="hover:text-slate-300 transition-colors">Termos</Link>
                        <Link href="/privacidade" className="hover:text-slate-300 transition-colors">Privacidade</Link>
                        <Link href="/suporte" className="hover:text-slate-300 transition-colors">Contato Comercial</Link>
                    </div>
                    <span className="text-xs text-slate-700 mt-4">2026 © Fator 4 Tecnologia.</span>
                </div>
            </footer>
        </div>
    );
}
