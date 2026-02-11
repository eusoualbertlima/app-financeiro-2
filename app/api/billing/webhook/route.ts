import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getDefaultTrialEndsAt, toUserSubscriptionStatus } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import type { Workspace, WorkspaceBillingStatus } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanUndefined<T extends Record<string, any>>(obj: T) {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, value]) => value !== undefined)
    ) as Partial<T>;
}

function getPlanFromPriceId(priceId?: string): "monthly" | "yearly" | undefined {
    if (!priceId) return undefined;
    if (priceId === process.env.STRIPE_PRICE_ID_MONTHLY) return "monthly";
    if (priceId === process.env.STRIPE_PRICE_ID_YEARLY) return "yearly";
    return undefined;
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): WorkspaceBillingStatus {
    switch (status) {
        case "active":
            return "active";
        case "trialing":
            return "trialing";
        case "past_due":
        case "incomplete":
        case "incomplete_expired":
        case "unpaid":
            return "past_due";
        case "canceled":
            return "canceled";
        default:
            return "inactive";
    }
}

async function syncWorkspaceUsers(workspace: Omit<Workspace, "id">, billingStatus: WorkspaceBillingStatus, plan?: "monthly" | "yearly") {
    const db = getAdminDb();
    const members = workspace.members || [];
    const subscriptionStatus = toUserSubscriptionStatus(billingStatus);

    await Promise.all(
        members.map((uid) =>
            db.collection("users").doc(uid).set(
                cleanUndefined({
                    subscriptionStatus,
                    subscriptionPlan: plan,
                    updatedAt: Date.now(),
                }),
                { merge: true }
            )
        )
    );
}

async function findWorkspaceIdBySubscription(subscription: Stripe.Subscription) {
    const metadataWorkspaceId = subscription.metadata?.workspaceId;
    if (metadataWorkspaceId) return metadataWorkspaceId;

    const db = getAdminDb();

    const bySubscription = await db
        .collection("workspaces")
        .where("billing.stripeSubscriptionId", "==", subscription.id)
        .limit(1)
        .get();

    if (!bySubscription.empty) {
        return bySubscription.docs[0].id;
    }

    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    if (!customerId) return null;

    const byCustomer = await db
        .collection("workspaces")
        .where("billing.stripeCustomerId", "==", customerId)
        .limit(1)
        .get();

    if (!byCustomer.empty) {
        return byCustomer.docs[0].id;
    }

    return null;
}

async function applySubscriptionToWorkspace(workspaceId: string, subscription: Stripe.Subscription) {
    const db = getAdminDb();
    const workspaceRef = db.collection("workspaces").doc(workspaceId);
    const workspaceSnap = await workspaceRef.get();
    if (!workspaceSnap.exists) return;

    const workspace = workspaceSnap.data() as Omit<Workspace, "id">;
    const currentPriceId = subscription.items.data[0]?.price?.id;
    const plan = getPlanFromPriceId(currentPriceId) || workspace.billing?.plan;
    const billingStatus = mapStripeSubscriptionStatus(subscription.status);
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    const trialEndsAt = workspace.billing?.trialEndsAt || getDefaultTrialEndsAt(workspace.createdAt || Date.now());
    const itemCurrentPeriodEnd = subscription.items.data[0]?.current_period_end;

    await workspaceRef.set({
        billing: cleanUndefined({
            ...workspace.billing,
            status: billingStatus,
            plan,
            trialEndsAt,
            currentPeriodEnd: itemCurrentPeriodEnd ? itemCurrentPeriodEnd * 1000 : undefined,
            cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            stripePriceId: currentPriceId,
            updatedAt: Date.now(),
        }),
    }, { merge: true });

    await syncWorkspaceUsers(workspace, billingStatus, plan);
}

export async function POST(request: NextRequest) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET." }, { status: 500 });
    }

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
        return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
    }

    try {
        const payload = await request.text();
        const stripe = getStripe();
        const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

        if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
            const workspaceId = session.metadata?.workspaceId || session.client_reference_id || null;

            if (subscriptionId) {
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                const targetWorkspaceId = workspaceId || await findWorkspaceIdBySubscription(subscription);
                if (targetWorkspaceId) {
                    await applySubscriptionToWorkspace(targetWorkspaceId, subscription);
                }
            }
        }

        if (
            event.type === "customer.subscription.created"
            || event.type === "customer.subscription.updated"
            || event.type === "customer.subscription.deleted"
        ) {
            const subscription = event.data.object as Stripe.Subscription;
            const workspaceId = await findWorkspaceIdBySubscription(subscription);
            if (workspaceId) {
                await applySubscriptionToWorkspace(workspaceId, subscription);
            }
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error("Stripe webhook error:", error);
        return NextResponse.json(
            { error: error?.message || "Webhook handler failed." },
            { status: 400 }
        );
    }
}
