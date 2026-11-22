import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { SWRegister } from "@/components/SWRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignTutor — Learn ASL with Real-Time Feedback",
  description:
    "Browser-based ASL learning with on-device ML. No uploads, no accounts, no cloud processing.",
  manifest: "/manifest.json",
  themeColor: "#00e5b0",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SignTutor",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="theme-color" content="#00e5b0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SignTutor" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-background focus:font-semibold"
        >
          Skip to main content
        </a>
        <OfflineIndicator />
        <SWRegister />
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
