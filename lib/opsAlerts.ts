type OpsAlertLevel = "info" | "warning" | "error";

type OpsAlertInput = {
    source: string;
    message: string;
    level?: OpsAlertLevel;
    workspaceId?: string;
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
    const normalizedWorkspaceId =
        input.workspaceId && input.workspaceId !== "missing" ? input.workspaceId : undefined;
    const payload = {
        app: "app-financeiro-2.0",
        env: getAppEnvironment(),
        createdAt: Date.now(),
        timestamp: new Date().toISOString(),
        level: input.level || "error",
        source: input.source,
        message: input.message,
        workspaceId: normalizedWorkspaceId,
        context: input.context || {},
    };

    let webhookDispatched = false;
    let firestoreStored = false;

    try {
        if (webhookUrl) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            try {
                await fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                    cache: "no-store",
                });
                webhookDispatched = true;
            } finally {
                clearTimeout(timeout);
            }
        }
    } catch (dispatchError) {
        console.error("ops alert webhook dispatch failed:", dispatchError);
    }

    if (normalizedWorkspaceId) {
        try {
            const { getAdminDb } = await import("@/lib/firebaseAdmin");
            const db = getAdminDb();
            await db.collection("workspaces").doc(normalizedWorkspaceId).collection("ops_alerts").add({
                ...payload,
                delivery: {
                    webhook: webhookDispatched,
                    firestore: true,
                },
            });
            firestoreStored = true;
        } catch (storeError) {
            console.error("ops alert firestore storage failed:", storeError);
        }
    }

    return webhookDispatched || firestoreStored;
}
