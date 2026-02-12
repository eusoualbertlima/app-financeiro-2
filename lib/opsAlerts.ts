type OpsAlertLevel = "info" | "warning" | "error";

type OpsAlertInput = {
    source: string;
    message: string;
    level?: OpsAlertLevel;
    context?: Record<string, unknown>;
};

function getAppEnvironment() {
    return process.env.APP_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";
}

export function serializeError(error: unknown) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack?.split("\n").slice(0, 8).join("\n"),
        };
    }

    return { message: String(error) };
}

export async function sendOpsAlert(input: OpsAlertInput) {
    const webhookUrl = process.env.OPS_ALERT_WEBHOOK_URL;
    if (!webhookUrl) return false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const payload = {
            app: "app-financeiro-2.0",
            env: getAppEnvironment(),
            timestamp: new Date().toISOString(),
            level: input.level || "error",
            source: input.source,
            message: input.message,
            context: input.context || {},
        };

        await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
            cache: "no-store",
        });

        return true;
    } catch (dispatchError) {
        console.error("ops alert dispatch failed:", dispatchError);
        return false;
    } finally {
        clearTimeout(timeout);
    }
}
