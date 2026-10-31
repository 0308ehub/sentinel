import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";
import { THEME_KEY } from "@/lib/theme";

const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const marketing = Geist({
  variable: "--font-marketing",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Kismet",
  description: "Cursor for product managers. An AI workspace for deciding what to build next.",
  icons: {
    icon: "/kismetmark.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = (await cookies()).get(THEME_KEY)?.value;
  return (
    <html lang="en" className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <body className={`${plex.variable} ${plexMono.variable} ${marketing.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
