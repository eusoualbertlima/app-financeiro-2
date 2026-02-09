import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
    title: "App Financeiro 2.0",
    description: "Gerenciamento financeiro para casais",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR">
            <body className="antialiased bg-gray-50">
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
