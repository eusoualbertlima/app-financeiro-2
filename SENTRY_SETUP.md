# Sentry Setup (App Financeiro 2.0)

## O que já está implementado no código
- Inicialização de Sentry no client (`instrumentation-client.ts`)
- Inicialização no server/edge (`instrumentation.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`)
- Captura de erro global no App Router (`app/global-error.tsx`)
- Integração no build Next (`next.config.mjs`)

## Variáveis de ambiente (Vercel)
Obrigatórias para capturar erros:
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`

Recomendadas:
- `SENTRY_ENVIRONMENT=production`
- `SENTRY_TRACES_SAMPLE_RATE=0.1`
- `SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0`
- `SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1`

Opcional (upload de source maps):
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

## Verificação rápida
1. Faça deploy com as variáveis.
2. Abra a aplicação.
3. Gere um erro de teste manualmente (por exemplo, em ambiente de preview).
4. Verifique o evento no dashboard do Sentry.

## Observação
Sem DSN configurado, o app continua funcionando normalmente e Sentry fica desativado.
