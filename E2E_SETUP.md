# E2E Setup (Playwright)

Última atualização: 13 de fevereiro de 2026

## 1) Instalação

```bash
npm install
npx playwright install chromium
```

## 2) Rodar smoke público (sem login)

```bash
npm run e2e:public
```

## 3) Gerar sessão autenticada para fluxos críticos

Use codegen para autenticar manualmente (Google) e salvar o estado:

```bash
npx playwright codegen https://app-financeiro-2.vercel.app --save-storage=e2e/.auth/user.json
```

Após concluir login e fechar a janela do codegen:

```bash
$env:E2E_BASE_URL="https://app-financeiro-2.vercel.app"
$env:E2E_STORAGE_STATE="e2e/.auth/user.json"
npm run e2e:critical
```

## 4) Fluxos cobertos

- sessão autenticada e acesso ao dashboard
- lançamentos: criar pendente, marcar pago e excluir
- contas fixas: criar, pagar, desfazer e excluir
- assinatura: presença da seção de assinatura em configurações

## Observações

- `e2e/.auth/user.json` contém dados sensíveis de sessão e está ignorado no git.
- Em CI, os testes críticos só devem rodar com segredo de storage state controlado.
