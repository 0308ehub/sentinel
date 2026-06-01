import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Sentinel — The Autonomous PM",
  description:
    "Sentinel scans your connectors, surfaces insights, and autonomously manages your product backlog.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
        <body className="min-h-full bg-background text-foreground">
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem('sentinel-theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`,
            }}
          />
          <ThemeProvider>
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
