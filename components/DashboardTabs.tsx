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
  TrendingUp,
  ShoppingCart,
  TrendingDown,
  DollarSign,
  Percent,
  Receipt,
  Activity,
} from "lucide-react";
import { Invoice, Purchase, Expense } from "@/lib/types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

interface MonthlyDataPoint {
  label: string;
  sales: number;
  purchases: number;
  expenses: number;
}

interface DashboardTabsProps {
  monthlyData: MonthlyDataPoint[];
  maxVal: number;
  totalTaxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;

  totalExpenses: number;
  totalExpenseGst: number;
  netGstLiability: number;
  operatingProfit: number;
  profitMarginPercent: number;
  expenseCategoriesBreakdown: { category: string; amount: number; percent: number }[];

  topCustomers: { name: string; total: number; count: number }[];
  maxCustomerSales: number;
  topProducts: { name: string; quantity: number; total: number }[];
  maxProductQty: number;
  recentInvoices: Invoice[];
  recentPurchases: Purchase[];
  recentExpenses: Expense[];
}

const CATEGORIES = [
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "salaries", label: "Salaries" },
  { value: "marketing", label: "Marketing" },
  { value: "freight", label: "Freight" },
  { value: "travel", label: "Travel" },
  { value: "miscellaneous", label: "Miscellaneous" },
];

export default function DashboardTabs({
  monthlyData,
  maxVal,
  totalTaxableValue,
  totalCgst,
  totalSgst,
  totalIgst,
  totalTax,
  totalExpenses,
  totalExpenseGst,
  netGstLiability,
  operatingProfit,
  profitMarginPercent,
  expenseCategoriesBreakdown,
  topCustomers,
  maxCustomerSales,
  topProducts,
  maxProductQty,
  recentInvoices,
  recentPurchases,
  recentExpenses,
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "profitability" | "leaderboards" | "recent">("overview");
  const [activeActivityTab, setActiveActivityTab] = useState<"invoices" | "purchases" | "expenses">("invoices");

  const renderComparativeSalesTrend = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            Cash Flow & Trend Chart
          </h2>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
            Compare monthly Sales inflows, Purchases, and operational Expenses.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-extrabold uppercase">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded bg-indigo-600" /> Inflows (Sales)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded bg-emerald-500" /> Purchases
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded bg-rose-500" /> Expenses
          </span>
        </div>
      </div>

      <div className="relative pt-6 w-full h-[220px] flex items-end">
        <div className="absolute inset-y-0 left-0 w-full flex flex-col justify-between pointer-events-none border-b border-slate-100 pb-8 pt-4">
          <div className="w-full border-t border-slate-100/80"></div>
          <div className="w-full border-t border-slate-100/80"></div>
          <div className="w-full border-t border-slate-100/80"></div>
        </div>

        <div className="relative z-10 w-full h-full flex items-end justify-between px-1 sm:px-6">
          {monthlyData.map((m, idx) => (
            <div key={idx} className="flex flex-col items-center flex-1 group">
              <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 bg-slate-950 text-white text-[10px] font-bold p-2.5 rounded-xl absolute -translate-y-20 shadow-lg z-25 pointer-events-none w-36 text-center space-y-1">
                <div className="text-[9px] text-slate-400 font-semibold">{m.label}</div>
                <div className="flex justify-between text-indigo-400"><span>Sales:</span> <span>{formatCurrency(m.sales)}</span></div>
                <div className="flex justify-between text-emerald-400"><span>Purchases:</span> <span>{formatCurrency(m.purchases)}</span></div>
                <div className="flex justify-between text-rose-400"><span>Expenses:</span> <span>{formatCurrency(m.expenses)}</span></div>
              </div>

              <div className="flex items-end justify-center gap-0.5 sm:gap-1.5 h-full w-full">
                {/* Sales Bar */}
                <div
                  style={{ height: `${m.sales > 0 ? Math.max((m.sales / maxVal) * 80, 4) : 2}%` }}
                  className="w-1.5 sm:w-3 bg-gradient-to-t from-indigo-650 to-indigo-500 rounded-t-sm shadow-sm transition-all duration-300"
                />
                {/* Purchases Bar */}
                <div
                  style={{ height: `${m.purchases > 0 ? Math.max((m.purchases / maxVal) * 80, 4) : 2}%` }}
                  className="w-1.5 sm:w-3 bg-gradient-to-t from-emerald-600 to-emerald-450 rounded-t-sm shadow-sm transition-all duration-300"
                />
                {/* Expenses Bar */}
                <div
                  style={{ height: `${m.expenses > 0 ? Math.max((m.expenses / maxVal) * 80, 4) : 2}%` }}
                  className="w-1.5 sm:w-3 bg-gradient-to-t from-rose-500 to-rose-400 rounded-t-sm shadow-sm transition-all duration-300"
                />
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 mt-2 tracking-tight">
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTaxLiabilitySummary = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
        <PieChart className="h-5 w-5 text-indigo-600" />
        Tax Liability & ITC Summary
      </h2>

      <div className="space-y-4 pt-2">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
          <div className="flex justify-between text-[11px] font-semibold">
            <span className="text-slate-500">Invoice Taxable Value:</span>
            <span className="font-bold text-slate-800">{formatCurrency(totalTaxableValue)}</span>
          </div>
          <div className="flex justify-between text-[11px] font-semibold">
            <span className="text-slate-500">Collected Sales Tax:</span>
            <span className="font-bold text-slate-800">{formatCurrency(totalTax)}</span>
          </div>
          <div className="flex justify-between text-[11px] font-semibold border-t pt-1.5 mt-1 border-slate-200">
            <span className="text-slate-500">Less: Purchase ITC Credit:</span>
            <span className="font-bold text-slate-800">- {formatCurrency(totalTax - netGstLiability - totalExpenseGst)}</span>
          </div>
          <div className="flex justify-between text-[11px] font-semibold">
            <span className="text-slate-500">Less: Expense ITC Credit:</span>
            <span className="font-bold text-slate-800">- {formatCurrency(totalExpenseGst)}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800">GST Breakdown</span>
            <span className="font-bold text-slate-900">{formatCurrency(totalTax)}</span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${totalTax > 0 ? (totalCgst / totalTax) * 100 : 0}%` }}
              className="bg-indigo-500 h-full"
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
              <span className="h-2 w-2 rounded-full bg-indigo-500" /> CGST ({totalCgst > 0 && totalTax > 0 ? ((totalCgst / totalTax) * 100).toFixed(0) : 0}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-400" /> SGST ({totalSgst > 0 && totalTax > 0 ? ((totalSgst / totalTax) * 100).toFixed(0) : 0}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> IGST ({totalIgst > 0 && totalTax > 0 ? ((totalIgst / totalTax) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProfitabilityAnalysis = () => {
    const totalPurchases = monthlyData.reduce((acc, c) => acc + c.purchases, 0);
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Percent className="h-5 w-5 text-indigo-650" />
            Operating Cash Profitability (All-Time)
          </h2>
          <p className="text-[10px] text-slate-400 font-bold mt-0.5">
            General ledger performance summarizing sales inflows minus purchasing and operational costs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gross Operating Profit</div>
            <div className={cn("text-lg font-black", operatingProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {formatCurrency(operatingProfit)}
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Operational Profit Margin</div>
            <div className={cn("text-lg font-black", profitMarginPercent >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {profitMarginPercent.toFixed(1)}%
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Operating Cost Ratio</div>
            <div className="text-lg font-black text-slate-900">
              {monthlyData.reduce((acc, c) => acc + c.sales, 0) > 0
                ? (((totalPurchases + totalExpenses) / monthlyData.reduce((acc, c) => acc + c.sales, 0)) * 100).toFixed(1)
                : "0.0"}%
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Business Expenses Ledger Breakdown</h3>
          {expenseCategoriesBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No business expenses recorded yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {expenseCategoriesBreakdown.map((cat, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl space-y-2 transition-all">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 capitalize">
                      {CATEGORIES.find((c) => c.value === cat.category)?.label || cat.category}
                    </span>
                    <span className="font-extrabold text-slate-900 font-mono">
                      {formatCurrency(cat.amount)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-150 h-2 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${cat.percent}%` }}
                      className="bg-rose-500 h-full rounded-full"
                    />
                  </div>
                  <div className="text-[9px] text-slate-400 font-semibold text-right">
                    {cat.percent.toFixed(1)}% of total expenses
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTopCustomers = () => (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
        <Users className="h-5 w-5 text-indigo-650" />
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
        <Package className="h-5 w-5 text-emerald-600" />
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

  const renderActivityLogs = () => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden space-y-4">
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Activity className="h-5 w-5 text-indigo-600" />
          Recent Transaction Activity
        </h2>
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-auto">
          <button
            onClick={() => setActiveActivityTab("invoices")}
            className={cn(
              "px-3 py-1 rounded text-[10px] font-bold transition-all",
              activeActivityTab === "invoices" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-850"
            )}
          >
            Invoices
          </button>
          <button
            onClick={() => setActiveActivityTab("purchases")}
            className={cn(
              "px-3 py-1 rounded text-[10px] font-bold transition-all",
              activeActivityTab === "purchases" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-850"
            )}
          >
            Purchases
          </button>
          <button
            onClick={() => setActiveActivityTab("expenses")}
            className={cn(
              "px-3 py-1 rounded text-[10px] font-bold transition-all",
              activeActivityTab === "expenses" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-850"
            )}
          >
            Expenses
          </button>
        </div>
      </div>

      <div className="px-5 pb-5">
        {activeActivityTab === "invoices" && (
          <div className="divide-y divide-slate-100">
            {recentInvoices.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">No recent invoices.</p>
            ) : (
              recentInvoices.map((inv) => (
                <div key={inv.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <Link href={`/invoices/${inv.id}`} className="font-bold text-slate-900 hover:underline">
                      {inv.invoiceNo}
                    </Link>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {inv.customerSnapshot.name} &bull; {formatDate(inv.invoiceDate)}
                    </div>
                  </div>
                  <span className="font-extrabold text-slate-900">
                    {formatCurrency(inv.grandTotal)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeActivityTab === "purchases" && (
          <div className="divide-y divide-slate-100">
            {recentPurchases.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">No recent purchases.</p>
            ) : (
              recentPurchases.map((pur) => (
                <div key={pur.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <Link href={`/purchases/${pur.id}`} className="font-bold text-slate-900 hover:underline">
                      {pur.purchaseNo}
                    </Link>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {pur.supplierName} &bull; {formatDate(pur.purchaseDate)}
                    </div>
                  </div>
                  <span className="font-extrabold text-slate-900">
                    {formatCurrency(pur.grandTotal)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeActivityTab === "expenses" && (
          <div className="divide-y divide-slate-100">
            {recentExpenses.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">No recent expenses.</p>
            ) : (
              recentExpenses.map((exp) => (
                <div key={exp.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-950">{exp.description}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 capitalize">
                      {CATEGORIES.find((c) => c.value === exp.category)?.label} &bull; {formatDate(exp.date)}
                    </div>
                  </div>
                  <span className="font-extrabold text-rose-600">
                    {formatCurrency(exp.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "flex-1 min-w-[90px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap",
            activeTab === "overview"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <BarChart3 className="h-4 w-4" />
          Overview
        </button>

        <button
          onClick={() => setActiveTab("profitability")}
          className={cn(
            "flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap",
            activeTab === "profitability"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Percent className="h-4 w-4" />
          Profitability
        </button>

        <button
          onClick={() => setActiveTab("leaderboards")}
          className={cn(
            "flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap",
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
            "flex-1 min-w-[80px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 whitespace-nowrap",
            activeTab === "recent"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Activity className="h-4 w-4" />
          Activity Log
        </button>
      </div>

      {/* Conditional Rendering based on selected tab */}
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
        {activeTab === "overview" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">{renderComparativeSalesTrend()}</div>
              <div>{renderTaxLiabilitySummary()}</div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {renderTopCustomers()}
              {renderTopProducts()}
            </div>
          </>
        )}

        {activeTab === "profitability" && renderProfitabilityAnalysis()}

        {activeTab === "leaderboards" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderTopCustomers()}
            {renderTopProducts()}
          </div>
        )}

        {activeTab === "recent" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderActivityLogs()}
            <div className="bg-slate-50 border border-slate-150 p-6 rounded-2xl flex flex-col justify-between items-center text-center text-slate-500">
              <div className="space-y-2 mt-4">
                <Receipt className="h-10 w-10 text-slate-300 mx-auto" />
                <h3 className="font-bold text-slate-900 text-sm">Printable Ledger Reports</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  View and export all transactions directly. Press <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Alt + Shift + 1-7</kbd> to quick-navigate.
                </p>
              </div>
              <div className="flex gap-2 w-full mt-8">
                <Link href="/invoices" className="flex-1 py-2 px-4 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-xl active:scale-95 transition-all">
                  Sales Ledger
                </Link>
                <Link href="/expenses" className="flex-1 py-2 px-4 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl active:scale-95 transition-all">
                  Expense Ledger
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
