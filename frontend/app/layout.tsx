import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ApprovalProvider } from "@/components/approval-provider";
import { SettingsProvider } from "@/components/settings-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nexus | Warehouse AI Control Tower",
  description: "AI-powered warehouse and logistics operations control tower",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ApprovalProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </ApprovalProvider>
      </body>
    </html>
  );
}
