import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
    ...nextCoreWebVitals,
    ...nextTypescript,
    {
        rules: {
            // Dívida técnica legada: manter visível sem bloquear release.
            "@typescript-eslint/no-explicit-any": "warn",
            // Regras novas do plugin React Hooks são valiosas, mas hoje há base legada.
            "react-hooks/set-state-in-effect": "warn",
            "react-hooks/purity": "warn",
            "react-hooks/immutability": "warn",
        },
    },
    globalIgnores(["node_modules/**", ".next/**", "playwright-report/**", "test-results/**"]),
]);
