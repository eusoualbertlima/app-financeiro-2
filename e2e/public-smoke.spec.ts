import { expect, test } from "@playwright/test";

test.describe("Public smoke", () => {
    test.setTimeout(120_000);

    test("home and pricing pages are reachable", async ({ page }) => {
        let lastError: unknown = null;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
                await page.goto("/", { waitUntil: "domcontentloaded" });
                lastError = null;
                break;
            } catch (error) {
                lastError = error;
            }
        }
        if (lastError) throw lastError;

        await expect(page.getByRole("heading", { name: "App Financeiro 2.0" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Ver Planos" })).toBeVisible();

        await page.getByRole("link", { name: "Ver Planos" }).click();

        await expect(page).toHaveURL(/\/pricing$/);
        await expect(page.getByRole("heading", { name: "Escolha seu plano" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Suporte" })).toBeVisible();
    });
});
