# Billing Setup (Stripe + Firebase)

## 1. Environment variables
Copy `.env.example` to `.env.local` and fill all values.

Required:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_MONTHLY`
- `STRIPE_PRICE_ID_YEARLY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `NEXT_PUBLIC_APP_URL`

## 2. Stripe products/prices
Create 2 recurring prices in Stripe:
- Monthly plan -> put ID in `STRIPE_PRICE_ID_MONTHLY`
- Yearly plan -> put ID in `STRIPE_PRICE_ID_YEARLY`

## 3. Stripe webhook
Create webhook endpoint:
- Local: `http://localhost:3000/api/billing/webhook`
- Production: `https://YOUR_DOMAIN/api/billing/webhook`

Listen to events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Set webhook signing secret in `STRIPE_WEBHOOK_SECRET`.

## 4. Trial and access
Each new workspace starts with 7-day trial (`billing.status = trialing`).
Access is allowed only for:
- `trialing`
- `active`

All other statuses are redirected to `/checkout`.

