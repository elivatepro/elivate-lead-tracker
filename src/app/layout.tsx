import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { CommandPalette } from "@/components/command/command-palette";
import { LeadDetailProvider } from "@/components/leads/lead-detail-viewer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LeadTracker by Elivate",
    template: "%s | LeadTracker",
  },
  description:
    "Lead management for freelancers. Track leads, get reminders, close deals.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://leadtracker.elivate.io"
  ),
  openGraph: {
    title: "LeadTracker by Elivate",
    description:
      "Lead management for freelancers. Track leads, get reminders, close deals.",
    siteName: "LeadTracker",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LeadTracker by Elivate",
    description:
      "Lead management for freelancers. Track leads, get reminders, close deals.",
  },
  other: {
    "theme-color": "#ff7f4f",
    "apple-mobile-web-app-title": "LeadTracker",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <QueryProvider>
          <Suspense fallback={null}>
            <LeadDetailProvider>
              {children}
              <CommandPalette />
              <Toaster />
            </LeadDetailProvider>
          </Suspense>
        </QueryProvider>
      </body>
    </html>
  );
}
