const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number) {
    return String(value).padStart(2, "0");
}

function isDateValid(date: Date) {
    return Number.isFinite(date.getTime());
}

export function dateToInputValue(date: Date) {
    if (!isDateValid(date)) return "";
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    return `${year}-${month}-${day}`;
}

export function nowDateInputValue(now: Date = new Date()) {
    return dateToInputValue(now);
}

export function timestampToDateInputValue(timestamp: number) {
    return dateToInputValue(new Date(timestamp));
}

// Parse YYYY-MM-DD as local date (12:00) to avoid timezone-day drift.
export function parseDateInputToTimestamp(value: string) {
    const match = DATE_INPUT_PATTERN.exec(value.trim());
    if (!match) return Number.NaN;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return Number.NaN;
    }

    return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
}

// Compatibility for legacy records saved as UTC midnight from date inputs.
export function normalizeLegacyDateOnlyTimestamp(timestamp: number) {
    if (!Number.isFinite(timestamp)) return timestamp;

    const parsed = new Date(timestamp);
    if (!isDateValid(parsed)) return timestamp;

    const isUtcMidnight =
        parsed.getUTCHours() === 0
        && parsed.getUTCMinutes() === 0
        && parsed.getUTCSeconds() === 0
        && parsed.getUTCMilliseconds() === 0;

    const isLocalMidnight =
        parsed.getHours() === 0
        && parsed.getMinutes() === 0
        && parsed.getSeconds() === 0
        && parsed.getMilliseconds() === 0;

    if (!isUtcMidnight || isLocalMidnight) {
        return timestamp;
    }

    return new Date(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
        12,
        0,
        0,
        0
    ).getTime();
}
