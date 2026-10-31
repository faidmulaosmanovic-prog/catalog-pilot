import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

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
  title: "CatalogPilot",
  description:
    "Product data operations platform for multi-channel ecommerce catalogs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="flex flex-wrap gap-4 px-6 py-6 text-sm text-zinc-500">
          <Link className="underline" href="/privacy">
            Privacy
          </Link>
          <Link className="underline" href="/terms">
            Terms
          </Link>
          <a className="underline" href="/samples/catalog-sample.csv">
            Sample CSV
          </a>
        </footer>
      </body>
    </html>
  );
}
