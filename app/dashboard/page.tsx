import React from "react";
import Link from "next/link";
import {
  Plus,
  TrendingUp,
  AlertCircle,
  IndianRupee,
  FileText,
} from "lucide-react";
import { getInvoices, getCustomers, getProducts } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import DashboardTabs from "@/components/DashboardTabs";

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
      
      // Monthly grouping using locale-independent YYYY-MM key
      const monthKey = inv.invoiceDate.substring(0, 7); // "YYYY-MM"
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

  // Build last 6 months list chronologically using standard date math and manual formatting
  const last6Months: { label: string; amount: number }[] = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1); // avoid end-of-month rollover bug
    d.setMonth(d.getMonth() - i);
    
    const year = d.getFullYear();
    const monthNum = String(d.getMonth() + 1).padStart(2, "0");
    const year2Digit = String(year).slice(-2);
    
    const key = `${year}-${monthNum}`; // e.g. "2026-07"
    const label = `${monthNames[d.getMonth()]} ${year2Digit}`; // e.g. "Jul 26"
    
    last6Months.push({
      label,
      amount: monthlySalesMap[key] || 0
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
    <div className="space-y-6 sm:space-y-8 pb-12">
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

      {/* Stats Grid - 2x2 on Mobile, 1x4 on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Billed This Month */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-slate-500">Billed This Month</span>
            <div className="p-1.5 sm:p-2.5 bg-indigo-50 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform duration-200">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <h3 className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              {formatCurrency(totalBilledThisMonth)}
            </h3>
            <p className="text-[9px] sm:text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              Active sales
            </p>
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-slate-500">Outstanding Balance</span>
            <div className="p-1.5 sm:p-2.5 bg-amber-50 rounded-xl text-amber-600 group-hover:scale-110 transition-transform duration-200">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <h3 className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              {formatCurrency(totalOutstanding)}
            </h3>
            <p className="text-[9px] sm:text-[11px] text-amber-600 font-bold mt-1">
              {invoices.filter(i => i.status === "sent" || i.status === "overdue").length} Pending
            </p>
          </div>
        </div>

        {/* GST Tax Collected */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-slate-500">GST Tax Liability</span>
            <div className="p-1.5 sm:p-2.5 bg-red-50 rounded-xl text-red-600 group-hover:scale-110 transition-transform duration-200">
              <IndianRupee className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <h3 className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              {formatCurrency(totalTax)}
            </h3>
            <p className="text-[9px] sm:text-[11px] text-slate-400 mt-1">Total CGST+SGST+IGST</p>
          </div>
        </div>

        {/* Active Transactions */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-slate-500">Active Invoices</span>
            <div className="p-1.5 sm:p-2.5 bg-emerald-50 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform duration-200">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4">
            <h3 className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              {activeInvoicesCount}
            </h3>
            <p className="text-[9px] sm:text-[11px] text-slate-400 mt-1">Excludes drafts</p>
          </div>
        </div>
      </div>

      {/* Tabs / Grids Container */}
      <DashboardTabs
        last6Months={last6Months}
        maxMonthlySales={maxMonthlySales}
        totalTaxableValue={totalTaxableValue}
        totalCgst={totalCgst}
        totalSgst={totalSgst}
        totalIgst={totalIgst}
        totalTax={totalTax}
        topCustomers={topCustomers}
        maxCustomerSales={maxCustomerSales}
        topProducts={topProducts}
        maxProductQty={maxProductQty}
        recentInvoices={recentInvoices}
      />
    </div>
  );
}
