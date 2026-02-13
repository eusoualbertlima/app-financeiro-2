export type CsvColumn<T> = {
    header: string;
    key: keyof T | string;
    format?: (value: unknown, row: T) => unknown;
};

function escapeCsvCell(value: unknown): string {
    if (value === null || value === undefined) return "";

    const raw = String(value);
    const escaped = raw.replace(/"/g, '""');

    if (/[",\n\r]/.test(escaped)) {
        return `"${escaped}"`;
    }

    return escaped;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
    const header = columns.map((column) => escapeCsvCell(column.header)).join(",");
    const lines = rows.map((row) =>
        columns
            .map((column) => {
                const baseValue = (row as Record<string, unknown>)[column.key as string];
                const finalValue = column.format ? column.format(baseValue, row) : baseValue;
                return escapeCsvCell(finalValue);
            })
            .join(",")
    );

    return [header, ...lines].join("\n");
}

export function downloadCsv<T>(input: {
    filename: string;
    rows: T[];
    columns: CsvColumn<T>[];
}) {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const { filename, rows, columns } = input;
    const csv = toCsv(rows, columns);
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
