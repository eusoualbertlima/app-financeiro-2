import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

export type WorkspaceAuditAction =
    | "create"
    | "update"
    | "delete"
    | "mark_paid"
    | "mark_pending"
    | "mark_skipped"
    | "transfer"
    | "reconcile";

function normalizeValue(value: unknown): JsonValue {
    if (value === null || value === undefined) return null;

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map((item) => normalizeValue(item));
    }

    if (typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const normalized: Record<string, JsonValue> = {};
        Object.entries(obj).forEach(([key, nestedValue]) => {
            normalized[key] = normalizeValue(nestedValue);
        });
        return normalized;
    }

    return String(value);
}

export async function recordWorkspaceAuditEvent(input: {
    workspaceId?: string | null;
    actorUid?: string | null;
    action: WorkspaceAuditAction;
    entity: string;
    entityId?: string | null;
    summary?: string;
    payload?: Record<string, unknown>;
}) {
    const workspaceId = input.workspaceId?.trim();
    if (!workspaceId) return false;

    try {
        await addDoc(collection(db, `workspaces/${workspaceId}/audit_logs`), {
            action: input.action,
            entity: input.entity,
            entityId: input.entityId || null,
            actorUid: input.actorUid || null,
            summary: input.summary || "",
            payload: normalizeValue(input.payload || {}) as Record<string, JsonValue>,
            createdAt: Date.now(),
        });
        return true;
    } catch (error) {
        console.error("audit log write failed:", error);
        return false;
    }
}
