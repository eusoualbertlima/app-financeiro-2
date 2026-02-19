# Go-Live Comercial (App Financeiro 2.0)

Última atualização: 13 de fevereiro de 2026

## 1) Mínimo para vender (feito)
- [x] Build de produção estável (`npm run build`)
- [x] Fluxo de assinatura Stripe (checkout + portal + webhook)
- [x] Bloqueio de acesso por assinatura no dashboard
- [x] Páginas legais básicas (`/termos` e `/privacidade`)
- [x] Aceite de termos/política antes de iniciar checkout
- [x] CI básico (TypeScript + build)
- [x] Alertas operacionais por webhook para erros críticos de billing
- [x] Centro interno de alertas no dashboard (`/dashboard/alertas`)

## 2) Alta prioridade (próximos passos)
- [x] Implementar monitoramento de erros (Sentry) em client + server (além dos alertas de billing já ativos) (`SENTRY_SETUP.md`)
- [x] Criar rotina/admin de reconciliação de saldos por conta (API `POST /api/admin/reconcile-balances` + ações no painel `/dashboard/admin`)
- [x] Definir política comercial: cancelamento, reembolso e SLA de suporte (`/politica-comercial`)
- [x] Página pública de suporte/contato (`/suporte`)

## 3) Segurança e operação
- [x] Revisar regras de segurança do Firestore por coleção (regras versionadas em `firestore.rules` + guia em `OPERACOES_PRODUCAO.md`)
- [x] Deploy das regras Firestore no projeto de produção (`npm run deploy:firestore:rules`)
- [x] Centralizar política de acesso em produção (arquivo único: `lib/accessPolicy.ts`)
- [ ] Ativar alertas de falha de deploy/webhook (Vercel + Stripe) (guia em `OPERACOES_PRODUCAO.md`)
- [ ] Revisar gestão de segredos no Vercel (produção vs teste) (matriz em `OPERACOES_PRODUCAO.md`)
- [ ] Executar checklist pós-deploy de acesso (owner + membro + usuário externo) em toda release (`OPERACOES_PRODUCAO.md`)

## 4) Produto e retenção
- [x] Onboarding guiado para primeiro uso (componente `OnboardingGuide` no dashboard)
- [x] Registro de auditoria para ações críticas (editar/excluir/marcações em coleções financeiras em `workspaces/{id}/audit_logs`)
- [x] Exportação CSV para lançamentos/contas/notas

## 5) Definição de pronto para escala
- [ ] Testes E2E dos fluxos críticos (suite Playwright criada em `e2e/`; falta executar fluxo autenticado com `E2E_STORAGE_STATE`):
  - login
  - lançamento pago/pendente
  - contas fixas (pagar/desfazer)
  - assinatura (checkout/webhook/portal)
- [x] Observabilidade mínima em produção com alertas acionáveis (Sentry com DSN/env configurado e evento de teste validado em produção)
- [x] Processo de suporte com tempo de resposta definido (`/suporte`)
