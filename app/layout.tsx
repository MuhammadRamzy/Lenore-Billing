import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { getCompany } from "@/lib/db";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lenore Bath Fittings POS & Billing",
  description: "Enterprise billing and invoicing system for bath fittings distributors",
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
      <body className="h-full bg-slate-50/50 text-slate-900 flex flex-col lg:flex-row">
        <Navbar company={company} />
        <main className="flex-1 min-h-screen lg:pl-64 print:pl-0 flex flex-col relative w-full overflow-x-hidden">
          <div className="flex-1 p-4 sm:p-6 lg:p-8 print:p-0 max-w-7xl print:max-w-full w-full mx-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
