import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const useExternalBaseUrl = Boolean(process.env.E2E_BASE_URL);
const storageState = process.env.E2E_STORAGE_STATE;
const devServerCommand =
    process.platform === "win32"
        ? "C:\\Progra~1\\nodejs\\npm.cmd run dev"
        : "npm run dev";

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    retries: process.env.CI ? 1 : 0,
    reporter: [
        ["list"],
        ["html", { open: "never" }],
    ],
    use: {
        baseURL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
    },
    projects: [
        {
            name: "public-chromium",
            testMatch: /.*public-smoke\.spec\.ts/,
            use: {
                ...devices["Desktop Chrome"],
            },
        },
        {
            name: "critical-chromium",
            testMatch: /.*critical-authenticated\.spec\.ts/,
            use: {
                ...devices["Desktop Chrome"],
                storageState: storageState || undefined,
            },
        },
    ],
    webServer: useExternalBaseUrl
        ? undefined
        : {
              command: devServerCommand,
              url: "http://127.0.0.1:3000",
              reuseExistingServer: !process.env.CI,
              timeout: 120_000,
          },
});
