"use client";

import { useMemo, useState } from "react";

interface CurrencyInputProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
    placeholder?: string;
    required?: boolean;
    max?: number;
}

export function CurrencyInput({
    value,
    onChange,
    className = "",
    placeholder = "R$ 0,00",
    required = false,
    max = 999999999.99,
}: CurrencyInputProps) {
    const [rawValue, setRawValue] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    // Format number to BRL display
    const formatToBRL = (num: number): string => {
        if (num === 0) return "";
        return new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(num);
    };

    const parseRawToNumber = (raw: string) =>
        parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0;

    const displayValue = useMemo(() => {
        if (isEditing) return rawValue;
        return value > 0 ? formatToBRL(value) : "";
    }, [isEditing, rawValue, value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value;

        // Remove everything except digits, comma, and period
        raw = raw.replace(/[^\d.,]/g, "");

        // Replace period with comma (standardize to Brazilian format)
        raw = raw.replace(/\./g, ",");

        // Only allow one comma
        const parts = raw.split(",");
        if (parts.length > 2) {
            raw = parts[0] + "," + parts.slice(1).join("");
        }

        // Limit decimal places to 2
        if (parts.length === 2 && parts[1].length > 2) {
            raw = parts[0] + "," + parts[1].slice(0, 2);
        }

        setRawValue(raw);

        // Parse to number
        const numericValue = parseRawToNumber(raw);

        if (numericValue <= max) {
            onChange(numericValue);
        }
    };

    const handleBlur = () => {
        const numericValue = parseRawToNumber(rawValue);
        if (!Number.isFinite(numericValue) || numericValue < 0) {
            onChange(0);
        }
        setIsEditing(false);
    };

    const handleFocus = () => {
        // On focus, show raw number for easy editing
        setIsEditing(true);
        if (value > 0) {
            setRawValue(value.toFixed(2).replace(".", ","));
        } else {
            setRawValue("");
        }
    };

    return (
        <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">
                R$
            </span>
            <input
                type="text"
                inputMode="decimal"
                value={displayValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onFocus={handleFocus}
                placeholder={placeholder}
                required={required}
                className={`pl-10 ${className}`}
                autoComplete="off"
            />
        </div>
    );
}
