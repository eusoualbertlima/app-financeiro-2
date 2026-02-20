import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUserFromRequest } from "@/lib/serverAuth";
import {
    getServerDevAdminAllowlist,
    hasConfiguredDevAdminAllowlist,
    hasDevAdminAccess,
} from "@/lib/devAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUIRED_ENV = [
    "NEXT_PUBLIC_APP_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID_MONTHLY",
    "STRIPE_PRICE_ID_YEARLY",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
] as const;

function normalizeErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
}

export async function GET(request: NextRequest) {
    try {
        const decodedUser = await requireUserFromRequest(request);
        const allowlist = getServerDevAdminAllowlist();

        if (!hasConfiguredDevAdminAllowlist(allowlist)) {
            return NextResponse.json(
                { error: "Configure DEV_ADMIN_EMAILS ou DEV_ADMIN_UIDS no ambiente do servidor." },
                { status: 503 }
            );
        }

        const hasAccess = hasDevAdminAccess({
            uid: decodedUser.uid,
            email: decodedUser.email || null,
            allowlist,
        });

        if (!hasAccess) {
            return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }
    } catch (error) {
        const message = normalizeErrorMessage(error).toLowerCase();
        if (message.includes("missing bearer token")) {
            return NextResponse.json({ error: "Sessao invalida. Faça login novamente." }, { status: 401 });
        }
        if (
            message.includes("verifyidtoken")
            || message.includes("id token")
            || message.includes("token has expired")
        ) {
            return NextResponse.json({ error: "Token invalido ou expirado. Faça login novamente." }, { status: 401 });
        }
        return NextResponse.json({ error: "Erro ao validar acesso administrativo." }, { status: 500 });
    }

    const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
    let firebaseAdminReady = false;
    let firebaseAdminError: string | null = null;

    try {
        // Touch Firestore Admin to validate credentials wiring.
        getAdminDb();
        firebaseAdminReady = true;
    } catch (error: unknown) {
        firebaseAdminError = error instanceof Error
            ? error.message
            : "Failed to initialize Firebase Admin.";
    }

    return NextResponse.json({
        ok: missingEnv.length === 0 && firebaseAdminReady,
        missingEnv,
        firebaseAdminReady,
        firebaseAdminError,
    });
}
