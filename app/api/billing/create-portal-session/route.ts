import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUserIdFromRequest } from "@/lib/serverAuth";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { sendOpsAlert, serializeError } from "@/lib/opsAlerts";
import type { Workspace } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PortalBody = {
    workspaceId?: string;
};

export async function POST(request: NextRequest) {
    let alertContext: Record<string, unknown> = {};

    try {
        const uid = await requireUserIdFromRequest(request);
        const body = (await request.json()) as PortalBody;
        const workspaceId = body.workspaceId;
        alertContext = {
            uid,
            workspaceId: workspaceId || "missing",
        };

        if (!workspaceId) {
            return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
        }

        const db = getAdminDb();
        const workspaceRef = db.collection("workspaces").doc(workspaceId);
        const workspaceSnap = await workspaceRef.get();

        if (!workspaceSnap.exists) {
            return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
        }

        const workspaceData = workspaceSnap.data() as Omit<Workspace, "id">;
        if (workspaceData.ownerId !== uid) {
            return NextResponse.json({ error: "Forbidden." }, { status: 403 });
        }

        const customerId = workspaceData.billing?.stripeCustomerId;
        if (!customerId) {
            return NextResponse.json(
                { error: "No Stripe customer linked to this workspace yet." },
                { status: 400 }
            );
        }

        const stripe = getStripe();
        const appUrl = getAppUrl();
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${appUrl}/dashboard/configuracoes`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error("create-portal-session error:", error);
        await sendOpsAlert({
            source: "api/billing/create-portal-session",
            message: "Unhandled exception while creating portal session.",
            level: "error",
            workspaceId: typeof alertContext.workspaceId === "string" ? alertContext.workspaceId : undefined,
            context: {
                ...alertContext,
                error: serializeError(error),
            },
        });
        return NextResponse.json(
            { error: error?.message || "Unable to create portal session." },
            { status: 500 }
        );
    }
}
