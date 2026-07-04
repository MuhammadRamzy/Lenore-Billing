import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { getCompany } from "@/lib/db";
import PWARegister from "@/components/PWARegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lenore POS",
  description: "Enterprise billing and invoicing system for bath fittings distributors",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lenore POS",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const company = await getCompany();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-slate-50/50 text-slate-900 flex flex-col lg:flex-row overflow-hidden select-none">
        <PWARegister />
        <Navbar company={company} />
        <main className="flex-1 h-screen lg:pl-64 print:pl-0 flex flex-col relative w-full overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrolling-touch p-4 sm:p-6 lg:p-8 pb-24 sm:pb-24 lg:pb-8 print:p-0 max-w-7xl print:max-w-full w-full mx-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
