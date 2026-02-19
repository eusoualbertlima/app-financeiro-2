# Operação de Produção (App Financeiro 2.0)

Última atualização: 19 de fevereiro de 2026

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
- Cron (retenção comportamental):
  - Arquivo: `vercel.json` com job diário para `/api/behavioral/daily-aging`
  - Configure `CRON_SECRET` (ou `BEHAVIORAL_CRON_SECRET`) no ambiente de produção para proteger a rota.
  - Controle de rollout:
    - `BEHAVIORAL_CITY_ROLLOUT=dev_admin` (somente contas dev-admin)
    - `BEHAVIORAL_CITY_ROLLOUT=all` (libera para todos)
    - `BEHAVIORAL_CITY_ROLLOUT=off` (desliga)
    - Espelhar no client com `NEXT_PUBLIC_BEHAVIORAL_CITY_ROLLOUT`.

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

## 3) Modo de acesso em produção (fixo no código)

- Arquivo-fonte da política: `lib/accessPolicy.ts`
- Modo atual de produção: `workspace_internal_bypass`
- Troca de modo: somente via commit (não depende de toggle no Vercel).

### Modos disponíveis
- `workspace_internal_bypass`
  - libera por billing normal (`active`/`trialing`), ou
  - libera conta `dev-admin`, ou
  - libera membros do workspace quando o dono for `dev-admin`.
- `billing_only`
  - libera apenas por billing normal (`active`/`trialing`).

## 4) Revisão de segurança Firestore por coleção

Arquivo de regras versionado no projeto:
- `firestore.rules`

Deploy recomendado (Firebase CLI autenticado no projeto correto):
```bash
npm run deploy:firestore:rules
```

Antes de deploy, valide no Console se o projeto ativo é `app-financeiro-2-bd953`.
Se não estiver autenticado no CLI:
```bash
npm run firebase:login
npm run firebase:projects
```

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

## 5) Checklist de release de acesso
- Antes do deploy:
  - confirmar `PRODUCTION_ACCESS_MODE` em `lib/accessPolicy.ts`.
  - revisar `DEV_ADMIN_EMAILS` e `NEXT_PUBLIC_DEV_ADMIN_EMAILS` no Vercel.
- Após o deploy:
  - testar login do dono (deve abrir `/dashboard`).
  - testar login de membro do mesmo workspace (deve abrir `/dashboard`).
  - testar login de usuário fora do workspace (não deve ver dados).
  - validar tela `/dashboard/configuracoes` e badge de assinatura.
- Se algo falhar:
  - aplicar rollback imediato para o último commit estável.

## 6) Checklist de retenção comportamental
- Confirmar no workspace a estrutura `behavioralMetrics` com:
  - `consistencyIndex`
  - `lastActionTimestamp`
  - `maturityScore`
  - `structureStage`
- Validar que um lançamento/manual ou ação em contas fixas chama `POST /api/behavioral/recalculate`.
- Validar aging diário com dry-run:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://app-financeiro-2.vercel.app/api/behavioral/daily-aging?dryRun=1&limit=20"
```
