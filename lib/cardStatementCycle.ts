function clampDay(year: number, month: number, day: number) {
    const safeDay = Number.isFinite(day) ? Math.trunc(day) : 1;
    const maxDay = new Date(year, month, 0).getDate();
    return Math.min(Math.max(safeDay, 1), maxDay);
}

function toNoonTimestamp(year: number, month: number, day: number) {
    const normalizedDay = clampDay(year, month, day);
    return new Date(year, month - 1, normalizedDay, 12, 0, 0, 0).getTime();
}

export function resolveCardStatementReference(timestamp: number, closingDay: number) {
    const date = new Date(timestamp);
    const purchaseDay = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();

    const effectiveClosingDay = clampDay(year, month, closingDay);
    if (purchaseDay > effectiveClosingDay) {
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }

    return { month, year };
}

export function resolveStatementDates(
    statementMonth: number,
    statementYear: number,
    closingDay: number,
    dueDay: number
) {
    const closingDate = toNoonTimestamp(statementYear, statementMonth, closingDay);
    const dueMonthOffset = dueDay > closingDay ? 0 : 1;

    let dueMonth = statementMonth + dueMonthOffset;
    let dueYear = statementYear;
    if (dueMonth > 12) {
        dueMonth = 1;
        dueYear += 1;
    }

    const dueDate = toNoonTimestamp(dueYear, dueMonth, dueDay);

    return { closingDate, dueDate };
}
