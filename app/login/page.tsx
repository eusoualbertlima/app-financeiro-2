"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

function toSafeInternalPath(value: string | null | undefined) {
    const nextPath = (value || "").trim();
    if (!nextPath) return "/dashboard";
    if (!nextPath.startsWith("/")) return "/dashboard";
    if (nextPath.startsWith("//")) return "/dashboard";
    return nextPath;
}

function LoginContent() {
    const { user, loading, signInWithGoogle, signInWithEmail } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const nextPath = useMemo(
        () => toSafeInternalPath(searchParams.get("next")),
        [searchParams]
    );

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [googleLoading, setGoogleLoading] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (!loading && user) {
            router.replace(nextPath);
        }
    }, [loading, user, router, nextPath]);

    const handleGoogleLogin = async () => {
        setErrorMessage("");
        setGoogleLoading(true);
        try {
            await signInWithGoogle();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel entrar com Google.");
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleEmailLogin = async (event: FormEvent) => {
        event.preventDefault();
        setErrorMessage("");

        if (!email.trim() || !password) {
            setErrorMessage("Preencha email e senha.");
            return;
        }

        setEmailLoading(true);
        try {
            await signInWithEmail(email.trim(), password);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Nao foi possivel entrar com email e senha.");
        } finally {
            setEmailLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white px-4 py-10">
            <div className="max-w-md mx-auto">
                <div className="text-center mb-8">
                    <Link href="/pricing" className="text-sm text-slate-400 hover:text-slate-200">
                        &larr; Voltar para vendas
                    </Link>
                    <h1 className="text-3xl font-bold mt-4">Entrar na conta</h1>
                    <p className="text-slate-400 mt-2">Acesse seu workspace para continuar.</p>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                    <button
                        onClick={handleGoogleLogin}
                        disabled={googleLoading || emailLoading}
                        className="w-full py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {googleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar com Google"}
                        <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-3 my-5">
                        <div className="h-px bg-slate-700 flex-1" />
                        <span className="text-xs text-slate-500">ou</span>
                        <div className="h-px bg-slate-700 flex-1" />
                    </div>

                    <form onSubmit={handleEmailLogin} className="space-y-3">
                        <input
                            type="email"
                            autoComplete="email"
                            placeholder="Seu email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-500"
                        />
                        <input
                            type="password"
                            autoComplete="current-password"
                            placeholder="Sua senha"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-slate-500"
                        />
                        <button
                            type="submit"
                            disabled={googleLoading || emailLoading}
                            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {emailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar com email"}
                        </button>
                    </form>

                    {errorMessage && (
                        <p className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                            {errorMessage}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
                    <Loader2 className="w-8 h-8 animate-spin" />
                </div>
            }
        >
            <LoginContent />
        </Suspense>
    );
}
