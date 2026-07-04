"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Package,
  Menu,
  X,
  CreditCard,
  Keyboard,
  HelpCircle,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Company } from "@/lib/types";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileSpreadsheet },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/products", label: "Products", icon: Package },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Navbar({ company }: { company: Company }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Close mobile drawer when pathname changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Listen for Alt + Shift + [Key]
      if (e.altKey && e.shiftKey) {
        const key = e.key.toLowerCase();
        
        if (key === "1") {
          e.preventDefault();
          router.push("/dashboard");
        } else if (key === "2") {
          e.preventDefault();
          router.push("/invoices");
        } else if (key === "3") {
          e.preventDefault();
          router.push("/customers");
        } else if (key === "4") {
          e.preventDefault();
          router.push("/products");
        } else if (key === "5") {
          e.preventDefault();
          router.push("/settings");
        } else if (key === "n") {
          e.preventDefault();
          router.push("/invoices/new");
        } else if (key === "h") {
          e.preventDefault();
          setIsHelpOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="flex items-center justify-between bg-slate-900 px-4 py-3.5 text-white lg:hidden border-b border-slate-800 print:hidden h-14 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-white p-1 rounded-lg shrink-0 flex items-center justify-center h-8 w-8">
            <img src="/logo.png" alt="Lenore Logo" className="h-6 w-auto object-contain" />
          </div>
          <span className="font-bold text-sm tracking-wider text-slate-100 uppercase">
            {company.name.split(" ")[0]} Terminal
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsHelpOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            title="Shortcuts Help"
          >
            <Keyboard className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 text-white lg:hidden flex justify-around items-center h-16 px-2 print:hidden safe-bottom">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full py-1 relative text-slate-400 active:scale-95 transition-transform duration-100",
                isActive ? "text-indigo-400 font-extrabold" : "hover:text-slate-200"
              )}
            >
              <Icon className="h-5 w-5 mb-0.5 shrink-0" />
              <span className="text-[9px] uppercase tracking-wider leading-none">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-indigo-400 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 border-r border-slate-800 text-white flex-col justify-between print:hidden">
        <div>
          <div className="flex items-center gap-2.5 px-6 py-6 border-b border-slate-800">
            <div className="bg-white p-1 rounded-lg shrink-0 flex items-center justify-center h-9 w-9">
              <img src="/logo.png" alt="Lenore Logo" className="h-7 w-auto object-contain" />
            </div>
            <span className="font-extrabold text-xl tracking-wider text-slate-100">
              {company.name.split(" ")[0]}
            </span>
          </div>

          <nav className="mt-8 px-4 space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200",
                    isActive
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Company Snapshot bottom desktop */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/40 m-4 rounded-xl space-y-3">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
              Active Terminal
            </div>
            <div className="text-sm font-bold text-slate-200">{company.name}</div>
            <div className="text-xs text-slate-400 mt-1">GST: {company.gstin}</div>
            <div className="text-xs text-indigo-400 mt-2 flex items-center gap-1.5 font-medium">
              <CreditCard className="h-3.5 w-3.5" /> {company.bank.bankName} - *{company.bank.accountNo.slice(-4)}
            </div>
          </div>
          <button
            onClick={() => setIsHelpOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-slate-850 hover:bg-slate-800 text-xs text-slate-300 font-bold rounded-lg transition-colors border border-slate-800 hover:border-slate-700"
          >
            <Keyboard className="h-4 w-4" /> Shortcuts: Alt+Shift+H
          </button>
        </div>
      </aside>

      {/* Keyboard Shortcuts Help Sheet Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 text-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-extrabold text-base flex items-center gap-2 text-slate-900">
                <Keyboard className="h-5 w-5 text-indigo-600" />
                POS Key Shortcuts
              </h3>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-extrabold text-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3 py-1 text-xs">
              <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Navigation</div>
              <div className="flex justify-between items-center">
                <span>Go to Dashboard</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[9px] text-slate-600 shadow-sm">Alt + Shift + 1</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Go to Invoices</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[9px] text-slate-600 shadow-sm">Alt + Shift + 2</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Go to Customers</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[9px] text-slate-600 shadow-sm">Alt + Shift + 3</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Go to Products</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[9px] text-slate-600 shadow-sm">Alt + Shift + 4</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Go to Settings</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[9px] text-slate-600 shadow-sm">Alt + Shift + 5</kbd>
              </div>
              <div className="flex justify-between items-center font-semibold text-slate-900">
                <span>Create New Invoice</span>
                <kbd className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded font-mono text-[9px] text-indigo-600 shadow-sm">Alt + Shift + N</kbd>
              </div>

              <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] pt-2">Invoice Creator</div>
              <div className="flex justify-between items-center">
                <span>Add Line Item</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[9px] text-slate-600 shadow-sm">Alt + Shift + A</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Save & Submit Invoice</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[9px] text-slate-600 shadow-sm">Alt + Shift + S</kbd>
              </div>

              <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] pt-2">Invoice Detail View</div>
              <div className="flex justify-between items-center">
                <span>Trigger Page Print</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[9px] text-slate-600 shadow-sm">Alt + Shift + P</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Download PDF Invoice</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[9px] text-slate-600 shadow-sm">Alt + Shift + D</kbd>
              </div>
            </div>
            
            <button
              onClick={() => setIsHelpOpen(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
