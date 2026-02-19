import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

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

export async function GET() {
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
