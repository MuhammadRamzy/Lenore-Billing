import React from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Users,
  Package,
  Plus,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  IndianRupee,
  FileText,
  BarChart3,
  PieChart,
  ArrowUpRight,
} from "lucide-react";
import { getInvoices, getCustomers, getProducts } from "@/lib/db";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

export const revalidate = 0; // Disable caching so it stays live

export default async function DashboardPage() {
  const invoices = await getInvoices();
  const customers = await getCustomers();
  const products = await getProducts();

  // Statistics calculations
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalOutstanding = 0;
  let totalBilledThisMonth = 0;
  let activeInvoicesCount = 0;

  // 1. GSTR-1 Tax liability totals
  let totalTaxableValue = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalTax = 0;
  
  // 2. Sales Trend by Month
  const monthlySalesMap: Record<string, number> = {};
  
  // 3. Customer Contribution
  const customerSalesMap: Record<string, { name: string; total: number; count: number }> = {};
  
  // 4. Product Sales Leaderboard
  const productSalesMap: Record<string, { name: string; quantity: number; total: number }> = {};

  for (const inv of invoices) {
    const invDate = new Date(inv.invoiceDate);
    
    // Total Outstanding: sent or overdue
    if (inv.status === "sent" || inv.status === "overdue") {
      totalOutstanding += inv.grandTotal;
    }

    // Total Billed this month
    if (invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear) {
      totalBilledThisMonth += inv.grandTotal;
    }

    if (inv.status !== "draft") {
      activeInvoicesCount++;
      // GSTR totals
      totalTaxableValue += inv.taxableValueTotal;
      totalCgst += inv.cgstTotal;
      totalSgst += inv.sgstTotal;
      totalIgst += inv.igstTotal;
      totalTax += (inv.cgstTotal + inv.sgstTotal + inv.igstTotal);
      
      // Monthly grouping (e.g. "Jul 26")
      const monthKey = invDate.toLocaleString("default", { month: "short", year: "2-digit" });
      monthlySalesMap[monthKey] = (monthlySalesMap[monthKey] || 0) + inv.grandTotal;
      
      // Customer grouping
      const cId = inv.customerId;
      if (!customerSalesMap[cId]) {
        customerSalesMap[cId] = { name: inv.customerSnapshot.name, total: 0, count: 0 };
      }
      customerSalesMap[cId].total += inv.grandTotal;
      customerSalesMap[cId].count += 1;
      
      // Product grouping from items
      for (const item of inv.lineItems) {
        const pId = item.productId || item.description;
        if (!productSalesMap[pId]) {
          productSalesMap[pId] = { name: item.description, quantity: 0, total: 0 };
        }
        productSalesMap[pId].quantity += item.quantity;
        productSalesMap[pId].total += item.amount;
      }
    }
  }

  // Build last 6 months list chronologically
  const last6Months: { label: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
    last6Months.push({
      label,
      amount: monthlySalesMap[label] || 0
    });
  }

  // Find max monthly sales for scaling the chart
  const maxMonthlySales = Math.max(...last6Months.map(m => m.amount), 5000);

  // Top Customers list (sorted)
  const topCustomers = Object.values(customerSalesMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const maxCustomerSales = topCustomers[0]?.total || 1;

  // Top Products list (sorted)
  const topProducts = Object.values(productSalesMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const maxProductQty = topProducts[0]?.quantity || 1;

  // Get recent 5 invoices
  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time analytics, tax summaries, and customer behavior reports.
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-150 hover:shadow-indigo-600/20 active:scale-95 text-sm self-start sm:self-auto animate-fade-in"
        >
          <Plus className="h-5 w-5" />
          New Invoice
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Billed This Month */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Billed This Month</span>
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform duration-200">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {formatCurrency(totalBilledThisMonth)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              Active sales invoice value
            </p>
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Outstanding Balance</span>
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 group-hover:scale-110 transition-transform duration-200">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {formatCurrency(totalOutstanding)}
            </h3>
            <p className="text-[11px] text-amber-600 font-bold mt-1">
              {invoices.filter(i => i.status === "sent" || i.status === "overdue").length} Pending Invoices
            </p>
          </div>
        </div>

        {/* GST Tax Collected */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">GST Tax Liability</span>
            <div className="p-2.5 bg-red-50 rounded-xl text-red-600 group-hover:scale-110 transition-transform duration-200">
              <IndianRupee className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {formatCurrency(totalTax)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Total CGST + SGST + IGST</p>
          </div>
        </div>

        {/* Active Transactions */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Active Invoices</span>
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform duration-200">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {activeInvoicesCount}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Excludes invoice drafts</p>
          </div>
        </div>
      </div>

      {/* Analytics Charts & Behavior Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 6-Month Sales Trend */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              Monthly Sales Trend
            </h2>
            <span className="text-xs font-bold text-slate-400">Last 6 Months (INR)</span>
          </div>

          {/* Simple responsive SVG chart */}
          <div className="relative pt-4 w-full h-[200px] flex items-end">
            <div className="absolute inset-y-0 left-0 w-full flex flex-col justify-between pointer-events-none border-b border-slate-100 pb-8 pt-4">
              <div className="w-full border-t border-slate-100/80"></div>
              <div className="w-full border-t border-slate-100/80"></div>
              <div className="w-full border-t border-slate-100/80"></div>
            </div>

            <div className="relative z-10 w-full h-full flex items-end justify-between px-2 sm:px-6">
              {last6Months.map((m, idx) => {
                const heightPercent = m.amount > 0 ? Math.max((m.amount / maxMonthlySales) * 80, 5) : 2; // scale max bar to 80% height
                return (
                  <div key={idx} className="flex flex-col items-center flex-1 group">
                    {/* Tooltip value */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded absolute -translate-y-9 shadow-md z-20 pointer-events-none font-mono">
                      {formatCurrency(m.amount)}
                    </div>
                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-8 sm:w-12 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg transition-all duration-500 hover:from-indigo-500 hover:to-indigo-300 shadow-sm"
                    />
                    {/* Label */}
                    <span className="text-[10px] font-bold text-slate-500 mt-2 tracking-tight">
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* GST Liability Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-indigo-500" />
            Tax Liability Summary
          </h2>

          <div className="space-y-4 pt-2">
            {/* Taxable vs Tax Value */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Total Taxable Value:</span>
                <span className="font-bold text-slate-800">{formatCurrency(totalTaxableValue)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Total CGST collected:</span>
                <span className="font-bold text-slate-800">{formatCurrency(totalCgst)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Total SGST collected:</span>
                <span className="font-bold text-slate-800">{formatCurrency(totalSgst)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">Total IGST collected:</span>
                <span className="font-bold text-slate-800">{formatCurrency(totalIgst)}</span>
              </div>
            </div>

            {/* Total GST Progress bar style */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">GST Contribution</span>
                <span className="font-bold text-slate-900">{formatCurrency(totalTax)}</span>
              </div>
              {/* Progress split */}
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
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
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" /> CGST</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" /> SGST</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> IGST</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer & Product Behavior Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Contributing Customers */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
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
                      <span className="text-slate-800 truncate max-w-xs">{c.name}</span>
                      <span className="text-slate-900 font-bold font-mono">{formatCurrency(c.total)}</span>
                    </div>
                    <div className="relative">
                      <div className="h-2 w-full bg-slate-50 rounded-full border border-slate-100 overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-300"
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

        {/* Top Selling Products */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-500" />
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
                      <span className="text-slate-800 truncate max-w-xs">{p.name}</span>
                      <span className="text-slate-900 font-bold font-mono">{p.quantity} Units</span>
                    </div>
                    <div className="relative">
                      <div className="h-2 w-full bg-slate-50 rounded-full border border-slate-100 overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-full transition-all duration-300"
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
      </div>

      {/* Recent Invoices list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-500" />
            Recent Invoices
          </h2>
          <Link
            href="/invoices"
            className="text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            View All Invoices &rarr;
          </Link>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <FileSpreadsheet className="h-12 w-12 text-slate-200 mb-3" />
            <p className="font-semibold text-slate-500">No invoices generated yet</p>
            <p className="text-xs mt-1">Click the &quot;New Invoice&quot; button to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-5">Invoice No.</th>
                  <th className="py-3.5 px-5">Customer</th>
                  <th className="py-3.5 px-5 hidden sm:table-cell">Date</th>
                  <th className="py-3.5 px-5 text-right">Amount</th>
                  <th className="py-3.5 px-5 text-center">Status</th>
                  <th className="py-3.5 px-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-5 font-bold text-slate-900">{inv.invoiceNo}</td>
                    <td className="py-4 px-5">
                      <div className="font-medium text-slate-800">{inv.customerSnapshot.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 sm:hidden">
                        {formatDate(inv.invoiceDate)}
                      </div>
                    </td>
                    <td className="py-4 px-5 hidden sm:table-cell">{formatDate(inv.invoiceDate)}</td>
                    <td className="py-4 px-5 text-right font-bold text-slate-900">
                      {formatCurrency(inv.grandTotal)}
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
                          inv.status === "paid" && "bg-emerald-50 text-emerald-700",
                          inv.status === "sent" && "bg-amber-50 text-amber-700",
                          inv.status === "draft" && "bg-slate-100 text-slate-700",
                          inv.status === "overdue" && "bg-rose-50 text-rose-700"
                        )}
                      >
                        {inv.status === "paid" && <CheckCircle2 className="h-3 w-3" />}
                        {inv.status === "sent" && <Clock className="h-3 w-3" />}
                        {inv.status === "overdue" && <AlertCircle className="h-3 w-3" />}
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="text-xs font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 px-3 py-1.5 rounded-lg transition-colors inline-block"
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
    </div>
  );
}
