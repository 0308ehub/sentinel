import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SIGN_IN_DESTINATION, SIGN_UP_DESTINATION } from "@/lib/auth/destinations";
import { siteUrl } from "@/lib/site";
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

const satoshi = localFont({
  src: [
    { path: "../fonts/satoshi/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/satoshi/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/satoshi/Satoshi-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Kismet",
  description: "Cursor for product managers. An AI workspace for deciding what to build next.",
  applicationName: "Kismet",
  openGraph: {
    type: "website",
    siteName: "Kismet",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/kismetmark.png", type: "image/png" }],
    apple: "/kismetmark.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = (await cookies()).get(THEME_KEY)?.value;
  const content = <Providers>{children}</Providers>;
  return (
    <html lang="en" className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <body
        className={`${plex.variable} ${plexMono.variable} ${marketing.variable} ${satoshi.variable} antialiased`}
        suppressHydrationWarning
      >
        {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
          <ClerkProvider
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInFallbackRedirectUrl={SIGN_IN_DESTINATION}
            signInForceRedirectUrl={SIGN_IN_DESTINATION}
            signUpFallbackRedirectUrl={SIGN_UP_DESTINATION}
            signUpForceRedirectUrl={SIGN_UP_DESTINATION}
          >
            {content}
          </ClerkProvider>
        ) : (
          content
        )}
        <Analytics />
      </body>
    </html>
  );
}
