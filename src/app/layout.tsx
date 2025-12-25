import type { Metadata, Viewport } from "next";
import { Inter, EB_Garamond, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const ebGaramond = EB_Garamond({ subsets: ["latin"], variable: "--font-serif" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "LitLens | Systematic Review Intelligence",
  description: "A distinctive, AI-powered platform for systematic reviews and research intelligence.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LitLens",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "LitLens",
    title: "LitLens | Systematic Review Intelligence",
    description: "A distinctive, AI-powered platform for systematic reviews and research intelligence.",
  },
  twitter: {
    card: "summary",
    title: "LitLens | Systematic Review Intelligence",
    description: "A distinctive, AI-powered platform for systematic reviews and research intelligence.",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a3320",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${ebGaramond.variable} ${jetBrainsMono.variable}`}>
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

