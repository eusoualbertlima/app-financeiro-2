import type { Transaction } from '@/types';
import { resolveCardStatementReference } from '@/lib/cardStatementCycle';

interface StatementRef {
    month: number;
    year: number;
}

function toInt(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const trimmed = value.trim();
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed)) return Math.trunc(parsed);

        const parsedDate = Date.parse(trimmed);
        if (Number.isFinite(parsedDate)) return Math.trunc(parsedDate);
    }
    if (value && typeof value === 'object') {
        const source = value as Record<string, unknown>;

        const toDate = source.toDate;
        if (typeof toDate === 'function') {
            const date = (toDate as () => Date)();
            if (date instanceof Date && Number.isFinite(date.getTime())) {
                return Math.trunc(date.getTime());
            }
        }

        const toMillis = source.toMillis;
        if (typeof toMillis === 'function') {
            const millis = (toMillis as () => number)();
            if (Number.isFinite(millis)) return Math.trunc(millis);
        }

        const seconds = source.seconds;
        if (typeof seconds === 'number' && Number.isFinite(seconds)) {
            return Math.trunc(seconds * 1000);
        }

        const milliseconds = source.milliseconds;
        if (typeof milliseconds === 'number' && Number.isFinite(milliseconds)) {
            return Math.trunc(milliseconds);
        }

        if (value instanceof Date) {
            const millis = value.getTime();
            if (Number.isFinite(millis)) return Math.trunc(millis);
        }
    }
    return null;
}

function isValidMonthYear(month: number | null, year: number | null): boolean {
    return month !== null && year !== null && month >= 1 && month <= 12 && year >= 1970 && year <= 3000;
}

function parseMonthYearFromString(value: unknown): StatementRef | null {
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    // YYYY-MM or YYYY/MM
    let match = /^(\d{4})[-/](\d{1,2})$/.exec(trimmed);
    if (match) {
        const year = toInt(match[1]);
        const month = toInt(match[2]);
        if (isValidMonthYear(month, year)) return { month: month!, year: year! };
    }

    // MM-YYYY or MM/YYYY
    match = /^(\d{1,2})[-/](\d{4})$/.exec(trimmed);
    if (match) {
        const month = toInt(match[1]);
        const year = toInt(match[2]);
        if (isValidMonthYear(month, year)) return { month: month!, year: year! };
    }

    return null;
}

function resolveFromExplicitFields(transaction: Record<string, unknown>): StatementRef | null {
    const candidates: Array<[unknown, unknown]> = [
        [transaction.invoiceMonth, transaction.invoiceYear],
        [transaction.invoice_month, transaction.invoice_year],
        [transaction.statementMonth, transaction.statementYear],
        [transaction.statement_month, transaction.statement_year],
        [transaction.faturaMonth, transaction.faturaYear],
        [transaction.fatura_month, transaction.fatura_year],
        [transaction.faturaMes, transaction.faturaAno],
    ];

    for (const [monthValue, yearValue] of candidates) {
        const month = toInt(monthValue);
        const year = toInt(yearValue);
        if (isValidMonthYear(month, year)) {
            return { month: month!, year: year! };
        }
    }

    return null;
}

function resolveFromStringFields(transaction: Record<string, unknown>): StatementRef | null {
    const candidates: unknown[] = [
        transaction.invoiceRef,
        transaction.invoice_ref,
        transaction.statementRef,
        transaction.statement_ref,
        transaction.faturaRef,
        transaction.fatura_ref,
        transaction.invoicePeriod,
        transaction.invoice_period,
    ];

    for (const value of candidates) {
        const parsed = parseMonthYearFromString(value);
        if (parsed) return parsed;
    }

    return null;
}

export function getTransactionInvoiceId(transaction: Partial<Transaction> | Record<string, unknown>): string | null {
    const source = transaction as Record<string, unknown>;
    const candidates: unknown[] = [
        source.invoiceId,
        source.invoice_id,
        source.statementId,
        source.statement_id,
        source.cardStatementId,
        source.card_statement_id,
        source.faturaId,
        source.fatura_id,
    ];

    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) return value.trim();
    }

    return null;
}

function parseBooleanLike(value: unknown) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
}

export function isTransactionExcludedFromTotals(transaction: Partial<Transaction> | Record<string, unknown>) {
    const source = transaction as Record<string, unknown>;
    const flags: unknown[] = [
        source.excludeFromTotals,
        source.exclude_from_totals,
        source.excludeFromInvoiceTotals,
        source.exclude_from_invoice_totals,
    ];

    if (flags.some(parseBooleanLike)) return true;

    const description = typeof source.description === 'string'
        ? source.description.trim().toLowerCase()
        : '';
    const hasCardContext = Boolean(source.cardId) || Boolean(getTransactionInvoiceId(source));

    if (description && hasCardContext) {
        const technicalDescriptions = [
            'fatura atualizada',
            'fatura ajustada',
            'ajuste de saldo',
            'ajuste saldo',
            'ajuste de fatura',
            'ajuste fatura',
        ];

        if (technicalDescriptions.some((entry) => description === entry || description.startsWith(`${entry} `))) {
            return true;
        }
    }

    const sourceType = typeof source.source === 'string' ? source.source.trim().toLowerCase() : '';
    if (sourceType) {
        const technicalSources = [
            'system',
            'operational',
            'card_statement_adjustment',
            'invoice_adjustment',
        ];
        if (technicalSources.includes(sourceType)) return true;
    }

    return false;
}

export function resolveTransactionStatementReference(
    transaction: Partial<Transaction> | Record<string, unknown>,
    closingDay?: number
): StatementRef | null {
    const source = transaction as Record<string, unknown>;

    const explicit = resolveFromExplicitFields(source);
    if (explicit) return explicit;

    const fromString = resolveFromStringFields(source);
    if (fromString) return fromString;

    const timestamp = toInt(source.date);
    if (timestamp === null) return null;

    if (closingDay !== undefined) {
        return resolveCardStatementReference(timestamp, closingDay);
    }

    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return null;
    return { month: date.getMonth() + 1, year: date.getFullYear() };
}

export function statementMonthYearKey(month: number, year: number) {
    return `${year}-${String(month).padStart(2, '0')}`;
}
