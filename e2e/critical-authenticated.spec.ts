import { expect, test } from "@playwright/test";

test.describe("Critical authenticated flows", () => {
    test.skip(
        !process.env.E2E_STORAGE_STATE,
        "Defina E2E_STORAGE_STATE com um storage state autenticado para executar os fluxos críticos."
    );

    test("login session keeps dashboard accessible", async ({ page }) => {
        await page.goto("/dashboard");
        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    });

    test("transactions: create pending, mark paid and delete", async ({ page }) => {
        const description = `E2E Lancamento ${Date.now()}`;

        await page.goto("/dashboard/lancamentos");
        await expect(page.getByRole("heading", { name: "Lançamentos" })).toBeVisible();

        await page.getByRole("button", { name: "Novo Lançamento" }).click();
        await page.getByLabel("Descrição").fill(description);

        const modal = page.locator("form").last();
        const amountInput = modal.locator("input[type='text']").first();
        await amountInput.fill("123,45");

        await modal.getByRole("button", { name: /^Salvar$/ }).click();

        const row = page
            .locator("div.divide-y > div")
            .filter({ hasText: description })
            .first();

        await expect(row).toBeVisible();
        await row.getByRole("button", { name: /Pendente/i }).click();
        await expect(row.getByText("Pago")).toBeVisible();

        page.once("dialog", async (dialog) => {
            await dialog.accept();
        });
        await row.hover();
        await row.locator("button[title='Excluir']").click({ force: true });

        await expect(page.locator("div.divide-y > div").filter({ hasText: description })).toHaveCount(0);
    });

    test("fixed bills: create, pay, undo and remove", async ({ page }) => {
        const billName = `E2E Conta Fixa ${Date.now()}`;

        await page.goto("/dashboard/contas-fixas");
        await expect(page.getByRole("heading", { name: "Contas Fixas" })).toBeVisible();

        await page.getByRole("button", { name: "Nova Conta Fixa" }).click();

        const modal = page.locator("form").last();
        await page.getByLabel("Nome da Conta").fill(billName);
        const amountInput = modal.locator("input[type='text']").first();
        await amountInput.fill("89,90");
        await page.getByLabel("Dia Vencimento").fill("15");
        await modal.getByRole("button", { name: "Criar Conta Fixa" }).click();

        const paymentRow = page.locator("div").filter({ hasText: billName }).filter({ hasText: /Vence dia/ }).first();
        await expect(paymentRow).toBeVisible();

        await paymentRow.locator("button[title='Marcar como pago']").click();
        await page.getByRole("button", { name: "Confirmar" }).click();

        await expect(paymentRow.getByText("Pago")).toBeVisible();

        const undoButton = paymentRow.locator(
            "button[title='Desfazer pagamento'], button[title='Reativar cobrança']"
        );
        await undoButton.click();
        await expect(paymentRow.getByText(/Pendente|Atrasado/)).toBeVisible();

        const manageRow = page
            .locator("div")
            .filter({ hasText: billName })
            .filter({ hasText: /Dia 15/ })
            .last();

        page.once("dialog", async (dialog) => {
            await dialog.accept();
        });
        await manageRow.locator("button").last().click();

        await expect(page.locator("div").filter({ hasText: billName })).toHaveCount(0);
    });

    test("subscription screen remains accessible from settings", async ({ page }) => {
        await page.goto("/dashboard/configuracoes");
        await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
        await expect(page.getByText("Assinatura")).toBeVisible();
        await expect(page.getByRole("button", { name: "Assinar / Reativar" })).toBeVisible();
    });
});
