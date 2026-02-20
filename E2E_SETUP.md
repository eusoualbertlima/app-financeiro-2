# E2E Setup (Playwright)

Última atualização: 20 de fevereiro de 2026

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

Use o utilitário local para autenticar manualmente (Google) e salvar o estado:

```bash
npm run e2e:auth:record
```

Por padrão:

- sobe servidor local automaticamente em `http://localhost:3100`
- salva em `e2e/.auth/user.json`

Você pode sobrescrever:

```bash
$env:E2E_BASE_URL="https://app-financeiro-2.vercel.app"
$env:E2E_STORAGE_STATE="e2e/.auth/user.json"
npm run e2e:auth:record
```

Se o Google bloquear com "Esse navegador ou app pode não ser seguro", tente forçar canal Chrome:

```bash
$env:E2E_AUTH_BROWSER_CHANNEL="chrome"
npm run e2e:auth:record
```

Alternativa recomendada para E2E (sem Google popup): Email/Senha

```bash
$env:E2E_TEST_EMAIL="seu-teste@exemplo.com"
$env:E2E_TEST_PASSWORD="sua-senha"
npm run e2e:auth:record
```

Isso autentica direto no Firebase Auth e salva o `storageState` com IndexedDB.

## 4) Rodar fluxos críticos autenticados

Execução local automática (faz build se necessário, sobe `next start` e roda os testes):

```bash
npm run e2e:critical:local
```

Usando base URL externa:

```bash
$env:E2E_BASE_URL="https://app-financeiro-2.vercel.app"
$env:E2E_STORAGE_STATE="e2e/.auth/user.json"
npm run e2e:critical
```

## 5) Fluxos cobertos

- sessão autenticada e acesso ao dashboard
- lançamentos: criar pendente, marcar pago e excluir
- contas fixas: criar, pagar, desfazer e excluir
- assinatura: presença da seção de assinatura em configurações

## Observações

- `e2e/.auth/user.json` contém dados sensíveis de sessão e está ignorado no git.
- Em CI, os testes críticos só devem rodar com segredo de storage state controlado.
- Os scripts npm chamam Playwright via `node` direto para evitar falhas de wrapper no Windows (`"node" não é reconhecido`).
