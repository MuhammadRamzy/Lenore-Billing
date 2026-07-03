"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Users,
  Package,
  BarChart3,
  PieChart,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  TrendingUp,
} from "lucide-react";
import { Invoice } from "@/lib/types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

interface DashboardTabsProps {
  last6Months: { label: string; amount: number }[];
  maxMonthlySales: number;
  totalTaxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  topCustomers: { name: string; total: number; count: number }[];
  maxCustomerSales: number;
  topProducts: { name: string; quantity: number; total: number }[];
  maxProductQty: number;
  recentInvoices: Invoice[];
}

export default function DashboardTabs({
  last6Months,
  maxMonthlySales,
  totalTaxableValue,
  totalCgst,
  totalSgst,
  totalIgst,
  totalTax,
  topCustomers,
  maxCustomerSales,
  topProducts,
  maxProductQty,
  recentInvoices,
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "leaderboards" | "recent">("overview");

  // Sub-sections rendering logic
  const renderMonthlySalesTrend = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-550" />
          Monthly Sales Trend
        </h2>
        <span className="text-[10px] sm:text-xs font-bold text-slate-400">Last 6 Months (INR)</span>
      </div>

      <div className="relative pt-4 w-full h-[180px] sm:h-[200px] flex items-end">
        <div className="absolute inset-y-0 left-0 w-full flex flex-col justify-between pointer-events-none border-b border-slate-100 pb-8 pt-4">
          <div className="w-full border-t border-slate-100/80"></div>
          <div className="w-full border-t border-slate-100/80"></div>
          <div className="w-full border-t border-slate-100/80"></div>
        </div>

        <div className="relative z-10 w-full h-full flex items-end justify-between px-1 sm:px-6">
          {last6Months.map((m, idx) => {
            const heightPercent = m.amount > 0 ? Math.max((m.amount / maxMonthlySales) * 80, 5) : 2;
            return (
              <div key={idx} className="flex flex-col items-center flex-1 group">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded absolute -translate-y-9 shadow-md z-20 pointer-events-none font-mono">
                  {formatCurrency(m.amount)}
                </div>
                <div
                  style={{ height: `${heightPercent}%` }}
                  className="w-6 sm:w-12 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-500 hover:from-indigo-500 hover:to-indigo-300 shadow-sm"
                />
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 mt-2 tracking-tight">
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderTaxLiabilitySummary = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
        <PieChart className="h-5 w-5 text-indigo-555" />
        Tax Liability Summary
      </h2>

      <div className="space-y-4 pt-2">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 font-medium">Total Taxable Value:</span>
            <span className="font-bold text-slate-800">{formatCurrency(totalTaxableValue)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 font-medium">Total CGST:</span>
            <span className="font-bold text-slate-800">{formatCurrency(totalCgst)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 font-medium">Total SGST:</span>
            <span className="font-bold text-slate-800">{formatCurrency(totalSgst)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500 font-medium">Total IGST:</span>
            <span className="font-bold text-slate-800">{formatCurrency(totalIgst)}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">GST Contribution</span>
            <span className="font-bold text-slate-900">{formatCurrency(totalTax)}</span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${totalTax > 0 ? (totalCgst / totalTax) * 100 : 0}%` }}
              className="bg-indigo-500 h-full animate-pulse"
              title={`CGST: ${formatCurrency(totalCgst)}`}
            />
            <div
              style={{ width: `${totalTax > 0 ? (totalSgst / totalTax) * 100 : 0}%` }}
              className="bg-sky-400 h-full"
              title={`SGST: ${formatCurrency(totalSgst)}`}
            />
            <div
              style={{ width: `${totalTax > 0 ? (totalIgst / totalTax) * 100 : 0}%` }}
              className="bg-amber-400 h-full"
              title={`IGST: ${formatCurrency(totalIgst)}`}
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 font-bold">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-500" /> CGST
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-400" /> SGST
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> IGST
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTopCustomers = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
        <Users className="h-5 w-5 text-indigo-550" />
        Top Customers by Sales
      </h2>

      {topCustomers.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No customer sales data available.</p>
      ) : (
        <div className="space-y-4">
          {topCustomers.map((c, idx) => {
            const percent = (c.total / maxCustomerSales) * 100;
            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-800 truncate max-w-[200px] sm:max-w-xs">{c.name}</span>
                  <span className="text-slate-900 font-bold font-mono">{formatCurrency(c.total)}</span>
                </div>
                <div className="relative">
                  <div className="h-2 w-full bg-slate-50 rounded-full border border-slate-100 overflow-hidden">
                    <div
                      style={{ width: `${percent}%` }}
                      className="bg-gradient-to-r from-indigo-500 to-indigo-650 h-full rounded-full"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-slate-400">
                  Billed <span className="font-bold text-slate-600">{c.count}</span> times
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderTopProducts = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
        <Package className="h-5 w-5 text-indigo-550" />
        Top Products by Quantity Sold
      </h2>

      {topProducts.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No product sales data available.</p>
      ) : (
        <div className="space-y-4">
          {topProducts.map((p, idx) => {
            const percent = (p.quantity / maxProductQty) * 100;
            return (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-800 truncate max-w-[200px] sm:max-w-xs">{p.name}</span>
                  <span className="text-slate-900 font-bold font-mono">{p.quantity} Units</span>
                </div>
                <div className="relative">
                  <div className="h-2 w-full bg-slate-50 rounded-full border border-slate-100 overflow-hidden">
                    <div
                      style={{ width: `${percent}%` }}
                      className="bg-gradient-to-r from-emerald-500 to-emerald-650 h-full rounded-full"
                    />
                  </div>
                </div>
                <div className="text-[10px] text-slate-400">
                  Total sales: <span className="font-bold text-slate-600">{formatCurrency(p.total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderRecentInvoices = () => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-indigo-550" />
          Recent Invoices
        </h2>
        <Link
          href="/invoices"
          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          View All &rarr;
        </Link>
      </div>

      {recentInvoices.length === 0 ? (
        <div className="p-10 text-center text-slate-400 flex flex-col items-center justify-center">
          <FileSpreadsheet className="h-10 w-10 text-slate-200 mb-2" />
          <p className="font-semibold text-slate-500 text-xs">No invoices generated yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto w-full">
          {/* Mobile view of the recent invoices inside this list */}
          <div className="block sm:hidden divide-y divide-slate-100">
            {recentInvoices.map((inv) => (
              <div key={inv.id} className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">{inv.invoiceNo}</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                      inv.status === "paid" && "bg-emerald-50 text-emerald-700",
                      inv.status === "sent" && "bg-amber-50 text-amber-700",
                      inv.status === "draft" && "bg-slate-100 text-slate-700",
                      inv.status === "overdue" && "bg-rose-50 text-rose-700"
                    )}
                  >
                    {inv.status}
                  </span>
                </div>
                <div className="flex justify-between items-end text-xs">
                  <div>
                    <div className="font-semibold text-slate-800">{inv.customerSnapshot.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(inv.invoiceDate)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-900">{formatCurrency(inv.grandTotal)}</div>
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="text-[10px] font-bold text-indigo-650 hover:underline mt-1 block"
                    >
                      Manage &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tablet & Desktop View */}
          <table className="hidden sm:table w-full border-collapse text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Invoice No.</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{inv.invoiceNo}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800 truncate max-w-[120px]">{inv.customerSnapshot.name}</div>
                    <div className="text-[10px] text-slate-400">{formatDate(inv.invoiceDate)}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    {formatCurrency(inv.grandTotal)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        inv.status === "paid" && "bg-emerald-50 text-emerald-700",
                        inv.status === "sent" && "bg-amber-50 text-amber-700",
                        inv.status === "draft" && "bg-slate-100 text-slate-700",
                        inv.status === "overdue" && "bg-rose-50 text-rose-700"
                      )}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-750"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* MOBILE TAB BAR NAVIGATION */}
      <div className="lg:hidden flex bg-slate-100 p-1 rounded-xl border border-slate-200">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95",
            activeTab === "overview"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <BarChart3 className="h-4 w-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab("leaderboards")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95",
            activeTab === "leaderboards"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Users className="h-4 w-4" />
          Leaderboards
        </button>
        <button
          onClick={() => setActiveTab("recent")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95",
            activeTab === "recent"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Activity
        </button>
      </div>

      {/* MOBILE CONDITIONAL RENDERING */}
      <div className="lg:hidden space-y-6">
        {activeTab === "overview" && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {renderMonthlySalesTrend()}
            {renderTaxLiabilitySummary()}
          </div>
        )}
        {activeTab === "leaderboards" && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {renderTopCustomers()}
            {renderTopProducts()}
          </div>
        )}
        {activeTab === "recent" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
            {renderRecentInvoices()}
          </div>
        )}
      </div>

      {/* DESKTOP PERMANENT GRID LAYOUT */}
      <div className="hidden lg:grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {renderMonthlySalesTrend()}
        </div>
        <div>
          {renderTaxLiabilitySummary()}
        </div>
      </div>

      <div className="hidden lg:grid grid-cols-2 gap-6">
        {renderTopCustomers()}
        {renderTopProducts()}
      </div>

      <div className="hidden lg:block">
        {renderRecentInvoices()}
      </div>
    </div>
  );
}
