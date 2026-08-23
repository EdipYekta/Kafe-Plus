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
                background: "#1a1a24",
                color: "#f1f1f5",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                fontSize: "14px",
              },
              success: {
                iconTheme: { primary: "#22c55e", secondary: "#1a1a24" },
              },
              error: {
                iconTheme: { primary: "#ef4444", secondary: "#1a1a24" },
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
