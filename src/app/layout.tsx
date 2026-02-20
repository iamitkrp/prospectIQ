import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ProspectIQ — Zero-Cost Outreach Engine",
    template: "%s | ProspectIQ",
  },
  description:
    "Discover prospects, generate AI-powered emails, and automate outreach sequences — all on free-tier infrastructure.",
  openGraph: {
    title: "ProspectIQ — Zero-Cost Outreach Engine",
    description:
      "Discover prospects, generate AI-powered emails, and automate outreach sequences — all on free-tier infrastructure.",
    siteName: "ProspectIQ",
    locale: "en_US",
    type: "website",
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
