# Operação de Produção (App Financeiro 2.0)

Última atualização: 13 de fevereiro de 2026

## 1) Alertas de falha (Vercel + Stripe)

### Vercel
- Acesse: `Vercel > Projeto > Settings > Integrations > Alerts`
- Configure alertas para:
  - Deploy failed
  - Deployment canceled
  - High error rate (quando disponível no plano)
- Destino recomendado:
  - Email operacional
  - Slack/Discord/Webhook de operações

### Stripe
- Acesse: `Stripe Dashboard > Developers > Webhooks > Endpoint production`
- Confirme endpoint:
  - `https://app-financeiro-2.vercel.app/api/billing/webhook`
- Habilite os eventos:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Em `Webhook endpoint`, ative notificações de falha de entrega e configure retry monitorado.

## 2) Segregação de segredos (produção vs teste)

## Regras práticas
- Nunca usar chave `sk_test` em `Production`.
- Nunca usar `STRIPE_WEBHOOK_SECRET` de teste em `Production`.
- Separar DSN/chaves por ambiente no Vercel (`Production`, `Preview`, `Development`).

## Matriz recomendada de variáveis
- `Production`
  - `STRIPE_SECRET_KEY=sk_live_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_live_...`
  - `STRIPE_PRICE_ID_MONTHLY=price_live_...`
  - `STRIPE_PRICE_ID_YEARLY=price_live_...`
  - `SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `SENTRY_ENVIRONMENT=production`
- `Preview`
  - `STRIPE_SECRET_KEY=sk_test_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_test_...`
  - `STRIPE_PRICE_ID_MONTHLY=price_test_...`
  - `STRIPE_PRICE_ID_YEARLY=price_test_...`
  - `SENTRY_DSN`
  - `NEXT_PUBLIC_SENTRY_DSN`
  - `SENTRY_ENVIRONMENT=preview`
- `Development`
  - mesmas credenciais de teste
  - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
  - `APP_URL=http://localhost:3000`

## 3) Revisão de segurança Firestore por coleção

## Coleções raiz
- `workspaces`
  - leitura/escrita apenas para usuários membros do workspace.
  - somente `ownerId` pode alterar billing e convites.
- `users`
  - usuário pode ler/escrever somente o próprio perfil (`request.auth.uid == resource.id`).

## Subcoleções do workspace
- `accounts`, `credit_cards`, `transactions`, `financial_notes`, `recurring_bills`, `bill_payments`, `card_statements`
  - somente membros do workspace.
- `ops_alerts`
  - leitura somente `ownerId` (ou admins internos).
  - escrita apenas server-side (Firebase Admin / backend).
- `audit_logs`
  - leitura somente `ownerId` (ou admins internos).
  - escrita preferencialmente server-side; se client-side, validar membro autenticado e campos mínimos.

## Checklist de validação
- Confirmar que nenhuma regra permite `allow read, write: if true`.
- Confirmar que acesso entre workspaces está bloqueado.
- Confirmar que usuário deslogado não lê nada sensível.
- Testar com 2 usuários de workspaces diferentes.
- Testar owner vs membro comum (ações de billing/admin).
