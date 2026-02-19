import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUserFromRequest } from "@/lib/serverAuth";
import { getAppUrl, getStripe } from "@/lib/stripe";
import { getDefaultTrialEndsAt } from "@/lib/billing";
import { sendOpsAlert, serializeError } from "@/lib/opsAlerts";
import type { Workspace } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BillingPlan = "monthly" | "yearly";

type CheckoutBody = {
    workspaceId?: string;
    plan?: BillingPlan;
    acceptedLegal?: boolean;
};

function getConfiguredStripePriceToken(plan: BillingPlan) {
    if (plan === "yearly") {
        return process.env.STRIPE_PRICE_ID_YEARLY;
    }
    return process.env.STRIPE_PRICE_ID_MONTHLY;
}

function getPriceEnvLabel(plan: BillingPlan) {
    return plan === "yearly" ? "STRIPE_PRICE_ID_YEARLY" : "STRIPE_PRICE_ID_MONTHLY";
}

function isRecurringPriceCompatibleWithPlan(
    recurring: { interval: string; interval_count: number } | null | undefined,
    plan: BillingPlan
) {
    if (!recurring) return false;
    if (plan === "monthly") {
        return recurring.interval === "month" && recurring.interval_count === 1;
    }
    return (
        (recurring.interval === "year" && recurring.interval_count === 1)
        || (recurring.interval === "month" && recurring.interval_count === 12)
    );
}

function buildRecurringConfigForPlan(plan: BillingPlan) {
    if (plan === "monthly") {
        return { interval: "month" as const, interval_count: 1 };
    }
    return { interval: "year" as const, interval_count: 1 };
}

type OneTimeBasePrice = {
    id: string;
    active: boolean;
    type: string;
    product: string | { id: string } | null;
    unit_amount: number | null;
    currency: string;
};

function normalizeConfiguredToken(value?: string) {
    const normalized = value?.trim();
    return normalized || null;
}

async function findRecurringPriceForProduct(
    stripe: ReturnType<typeof getStripe>,
    productId: string,
    plan: BillingPlan,
    preferredCurrency?: string
) {
    const prices = await stripe.prices.list({
        product: productId,
        active: true,
        type: "recurring",
        limit: 100,
    });

    const sameCurrency = preferredCurrency
        ? prices.data.filter((price) => price.currency === preferredCurrency)
        : prices.data;
    const matched = sameCurrency.find((price) => isRecurringPriceCompatibleWithPlan(price.recurring, plan))
        || prices.data.find((price) => isRecurringPriceCompatibleWithPlan(price.recurring, plan));

    return matched || null;
}

async function findOneTimePriceForProduct(
    stripe: ReturnType<typeof getStripe>,
    productId: string,
    preferredCurrency?: string
) {
    const prices = await stripe.prices.list({
        product: productId,
        active: true,
        type: "one_time",
        limit: 100,
    });

    if (!prices.data.length) return null;

    const byPreferredCurrency = preferredCurrency
        ? prices.data.find((price) => price.currency === preferredCurrency)
        : null;
    if (byPreferredCurrency) return byPreferredCurrency;

    const byBRL = prices.data.find((price) => price.currency === "brl");
    if (byBRL) return byBRL;

    return prices.data[0] || null;
}

async function autoCreateRecurringPriceFromOneTime(
    stripe: ReturnType<typeof getStripe>,
    basePrice: OneTimeBasePrice,
    plan: BillingPlan
) {
    if (!basePrice.active || basePrice.type !== "one_time") {
        return null;
    }

    const productId = typeof basePrice.product === "string"
        ? basePrice.product
        : basePrice.product?.id;
    if (!productId || basePrice.unit_amount === null) {
        return null;
    }

    const recurring = buildRecurringConfigForPlan(plan);
    return stripe.prices.create({
        product: productId,
        currency: basePrice.currency,
        unit_amount: basePrice.unit_amount,
        recurring,
        nickname: `Auto ${plan} from ${basePrice.id}`,
        metadata: {
            source: "auto_fix_non_recurring_price",
            original_price_id: basePrice.id,
            target_plan: plan,
        },
    });
}

async function resolveCheckoutPriceId(
    stripe: ReturnType<typeof getStripe>,
    plan: BillingPlan
) {
    const configuredToken = normalizeConfiguredToken(getConfiguredStripePriceToken(plan));
    if (!configuredToken) {
        return {
            priceId: null,
            warning: null as string | null,
            error: `Missing Stripe price env for ${plan}.`,
        };
    }

    if (configuredToken.startsWith("price_")) {
        try {
            const configuredPrice = await stripe.prices.retrieve(configuredToken);
            const isCorrectRecurring = Boolean(
                configuredPrice.active
                && configuredPrice.recurring
                && isRecurringPriceCompatibleWithPlan(configuredPrice.recurring, plan)
            );

            if (isCorrectRecurring) {
                return {
                    priceId: configuredToken,
                    warning: null as string | null,
                    error: null as string | null,
                };
            }

            const productId = typeof configuredPrice.product === "string"
                ? configuredPrice.product
                : configuredPrice.product?.id;
            if (!productId) {
                return {
                    priceId: null,
                    warning: null as string | null,
                    error: `${getPriceEnvLabel(plan)} (${configuredToken}) não é recorrente para plano ${plan}. Configure um price_ recorrente compatível.`,
                };
            }

            const fallbackPrice = await findRecurringPriceForProduct(
                stripe,
                productId,
                plan,
                configuredPrice.currency
            );
            if (!fallbackPrice) {
                const autoCreatedRecurringPrice = await autoCreateRecurringPriceFromOneTime(
                    stripe,
                    configuredPrice,
                    plan
                );
                if (autoCreatedRecurringPrice) {
                    return {
                        priceId: autoCreatedRecurringPrice.id,
                        warning: `${getPriceEnvLabel(plan)} estava em ${configuredToken} (não recorrente/incompatível). Criado preço recorrente automático ${autoCreatedRecurringPrice.id}.`,
                        error: null as string | null,
                    };
                }

                return {
                    priceId: null,
                    warning: null as string | null,
                    error: `Price ${configuredToken} não é recorrente compatível com ${plan} e o produto ${productId} não possui preço recorrente ativo compatível.`,
                };
            }

            return {
                priceId: fallbackPrice.id,
                warning: `${getPriceEnvLabel(plan)} estava em ${configuredToken} (não recorrente/incompatível). Fallback automático para ${fallbackPrice.id}.`,
                error: null as string | null,
            };
        } catch {
            return {
                priceId: null,
                warning: null as string | null,
                error: `${getPriceEnvLabel(plan)} aponta para price inválido (${configuredToken}).`,
            };
        }
    }

    if (!configuredToken.startsWith("prod_")) {
        return {
            priceId: null,
            warning: null as string | null,
            error: `${getPriceEnvLabel(plan)} must be a Stripe price id (price_...) ou product id (prod_...).`,
        };
    }

    const matchedPrice = await findRecurringPriceForProduct(stripe, configuredToken, plan);
    if (!matchedPrice) {
        const baseOneTimePrice = await findOneTimePriceForProduct(stripe, configuredToken);
        if (baseOneTimePrice) {
            const autoCreatedRecurringPrice = await autoCreateRecurringPriceFromOneTime(
                stripe,
                baseOneTimePrice,
                plan
            );
            if (autoCreatedRecurringPrice) {
                return {
                    priceId: autoCreatedRecurringPrice.id,
                    warning: `${getPriceEnvLabel(plan)} está em product id (${configuredToken}) sem recorrente compatível. Criado preço recorrente automático ${autoCreatedRecurringPrice.id}.`,
                    error: null as string | null,
                };
            }
        }

        return {
            priceId: null,
            warning: null as string | null,
            error: `Product ${configuredToken} has no active recurring price compatible with ${plan}. Configure ${getPriceEnvLabel(plan)} com um price_ recorrente.`,
        };
    }

    return {
        priceId: matchedPrice.id,
        warning: `${getPriceEnvLabel(plan)} is configured with product id (${configuredToken}). Resolved fallback price ${matchedPrice.id}.`,
        error: null as string | null,
    };
}

export async function POST(request: NextRequest) {
    let alertContext: Record<string, unknown> = {};

    try {
        const decodedUser = await requireUserFromRequest(request);
        const uid = decodedUser.uid;
        const userEmail = decodedUser.email;
        const body = (await request.json()) as CheckoutBody;
        const workspaceId = body.workspaceId;
        const plan: BillingPlan = body.plan === "yearly" ? "yearly" : "monthly";
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

        const stripe = getStripe();
        const priceResolution = await resolveCheckoutPriceId(stripe, plan);
        if (!priceResolution.priceId) {
            await sendOpsAlert({
                source: "api/billing/create-checkout-session",
                message: priceResolution.error || `Missing Stripe price env for ${plan}.`,
                level: "error",
                workspaceId: workspaceId || undefined,
                context: alertContext,
            });
            return NextResponse.json(
                { error: priceResolution.error || `Missing Stripe price env for ${plan}.` },
                { status: 500 }
            );
        }
        const priceId = priceResolution.priceId;
        if (priceResolution.warning) {
            await sendOpsAlert({
                source: "api/billing/create-checkout-session",
                message: priceResolution.warning,
                level: "warning",
                workspaceId: workspaceId || undefined,
                context: {
                    ...alertContext,
                    resolvedPriceId: priceId,
                },
            });
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
