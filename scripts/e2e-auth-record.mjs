import fs from "fs";
import http from "http";
import path from "path";
import readline from "readline";
import { spawn } from "child_process";
import { chromium } from "@playwright/test";

const DEFAULT_PORT = 3100;
const DEFAULT_STORAGE_STATE = "e2e/.auth/user.json";
const FIREBASE_WEB_CONFIG = {
    apiKey: "AIzaSyCb1ZmpRaFGsu9BF-LEykuXdgbP3LubrYQ",
    authDomain: "app-financeiro-2-bd953.firebaseapp.com",
    projectId: "app-financeiro-2-bd953",
    storageBucket: "app-financeiro-2-bd953.firebasestorage.app",
    messagingSenderId: "476140047692",
    appId: "1:476140047692:web:d7740912af2e025066d3e9",
    measurementId: "G-SNKFJE1JFS",
};

function resolvePath(inputPath) {
    if (path.isAbsolute(inputPath)) return inputPath;
    return path.resolve(process.cwd(), inputPath);
}

function waitForEnter(promptMessage) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(promptMessage, () => {
            rl.close();
            resolve();
        });
    });
}

async function signInWithEmailPassword(page, params) {
    const { email, password, baseURL } = params;

    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    try {
        await page.evaluate(
            async ({ firebaseConfig, authEmail, authPassword }) => {
                const appModule = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js");
                const authModule = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js");

                const app = appModule.getApps().length
                    ? appModule.getApps()[0]
                    : appModule.initializeApp(firebaseConfig);
                const auth = authModule.getAuth(app);

                await authModule.setPersistence(auth, authModule.browserLocalPersistence);
                await authModule.signInWithEmailAndPassword(auth, authEmail, authPassword);
            },
            {
                firebaseConfig: FIREBASE_WEB_CONFIG,
                authEmail: email,
                authPassword: password,
            }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("auth/operation-not-allowed")) {
            throw new Error(
                "Email/Senha desativado no Firebase Auth. " +
                "Ative em Authentication > Sign-in method > Email/Password."
            );
        }
        if (message.includes("auth/user-not-found")) {
            throw new Error("Usuario de teste nao encontrado no Firebase Auth.");
        }
        if (message.includes("auth/wrong-password")) {
            throw new Error("Senha incorreta para o usuario de teste.");
        }
        if (message.includes("auth/invalid-login-credentials")) {
            throw new Error(
                "Credenciais invalidas. Verifique email/senha e confirme que o usuario existe " +
                "em Firebase Authentication (provider Email/Senha)."
            );
        }
        if (message.includes("auth/invalid-credential")) {
            throw new Error("Credenciais invalidas para Email/Senha.");
        }
        if (message.includes("auth/invalid-email")) {
            throw new Error("Email invalido. Defina E2E_TEST_EMAIL com um email real.");
        }
        throw error;
    }
    await page.goto("/dashboard", { waitUntil: "networkidle" });
}

function waitForServer(url, timeoutMs = 90_000) {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
        const check = () => {
            const req = http.get(url, (res) => {
                res.resume();
                if (res.statusCode && res.statusCode < 500) {
                    resolve();
                    return;
                }
                retry();
            });

            req.on("error", retry);
            req.setTimeout(3_000, () => {
                req.destroy();
                retry();
            });
        };

        const retry = () => {
            if (Date.now() - startedAt > timeoutMs) {
                reject(new Error(`Timeout aguardando servidor em ${url}`));
                return;
            }
            setTimeout(check, 1_000);
        };

        check();
    });
}

function killServer(serverProcess) {
    if (serverProcess && !serverProcess.killed) {
        serverProcess.kill("SIGTERM");
    }
}

async function main() {
    const hasExternalBaseUrl = Boolean(process.env.E2E_BASE_URL);
    const port = Number(process.env.E2E_PORT || DEFAULT_PORT);
    const baseURL = process.env.E2E_BASE_URL || `http://localhost:${port}`;
    const storageStateInput = process.env.E2E_STORAGE_STATE || DEFAULT_STORAGE_STATE;
    const storageStatePath = resolvePath(storageStateInput);
    const tempStorageStatePath = `${storageStatePath}.tmp`;
    const e2eTestEmail = (process.env.E2E_TEST_EMAIL || "").trim();
    const e2eTestPassword = process.env.E2E_TEST_PASSWORD || "";
    const useEmailPasswordAuth = Boolean(e2eTestEmail && e2eTestPassword);

    fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });

    let browser = null;
    let serverProcess = null;

    try {
        if (!hasExternalBaseUrl) {
            console.log(`[E2E] Subindo servidor local em ${baseURL}...`);
            serverProcess = spawn(
                process.execPath,
                ["node_modules/next/dist/bin/next", "dev", "-p", String(port)],
                {
                    stdio: "inherit",
                    env: process.env,
                    shell: false,
                }
            );
            await waitForServer(baseURL, 90_000);
        }

        const browserChannel = process.env.E2E_AUTH_BROWSER_CHANNEL || "chrome";
        try {
            browser = await chromium.launch({
                channel: browserChannel,
                headless: false,
                // Reduce Google anti-automation false positives in popup auth flows.
                ignoreDefaultArgs: ["--enable-automation"],
                args: ["--disable-blink-features=AutomationControlled"],
            });
        } catch (launchError) {
            console.warn(
                `[E2E] Nao foi possivel iniciar canal '${browserChannel}'. ` +
                "Tentando Chromium padrao..."
            );
            browser = await chromium.launch({
                headless: false,
            });
            if (launchError) {
                const launchMessage = launchError instanceof Error ? launchError.message : String(launchError);
                console.warn(`[E2E] Detalhe do erro no canal '${browserChannel}': ${launchMessage}`);
            }
        }

        const context = await browser.newContext();
        const page = await context.newPage();

        console.log("\n[E2E] Captura de sessao autenticada");
        console.log(`[E2E] Base URL: ${baseURL}`);
        console.log(`[E2E] Arquivo de sessao: ${storageStatePath}\n`);
        if (useEmailPasswordAuth) {
            if (
                e2eTestEmail.toUpperCase() === "SEU_EMAIL_TESTE"
                || e2eTestPassword.toUpperCase() === "SUA_SENHA_TESTE"
            ) {
                throw new Error(
                    "Defina E2E_TEST_EMAIL e E2E_TEST_PASSWORD com credenciais reais de um usuario de teste."
                );
            }
            console.log(`[E2E] Modo: Email/Senha (${e2eTestEmail})`);
            await signInWithEmailPassword(page, {
                email: e2eTestEmail,
                password: e2eTestPassword,
                baseURL,
            });
        } else {
            console.log("[E2E] Modo: Login manual (Google).");
            console.log("1) Faça login com Google normalmente.");
            console.log("2) Abra o dashboard autenticado.");
            console.log("3) Volte para este terminal e pressione ENTER para salvar.\n");

            await page.goto(baseURL, { waitUntil: "domcontentloaded" });
            await waitForEnter("Pressione ENTER para salvar o storage state... ");
        }

        const currentUrl = page.url();
        if (!currentUrl.includes("/dashboard")) {
            console.warn(
                `[E2E] Aviso: URL atual nao parece dashboard (${currentUrl}). ` +
                "A sessao ainda sera salva."
            );
        }

        await context.storageState({ path: tempStorageStatePath, indexedDB: true });
        const savedStateRaw = fs.readFileSync(tempStorageStatePath, "utf-8");
        const savedState = JSON.parse(savedStateRaw);
        const hasStateData = Boolean(
            (Array.isArray(savedState.cookies) && savedState.cookies.length > 0)
            || (Array.isArray(savedState.origins) && savedState.origins.length > 0)
        );

        if (!hasStateData) {
            throw new Error(
                "Storage state vazio. Conclua o login (abra /dashboard autenticado) e tente novamente."
            );
        }

        if (fs.existsSync(storageStatePath)) {
            fs.rmSync(storageStatePath, { force: true });
        }
        fs.renameSync(tempStorageStatePath, storageStatePath);
        console.log(`\n[E2E] Sessao salva com sucesso em: ${storageStatePath}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\n[E2E] Falha ao gerar storage state: ${message}`);
        process.exitCode = 1;
    } finally {
        if (fs.existsSync(tempStorageStatePath)) {
            fs.rmSync(tempStorageStatePath, { force: true });
        }
        if (browser) {
            await browser.close();
        }
        killServer(serverProcess);
    }
}

await main();
