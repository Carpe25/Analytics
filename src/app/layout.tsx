import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Project Time Analytics",
  description: "Developer work log and GitHub commit analytics without a database",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[#F5F7F8] text-[#17212B] min-h-screen flex antialiased font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
