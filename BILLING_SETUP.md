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

## 1.1 Quick config check
After setting `.env.local`, run the app and open:
- `GET /api/billing/health`

Expected:
- `ok: true`
- `missingEnv: []`
- `firebaseAdminReady: true`

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

Tip: if Stripe CLI is not installed, configure webhook directly in Stripe Dashboard.

## 4. Trial and access
Each new workspace starts with 7-day trial (`billing.status = trialing`).
Access is allowed only for:
- `trialing`
- `active`

All other statuses are redirected to `/checkout`.

## 5. Billing permissions
Only the `workspace.ownerId` can:
- create checkout sessions
- open the Stripe billing portal

Members keep product access according to workspace billing status, but cannot change billing.
