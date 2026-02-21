import { NextRequest, NextResponse } from "next/server";
import { requireUserFromRequest } from "@/lib/serverAuth";
import {
    getServerDevAdminAllowlist,
    hasConfiguredDevAdminAllowlist,
    hasDevAdminAccess,
} from "@/lib/devAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
}

export async function GET(request: NextRequest) {
    try {
        const decodedUser = await requireUserFromRequest(request);
        const allowlist = getServerDevAdminAllowlist();
        const configured = hasConfiguredDevAdminAllowlist(allowlist);

        if (!configured) {
            return NextResponse.json({
                isDeveloperAdmin: false,
                configured: false,
            });
        }

        const isDeveloperAdmin = hasDevAdminAccess({
            uid: decodedUser.uid,
            email: decodedUser.email || null,
            allowlist,
        });

        return NextResponse.json({
            isDeveloperAdmin,
            configured: true,
        });
    } catch (error) {
        const message = normalizeErrorMessage(error).toLowerCase();
        if (message.includes("missing bearer token")) {
            return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
        }
        if (
            message.includes("verifyidtoken")
            || message.includes("id token")
            || message.includes("token has expired")
        ) {
            return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 });
        }

        return NextResponse.json(
            { error: "Erro ao validar acesso dev-admin." },
            { status: 500 }
        );
    }
}
