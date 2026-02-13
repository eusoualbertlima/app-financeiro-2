import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUserFromRequest } from "@/lib/serverAuth";
import {
    getServerDevAdminAllowlist,
    hasConfiguredDevAdminAllowlist,
    hasDevAdminAccess,
} from "@/lib/devAdmin";
import type { Account, Transaction, Workspace } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReconcileBody = {
    workspaceId?: string;
    apply?: boolean;
    limit?: number;
};

type ReconcileWorkspaceSummary = {
    workspaceId: string;
    workspaceName: string;
    accountsEvaluated: number;
    accountsWithDrift: number;
    accountsUpdated: number;
    accountsBackfilled: number;
    totalAbsoluteDrift: number;
    driftDetails: Array<{
        accountId: string;
        accountName: string;
        currentBalance: number;
        expectedBalance: number;
        drift: number;
        movementFromTransactions: number;
        startingBalance: number;
        hadStartingBalance: boolean;
    }>;
};

function normalizeErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
}

function mapAdminError(error: unknown) {
    const rawMessage = normalizeErrorMessage(error);
    const message = rawMessage.toLowerCase();

    if (message.includes("missing bearer token")) {
        return { status: 401, error: "Sessao invalida. Faça login novamente." };
    }

    if (
        message.includes("verifyidtoken")
        || message.includes("id token")
        || message.includes("token has expired")
    ) {
        return { status: 401, error: "Token invalido ou expirado. Faça login novamente." };
    }

    if (
        message.includes("default credentials")
        || message.includes("service account")
        || message.includes("private key")
        || message.includes("certificate")
        || message.includes("missing firebase admin env")
    ) {
        return {
            status: 500,
            error: "Firebase Admin não configurado no servidor. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no Vercel.",
        };
    }

    return {
        status: 500,
        error: "Erro ao reconciliar saldos das contas.",
        details: rawMessage,
    };
}

function roundCurrency(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function resolveAccountId(transaction: Partial<Transaction>) {
    if (typeof transaction.paidAccountId === "string" && transaction.paidAccountId) {
        return transaction.paidAccountId;
    }
    if (typeof transaction.accountId === "string" && transaction.accountId) {
        return transaction.accountId;
    }
    return null;
}

function movementFromTransaction(transaction: Partial<Transaction>) {
    if (transaction.status !== "paid") return 0;
    if (typeof transaction.amount !== "number") return 0;

    if (transaction.type === "income") return transaction.amount;
    if (transaction.type === "expense") return -transaction.amount;
    return 0;
}

function normalizeLimit(value: unknown) {
    if (typeof value !== "number" || Number.isNaN(value)) return 200;
    if (value < 1) return 1;
    if (value > 500) return 500;
    return Math.floor(value);
}

export async function POST(request: NextRequest) {
    try {
        const decodedUser = await requireUserFromRequest(request);
        const allowlist = getServerDevAdminAllowlist();

        if (!hasConfiguredDevAdminAllowlist(allowlist)) {
            return NextResponse.json(
                { error: "Configure DEV_ADMIN_EMAILS ou DEV_ADMIN_UIDS no ambiente do servidor." },
                { status: 503 }
            );
        }

        const hasAccess = hasDevAdminAccess({
            uid: decodedUser.uid,
            email: decodedUser.email || null,
            allowlist,
        });

        if (!hasAccess) {
            return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }

        const body = (await request.json().catch(() => ({}))) as ReconcileBody;
        const apply = body.apply === true;
        const targetWorkspaceId = body.workspaceId?.trim();
        const limit = normalizeLimit(body.limit);

        const db = getAdminDb();
        const workspaceSummaries: ReconcileWorkspaceSummary[] = [];

        let workspaceDocs: Array<{ id: string; data: Omit<Workspace, "id"> }> = [];

        if (targetWorkspaceId) {
            const workspaceSnap = await db.collection("workspaces").doc(targetWorkspaceId).get();
            if (!workspaceSnap.exists) {
                return NextResponse.json({ error: "Workspace não encontrado." }, { status: 404 });
            }
            workspaceDocs = [{ id: workspaceSnap.id, data: workspaceSnap.data() as Omit<Workspace, "id"> }];
        } else {
            const snapshot = await db.collection("workspaces").orderBy("createdAt", "desc").limit(limit).get();
            workspaceDocs = snapshot.docs.map((workspaceDoc) => ({
                id: workspaceDoc.id,
                data: workspaceDoc.data() as Omit<Workspace, "id">,
            }));
        }

        let totalAccountsEvaluated = 0;
        let totalAccountsWithDrift = 0;
        let totalAccountsUpdated = 0;
        let totalAccountsBackfilled = 0;
        let totalAbsoluteDrift = 0;

        for (const workspaceDoc of workspaceDocs) {
            const workspaceId = workspaceDoc.id;
            const workspaceName = workspaceDoc.data.name || "Workspace sem nome";
            const workspaceRef = db.collection("workspaces").doc(workspaceId);

            const [accountsSnapshot, paidTransactionsSnapshot] = await Promise.all([
                workspaceRef.collection("accounts").get(),
                workspaceRef.collection("transactions").where("status", "==", "paid").get(),
            ]);

            if (accountsSnapshot.empty) continue;

            const movementByAccount = new Map<string, number>();
            paidTransactionsSnapshot.docs.forEach((transactionDoc) => {
                const transaction = transactionDoc.data() as Partial<Transaction>;
                const accountId = resolveAccountId(transaction);
                if (!accountId) return;

                const movement = movementFromTransaction(transaction);
                if (movement === 0) return;

                movementByAccount.set(accountId, roundCurrency((movementByAccount.get(accountId) || 0) + movement));
            });

            const summary: ReconcileWorkspaceSummary = {
                workspaceId,
                workspaceName,
                accountsEvaluated: 0,
                accountsWithDrift: 0,
                accountsUpdated: 0,
                accountsBackfilled: 0,
                totalAbsoluteDrift: 0,
                driftDetails: [],
            };

            const now = Date.now();
            const writePromises: Promise<unknown>[] = [];

            accountsSnapshot.docs.forEach((accountDoc) => {
                const account = accountDoc.data() as Partial<Account>;
                const currentBalance = roundCurrency(typeof account.balance === "number" ? account.balance : 0);
                const movement = roundCurrency(movementByAccount.get(accountDoc.id) || 0);
                const hadStartingBalance = typeof account.startingBalance === "number";
                const startingBalance = roundCurrency(
                    hadStartingBalance
                        ? (account.startingBalance as number)
                        : (currentBalance - movement)
                );

                const expectedBalance = roundCurrency(startingBalance + movement);
                const drift = roundCurrency(expectedBalance - currentBalance);
                const hasDrift = Math.abs(drift) >= 0.01;
                const needsBackfill = !hadStartingBalance;

                summary.accountsEvaluated += 1;
                totalAccountsEvaluated += 1;

                if (hasDrift) {
                    summary.accountsWithDrift += 1;
                    totalAccountsWithDrift += 1;
                    summary.totalAbsoluteDrift = roundCurrency(summary.totalAbsoluteDrift + Math.abs(drift));
                    totalAbsoluteDrift = roundCurrency(totalAbsoluteDrift + Math.abs(drift));

                    summary.driftDetails.push({
                        accountId: accountDoc.id,
                        accountName: account.name || "Conta sem nome",
                        currentBalance,
                        expectedBalance,
                        drift,
                        movementFromTransactions: movement,
                        startingBalance,
                        hadStartingBalance,
                    });
                }

                if (needsBackfill) {
                    summary.accountsBackfilled += 1;
                    totalAccountsBackfilled += 1;
                }

                if (apply && (hasDrift || needsBackfill)) {
                    const updatePayload: Partial<Account> & { lastReconciledAt: number } = {
                        startingBalance,
                        lastReconciledAt: now,
                    };

                    if (hasDrift) {
                        updatePayload.balance = expectedBalance;
                        summary.accountsUpdated += 1;
                        totalAccountsUpdated += 1;
                    }

                    writePromises.push(accountDoc.ref.set(updatePayload, { merge: true }));
                }
            });

            if (apply && (summary.accountsUpdated > 0 || summary.accountsBackfilled > 0)) {
                await Promise.all(writePromises);
            }

            if (summary.accountsWithDrift > 0 || summary.accountsBackfilled > 0 || summary.accountsUpdated > 0) {
                workspaceSummaries.push(summary);
            }
        }

        return NextResponse.json({
            ok: true,
            dryRun: !apply,
            generatedAt: Date.now(),
            totals: {
                workspacesScanned: workspaceDocs.length,
                workspacesWithIssues: workspaceSummaries.length,
                accountsEvaluated: totalAccountsEvaluated,
                accountsWithDrift: totalAccountsWithDrift,
                accountsUpdated: totalAccountsUpdated,
                accountsBackfilled: totalAccountsBackfilled,
                totalAbsoluteDrift,
            },
            workspaces: workspaceSummaries,
        });
    } catch (error) {
        console.error("admin reconcile balances error:", error);
        const mapped = mapAdminError(error);
        return NextResponse.json(
            {
                error: mapped.error,
                ...(mapped.details ? { details: mapped.details } : {}),
            },
            { status: mapped.status }
        );
    }
}
