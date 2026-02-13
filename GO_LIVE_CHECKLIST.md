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
- [ ] Implementar monitoramento de erros (Sentry) em client + server (além dos alertas de billing já ativos)
- [ ] Criar rotina/admin de reconciliação de saldos por conta
- [x] Definir política comercial: cancelamento, reembolso e SLA de suporte (`/politica-comercial`)
- [x] Página pública de suporte/contato (`/suporte`)

## 3) Segurança e operação
- [ ] Revisar regras de segurança do Firestore por coleção
- [ ] Ativar alertas de falha de deploy/webhook (Vercel + Stripe)
- [ ] Revisar gestão de segredos no Vercel (produção vs teste)

## 4) Produto e retenção
- [ ] Onboarding guiado para primeiro uso
- [ ] Registro de auditoria para ações críticas (editar/excluir financeiro)
- [ ] Exportação CSV para lançamentos/contas/notas

## 5) Definição de pronto para escala
- [ ] Testes E2E dos fluxos críticos:
  - login
  - lançamento pago/pendente
  - contas fixas (pagar/desfazer)
  - assinatura (checkout/webhook/portal)
- [ ] Observabilidade mínima em produção com alertas acionáveis
- [x] Processo de suporte com tempo de resposta definido (`/suporte`)
