import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
    }

    if (!stripeClient) {
        stripeClient = new Stripe(secretKey);
    }

    return stripeClient;
}

export function getAppUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
}

