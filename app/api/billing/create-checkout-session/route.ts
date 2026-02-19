import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUserFromRequest } from "@/lib/serverAuth";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { getDefaultTrialEndsAt } from "@/lib/billing";
import { sendOpsAlert, serializeError } from "@/lib/opsAlerts";
import type { Workspace } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckoutBody = {
    workspaceId?: string;
    plan?: "monthly" | "yearly";
    acceptedLegal?: boolean;
};

function getPriceId(plan: "monthly" | "yearly") {
    if (plan === "yearly") {
        return process.env.STRIPE_PRICE_ID_YEARLY;
    }
    return process.env.STRIPE_PRICE_ID_MONTHLY;
}

export async function POST(request: NextRequest) {
    let alertContext: Record<string, unknown> = {};

    try {
        const decodedUser = await requireUserFromRequest(request);
        const uid = decodedUser.uid;
        const userEmail = decodedUser.email;
        const body = (await request.json()) as CheckoutBody;
        const workspaceId = body.workspaceId;
        const plan: "monthly" | "yearly" = body.plan === "yearly" ? "yearly" : "monthly";
        const acceptedLegal = body.acceptedLegal === true;
        alertContext = {
            uid,
            workspaceId: workspaceId || "missing",
            plan,
            acceptedLegal,
        };

        if (!workspaceId) {
            return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
        }

        const priceId = getPriceId(plan);
        if (!priceId) {
            await sendOpsAlert({
                source: "api/billing/create-checkout-session",
                message: `Missing Stripe price env for ${plan}.`,
                level: "error",
                workspaceId: workspaceId || undefined,
                context: alertContext,
            });
            return NextResponse.json(
                { error: `Missing Stripe price env for ${plan}.` },
                { status: 500 }
            );
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

        const alreadyAcceptedLegal = Boolean(
            workspaceData.legal?.acceptedTermsAt && workspaceData.legal?.acceptedPrivacyAt
        );
        if (!acceptedLegal && !alreadyAcceptedLegal) {
            return NextResponse.json(
                { error: "Você precisa aceitar os Termos e a Política de Privacidade para continuar." },
                { status: 400 }
            );
        }

        const stripe = getStripe();
        const billing = workspaceData.billing || {
            status: "inactive",
            trialEndsAt: getDefaultTrialEndsAt(workspaceData.createdAt || Date.now()),
        };

        let customerId = billing.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: userEmail,
                name: workspaceData.name || "Workspace",
                metadata: {
                    workspaceId,
                },
            });
            customerId = customer.id;
        }

        const appUrl = getAppUrl();
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            allow_promotion_codes: true,
            client_reference_id: workspaceId,
            metadata: {
                workspaceId,
                uid,
                plan,
            },
            subscription_data: {
                metadata: {
                    workspaceId,
                    uid,
                    plan,
                },
            },
            success_url: `${appUrl}/checkout?success=1&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/checkout?canceled=1`,
        });

        await workspaceRef.set({
            billing: {
                ...billing,
                plan,
                stripeCustomerId: customerId,
                checkoutSessionId: session.id,
                updatedAt: Date.now(),
            },
            ...(acceptedLegal
                ? {
                    legal: {
                        ...(workspaceData.legal || {}),
                        acceptedTermsAt: Date.now(),
                        acceptedPrivacyAt: Date.now(),
                        acceptedByUid: uid,
                        acceptedByEmail: userEmail || undefined,
                    },
                }
                : {}),
        }, { merge: true });

        return NextResponse.json({ url: session.url });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unable to create checkout session.";
        console.error("create-checkout-session error:", error);
        await sendOpsAlert({
            source: "api/billing/create-checkout-session",
            message: "Unhandled exception while creating checkout session.",
            level: "error",
            workspaceId: typeof alertContext.workspaceId === "string" ? alertContext.workspaceId : undefined,
            context: {
                ...alertContext,
                error: serializeError(error),
            },
        });
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
