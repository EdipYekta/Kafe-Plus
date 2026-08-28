import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import QueryProvider from "@/components/providers/QueryProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kafe+ | Kafe & Restoran Yönetim Sistemi",
  description: "Modern, multi-tenant kafe ve restoran yönetim otomasyonu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className={inter.className}>
        <QueryProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--card)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                fontSize: "14px",
              },
              success: {
                iconTheme: { primary: "#4ade80", secondary: "#1a1a1a" },
              },
              error: {
                iconTheme: { primary: "#f87171", secondary: "#1a1a1a" },
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
