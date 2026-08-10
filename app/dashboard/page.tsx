import React from "react";
import Link from "next/link";
import {
  Plus,
  TrendingUp,
  AlertCircle,
  IndianRupee,
  ShoppingCart,
  TrendingDown,
} from "lucide-react";
import { getInvoices, getCustomers, getProducts, getPurchases, getExpenses, getTrips } from "@/lib/db";
import { ownShare } from "@/lib/trip-calculations";
import { formatCurrency, cn } from "@/lib/utils";
import DashboardTabs from "@/components/DashboardTabs";

export const revalidate = 0; // Disable caching so it stays live

export default async function DashboardPage() {
  const invoices = await getInvoices();
  const customers = await getCustomers();
  const products = await getProducts();
  const purchases = await getPurchases();
  const expenses = await getExpenses();
  const trips = await getTrips();

  // Statistics calculations
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let totalOutstanding = 0;
  let totalBilledThisMonth = 0;
  let activeInvoicesCount = 0;

  let totalPurchasesThisMonth = 0;
  let totalPurchaseTax = 0;

  let totalExpensesThisMonth = 0;
  let totalExpenseTax = 0;

  // 1. GSTR Tax liability totals
  let totalTaxableValue = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalTax = 0;

  // Monthly grouping maps
  const monthlySalesMap: Record<string, number> = {};
  const monthlyPurchasesMap: Record<string, number> = {};
  const monthlyExpensesMap: Record<string, number> = {};

  // 2. Customer Contribution
  const customerSalesMap: Record<string, { name: string; total: number; count: number }> = {};

  // 3. Product Sales Leaderboard
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

      // Monthly grouping
      const monthKey = inv.invoiceDate.substring(0, 7); // "YYYY-MM"
      monthlySalesMap[monthKey] = (monthlySalesMap[monthKey] || 0) + inv.grandTotal;

      // Customer grouping
      const cId = inv.customerId;
      if (!customerSalesMap[cId]) {
        customerSalesMap[cId] = { name: inv.customerSnapshot.name, total: 0, count: 0 };
      }
      customerSalesMap[cId].total += inv.grandTotal;
      customerSalesMap[cId].count += 1;

      // Product grouping
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

  for (const pur of purchases) {
    const purDate = new Date(pur.purchaseDate);
    if (purDate.getMonth() === currentMonth && purDate.getFullYear() === currentYear) {
      totalPurchasesThisMonth += pur.grandTotal;
    }
    totalPurchaseTax += (pur.cgstTotal + pur.sgstTotal + pur.igstTotal);

    const monthKey = pur.purchaseDate.substring(0, 7);
    monthlyPurchasesMap[monthKey] = (monthlyPurchasesMap[monthKey] || 0) + pur.grandTotal;
  }

  const expenseCategoriesMap: Record<string, number> = {};
  for (const exp of expenses) {
    const expDate = new Date(exp.date);
    if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
      totalExpensesThisMonth += exp.amount;
    }
    totalExpenseTax += (exp.gstAmount || 0);

    const monthKey = exp.date.substring(0, 7);
    monthlyExpensesMap[monthKey] = (monthlyExpensesMap[monthKey] || 0) + exp.amount;

    expenseCategoriesMap[exp.category] = (expenseCategoriesMap[exp.category] || 0) + exp.amount;
  }

  // Trips contribute only our own split share — 13,550 of a 27,100 trip, not the whole
  // figure. Trips live outside the expenses collection, so nothing here double-counts.
  // The share lands in the month the trip started: trips run for days and rarely straddle
  // a month boundary, so per-item attribution is not worth the complexity.
  for (const trip of trips) {
    const share = ownShare(trip);
    if (share === 0) continue;

    const tripDate = new Date(trip.startDate);
    if (tripDate.getMonth() === currentMonth && tripDate.getFullYear() === currentYear) {
      totalExpensesThisMonth += share;
    }

    const monthKey = trip.startDate.substring(0, 7);
    monthlyExpensesMap[monthKey] = (monthlyExpensesMap[monthKey] || 0) + share;

    // Section names are free text, so trips roll up under the existing travel category
    // rather than scattering the breakdown with one-off labels.
    expenseCategoriesMap["travel"] = (expenseCategoriesMap["travel"] || 0) + share;
  }

  // Net GST Liability = Collected GST - (Paid Purchases GST + Paid Expenses GST)
  const netGstLiability = totalTax - (totalPurchaseTax + totalExpenseTax);

  // Compute MoM percentage changes
  const thisMonthStr = String(currentMonth + 1).padStart(2, "0");
  const thisMonthKey = `${currentYear}-${thisMonthStr}`;

  const lastMonthDate = new Date();
  lastMonthDate.setDate(1);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthStr = String(lastMonthDate.getMonth() + 1).padStart(2, "0");
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${lastMonthStr}`;

  const thisMonthSales = monthlySalesMap[thisMonthKey] || 0;
  const lastMonthSales = monthlySalesMap[lastMonthKey] || 0;
  const salesMoM = lastMonthSales === 0 ? (thisMonthSales > 0 ? 100 : 0) : ((thisMonthSales - lastMonthSales) / lastMonthSales) * 100;

  const thisMonthPurchases = monthlyPurchasesMap[thisMonthKey] || 0;
  const lastMonthPurchases = monthlyPurchasesMap[lastMonthKey] || 0;
  const purchasesMoM = lastMonthPurchases === 0 ? (thisMonthPurchases > 0 ? 100 : 0) : ((thisMonthPurchases - lastMonthPurchases) / lastMonthPurchases) * 100;

  const thisMonthExpenses = monthlyExpensesMap[thisMonthKey] || 0;
  const lastMonthExpenses = monthlyExpensesMap[lastMonthKey] || 0;
  const expensesMoM = lastMonthExpenses === 0 ? (thisMonthExpenses > 0 ? 100 : 0) : ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;

  // Build last 6 months comparative dataset
  const monthlyData: { label: string; sales: number; purchases: number; expenses: number }[] = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);

    const year = d.getFullYear();
    const monthNum = String(d.getMonth() + 1).padStart(2, "0");
    const year2Digit = String(year).slice(-2);

    const key = `${year}-${monthNum}`;
    const label = `${monthNames[d.getMonth()]} ${year2Digit}`;

    monthlyData.push({
      label,
      sales: monthlySalesMap[key] || 0,
      purchases: monthlyPurchasesMap[key] || 0,
      expenses: monthlyExpensesMap[key] || 0,
    });
  }

  // Find max value in monthly data for scaling
  const maxVal = Math.max(
    ...monthlyData.map((d) => Math.max(d.sales, d.purchases, d.expenses)),
    5000
  );

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

  // Profitability Analysis
  const totalSales = invoices.filter((i) => i.status !== "draft").reduce((acc, curr) => acc + curr.grandTotal, 0);
  const totalPurchases = purchases.reduce((acc, curr) => acc + curr.grandTotal, 0);
  const totalExpenses =
    expenses.reduce((acc, curr) => acc + curr.amount, 0) +
    trips.reduce((acc, curr) => acc + ownShare(curr), 0);
  const operatingProfit = totalSales - (totalPurchases + totalExpenses);
  const profitMarginPercent = totalSales === 0 ? 0 : (operatingProfit / totalSales) * 100;

  // Expenses Breakdown
  const totalExpenseSum = Object.values(expenseCategoriesMap).reduce((a, b) => a + b, 0);
  const expenseCategoriesBreakdown = Object.entries(expenseCategoriesMap).map(([cat, amt]) => ({
    category: cat,
    amount: amt,
    percent: totalExpenseSum === 0 ? 0 : (amt / totalExpenseSum) * 100,
  })).sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Financial analytics, cash flows, tax credit summaries, and ledger comparison charts.
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-xs self-start sm:self-auto animate-fade-in"
        >
          <Plus className="h-4.5 w-4.5" />
          New Invoice
        </Link>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Sales Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Sales This Month</span>
            <div className="p-1.5 sm:p-2 bg-indigo-50 rounded-lg text-indigo-650 group-hover:scale-110 transition-transform duration-200 shrink-0">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <h3 className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">
              {formatCurrency(totalBilledThisMonth)}
            </h3>
            <p className={cn(
              "text-[8px] sm:text-[10px] font-bold mt-1 sm:mt-1.5 flex items-center gap-0.5 sm:gap-1",
              salesMoM >= 0 ? "text-emerald-600" : "text-rose-500"
            )}>
              {salesMoM >= 0 ? "+" : ""}{salesMoM.toFixed(1)}% MoM
            </p>
          </div>
        </div>

        {/* Purchases Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Purchased</span>
            <div className="p-1.5 sm:p-2 bg-emerald-50 rounded-lg text-emerald-600 group-hover:scale-110 transition-transform duration-200 shrink-0">
              <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <h3 className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">
              {formatCurrency(totalPurchasesThisMonth)}
            </h3>
            <p className={cn(
              "text-[8px] sm:text-[10px] font-bold mt-1 sm:mt-1.5 flex items-center gap-0.5 sm:gap-1",
              purchasesMoM <= 0 ? "text-emerald-600" : "text-amber-500"
            )}>
              {purchasesMoM >= 0 ? "+" : ""}{purchasesMoM.toFixed(1)}% MoM
            </p>
          </div>
        </div>

        {/* Expenses Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Expenses</span>
            <div className="p-1.5 sm:p-2 bg-rose-50 rounded-lg text-rose-600 group-hover:scale-110 transition-transform duration-200 shrink-0">
              <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <h3 className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">
              {formatCurrency(totalExpensesThisMonth)}
            </h3>
            <p className={cn(
              "text-[8px] sm:text-[10px] font-bold mt-1 sm:mt-1.5 flex items-center gap-0.5 sm:gap-1",
              expensesMoM <= 0 ? "text-emerald-600" : "text-rose-500"
            )}>
              {expensesMoM >= 0 ? "+" : ""}{expensesMoM.toFixed(1)}% MoM
            </p>
          </div>
        </div>

        {/* Net GST Liability */}
        <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
          <div className="flex items-center justify-between">
            <span className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">Net GST Due</span>
            <div className={cn(
              "p-1.5 sm:p-2 rounded-lg group-hover:scale-110 transition-transform shrink-0",
              netGstLiability >= 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
            )}>
              <IndianRupee className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3">
            <h3 className="text-sm sm:text-xl lg:text-2xl font-black text-slate-900 tracking-tight truncate">
              {formatCurrency(Math.abs(netGstLiability))}
            </h3>
            <p className={cn(
              "text-[8px] sm:text-[10px] font-bold mt-1 sm:mt-1.5 truncate",
              netGstLiability >= 0 ? "text-rose-600" : "text-emerald-600"
            )} title={netGstLiability >= 0 ? "To Pay (Sales > Purchase ITC)" : "Excess ITC Credit Claimable"}>
              {netGstLiability >= 0 ? "To Pay (Sales > ITC)" : "Excess ITC Credit"}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Container */}
      <DashboardTabs
        monthlyData={monthlyData}
        maxVal={maxVal}
        totalTaxableValue={totalTaxableValue}
        totalCgst={totalCgst}
        totalSgst={totalSgst}
        totalIgst={totalIgst}
        totalTax={totalTax}
        
        totalExpenses={totalExpenses}
        totalExpenseGst={totalExpenseTax}
        netGstLiability={netGstLiability}
        operatingProfit={operatingProfit}
        profitMarginPercent={profitMarginPercent}
        expenseCategoriesBreakdown={expenseCategoriesBreakdown}

        topCustomers={topCustomers}
        maxCustomerSales={maxCustomerSales}
        topProducts={topProducts}
        maxProductQty={maxProductQty}
        recentInvoices={invoices.slice(0, 5)}
        recentPurchases={purchases.slice(0, 5)}
        recentExpenses={expenses.slice(0, 5)}
      />
    </div>
  );
}
