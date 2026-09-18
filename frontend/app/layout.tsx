import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { ApprovalProvider } from "@/components/approval-provider";
import { SettingsProvider } from "@/components/settings-provider";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VW LogiMind | Warehouse AI Control Tower",
  description: "AI-powered warehouse and logistics operations control tower",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ApprovalProvider>
          <SettingsProvider>{children}</SettingsProvider>
        </ApprovalProvider>
      </body>
    </html>
  );
}
