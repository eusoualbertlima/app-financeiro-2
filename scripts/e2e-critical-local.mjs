import fs from "fs";
import http from "http";
import path from "path";
import { spawn } from "child_process";

const DEFAULT_STORAGE_STATE = "e2e/.auth/user.json";
const DEFAULT_PORT = 3100;

function resolvePath(inputPath) {
    if (path.isAbsolute(inputPath)) return inputPath;
    return path.resolve(process.cwd(), inputPath);
}

function runNode(args, options = {}) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, args, {
            stdio: "inherit",
            env: process.env,
            shell: false,
            ...options,
        });
        child.on("exit", (code) => resolve(code ?? 1));
    });
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

async function ensureBuildIfNeeded() {
    if (process.env.E2E_SKIP_BUILD === "true") {
        return true;
    }

    const buildIdPath = path.resolve(process.cwd(), ".next", "BUILD_ID");
    if (fs.existsSync(buildIdPath)) {
        return true;
    }

    console.log("[E2E] Build nao encontrado. Executando next build...");
    const buildExit = await runNode(["node_modules/next/dist/bin/next", "build"]);
    return buildExit === 0;
}

async function main() {
    const storageStateInput = process.env.E2E_STORAGE_STATE || DEFAULT_STORAGE_STATE;
    const storageStatePath = resolvePath(storageStateInput);

    if (!fs.existsSync(storageStatePath)) {
        console.error(`[E2E] Storage state nao encontrado: ${storageStatePath}`);
        console.error("[E2E] Gere primeiro com: npm run e2e:auth:record");
        process.exit(1);
        return;
    }

    const hasExternalBaseUrl = Boolean(process.env.E2E_BASE_URL);
    const port = Number(process.env.E2E_PORT || DEFAULT_PORT);
    const baseURL = process.env.E2E_BASE_URL || `http://localhost:${port}`;

    let serverProcess = null;

    try {
        if (!hasExternalBaseUrl) {
            const buildOk = await ensureBuildIfNeeded();
            if (!buildOk) {
                process.exit(1);
                return;
            }

            console.log(`[E2E] Subindo servidor local em ${baseURL}...`);
            serverProcess = spawn(
                process.execPath,
                ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
                {
                    stdio: "inherit",
                    env: process.env,
                    shell: false,
                }
            );

            await waitForServer(baseURL, 90_000);
        }

        console.log("[E2E] Executando fluxos criticos autenticados...");
        const testExitCode = await runNode(
            [
                "node_modules/@playwright/test/cli.js",
                "test",
                "e2e/critical-authenticated.spec.ts",
                "--project=critical-chromium",
            ],
            {
                env: {
                    ...process.env,
                    E2E_BASE_URL: baseURL,
                    E2E_STORAGE_STATE: storageStatePath,
                },
            }
        );

        process.exit(testExitCode);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[E2E] Falha na execucao critica: ${message}`);
        process.exit(1);
    } finally {
        killServer(serverProcess);
    }
}

await main();
