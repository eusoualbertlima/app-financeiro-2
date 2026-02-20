import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";

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
            <body className="antialiased bg-[#050505] text-slate-50">
                <AuthProvider>
                    <WorkspaceProvider>
                        {children}
                    </WorkspaceProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
