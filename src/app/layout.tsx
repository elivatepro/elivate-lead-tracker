import type { Metadata } from "next";
import { Instrument_Serif, Onest } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
      className={`${instrumentSerif.variable} ${onest.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
