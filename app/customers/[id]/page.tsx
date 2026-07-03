import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  ShoppingBag,
  Plus,
} from "lucide-react";
import { getCustomers, getInvoices } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";

export const revalidate = 0; // live reload

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  
  const customers = await getCustomers();
  const customer = customers.find((c) => c.id === id);
  
  if (!customer) {
    notFound();
  }

  const invoices = await getInvoices();
  // Filter invoices/quotations for this customer
  const customerInvoices = invoices.filter((inv) => inv.customerId === id);
  
  // Separate into real invoices and quotations
  const realInvoices = customerInvoices.filter((inv) => (inv.type || "invoice") === "invoice");
  const quotations = customerInvoices.filter((inv) => (inv.type || "invoice") === "quotation");

  // Calculations
  let totalBusiness = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;
  
  for (const inv of realInvoices) {
    if (inv.status !== "draft") {
      totalBusiness += inv.grandTotal;
      if (inv.status === "paid") {
        totalCollected += inv.grandTotal;
      } else {
        totalOutstanding += inv.grandTotal;
      }
    }
  }

  const collectionRate = totalBusiness > 0 ? (totalCollected / totalBusiness) * 100 : 0;

  // Monthly Sales Trajectory (Last 6 Months)
  const monthlySalesMap: Record<string, number> = {};
  const now = new Date();
  
  // Pre-populate last 6 months chronologically to ensure they always show up
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
    monthlySalesMap[key] = 0;
  }

  // Populate actual data
  for (const inv of realInvoices) {
    if (inv.status !== "draft") {
      const invDate = new Date(inv.invoiceDate);
      const key = invDate.toLocaleString("default", { month: "short", year: "2-digit" });
      // Only add to group if it lies within our trajectory map
      if (key in monthlySalesMap) {
        monthlySalesMap[key] += inv.grandTotal;
      }
    }
  }

  const monthlySales = Object.entries(monthlySalesMap).map(([month, amount]) => ({
    month,
    amount,
  }));

  // Max value for scaling monthly charts
  const maxMonthVal = Math.max(...monthlySales.map((m) => m.amount), 1000);

  // Top Products purchased by this customer
  const productPurchaseMap: Record<string, { name: string; quantity: number; total: number }> = {};
  for (const inv of realInvoices) {
    if (inv.status !== "draft") {
      for (const item of inv.lineItems) {
        const pId = item.productId || item.description;
        if (!productPurchaseMap[pId]) {
          productPurchaseMap[pId] = { name: item.description, quantity: 0, total: 0 };
        }
        productPurchaseMap[pId].quantity += item.quantity;
        productPurchaseMap[pId].total += item.amount;
      }
    }
  }

  const topProducts = Object.values(productPurchaseMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/customers"
            className="p-2 bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-colors shadow-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              {customer.name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Customer ID: <span className="font-mono text-[10px] bg-slate-105 px-1 py-0.5 rounded">{customer.id}</span>
            </p>
          </div>
        </div>

        {/* Header Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/invoices/new?customerId=${customer.id}`}
            className="inline-flex items-center justify-center gap-2 bg-indigo-650 hover:bg-indigo-755 text-white font-semibold px-4 py-2 rounded-xl transition-all duration-150 active:scale-95 text-xs shadow-md shadow-indigo-600/10"
          >
            <Plus className="h-3.5 w-3.5" />
            New Sale / Quotation
          </Link>
        </div>
      </div>

      {/* Customer 360 Core Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Column: Customer Profile Profile */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
              Business Profile
            </h3>
            
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Company Name
                </span>
                <span className="text-sm font-bold text-slate-800">{customer.name}</span>
              </div>

              {customer.gstin && (
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    GSTIN
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {customer.gstin}
                  </span>
                </div>
              )}

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Place of Supply (State)
                </span>
                <span className="text-xs font-semibold text-slate-700">
                  {customer.stateCode} - {customer.state}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
              Contact Details
            </h3>

            <div className="space-y-3.5">
              <div className="flex items-center gap-3 text-slate-650">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                  <Phone className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs">
                  <span className="text-[9px] text-slate-450 block font-semibold">Phone</span>
                  {customer.phone ? (
                    <a href={`tel:${customer.phone}`} className="font-bold text-slate-800 hover:text-indigo-600">
                      {customer.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">Not Provided</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-650">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                  <Mail className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs">
                  <span className="text-[9px] text-slate-455 block font-semibold">Email</span>
                  {customer.email ? (
                    <a href={`mailto:${customer.email}`} className="font-bold text-slate-800 hover:text-indigo-600">
                      {customer.email}
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">Not Provided</span>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 text-slate-655">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-400 mt-0.5">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs">
                  <span className="text-[9px] text-slate-455 block font-semibold">Billing Address</span>
                  <span className="text-slate-700 font-medium leading-relaxed block">
                    {[customer.address, customer.city].filter(Boolean).join(", ") || "No Address Provided"}
                    {customer.pincode ? ` - ${customer.pincode}` : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Analytics metrics and graphs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Lifetime Business
                </span>
                <span className="text-base font-extrabold text-slate-900 mt-0.5 block">
                  {formatCurrency(totalBusiness)}
                </span>
                <span className="text-[9px] text-slate-450 mt-0.5 block">
                  From {realInvoices.length} billing documents
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Collected
                </span>
                <span className="text-base font-extrabold text-slate-900 mt-0.5 block">
                  {formatCurrency(totalCollected)}
                </span>
                <span className="text-[9px] text-emerald-600 font-bold mt-0.5 block">
                  {collectionRate.toFixed(1)}% Realization Rate
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Outstanding Due
                </span>
                <span className="text-base font-extrabold text-slate-900 mt-0.5 block">
                  {formatCurrency(totalOutstanding)}
                </span>
                <span className="text-[9px] text-rose-600 font-bold mt-0.5 block">
                  Requires collection action
                </span>
              </div>
            </div>
          </div>

          {/* Monthly Trajectory & Top Products */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Monthly sales chart card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Monthly Trajectory (INR)
                </h3>
              </div>
              
              <div className="h-44 flex items-end gap-3.5 pt-6 px-2">
                {monthlySales.map((item) => {
                  const pct = (item.amount / maxMonthVal) * 100;
                  return (
                    <div key={item.month} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                      <div className="relative w-full flex justify-center">
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-1.5 hidden group-hover:block bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow whitespace-nowrap z-10">
                          {formatCurrency(item.amount)}
                        </div>
                      </div>
                      <div 
                        style={{ height: `${Math.max(pct, 2)}%` }}
                        className={`w-full rounded-t-lg transition-all duration-350 cursor-pointer ${
                          item.amount > 0 
                            ? "bg-indigo-600 group-hover:bg-indigo-700 shadow-md shadow-indigo-600/10" 
                            : "bg-slate-100"
                        }`}
                      />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight shrink-0">
                        {item.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top purchased products card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Top Products Purchased
              </h3>

              {topProducts.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <ShoppingBag className="h-10 w-10 text-slate-200 mb-2" />
                  No item sales logged yet
                </div>
              ) : (
                <div className="space-y-3.5">
                  {topProducts.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 text-xs border-b border-slate-50 pb-2.5 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800 truncate block">
                          {p.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          Quantity purchased: {p.quantity} units
                        </span>
                      </div>
                      <span className="font-extrabold text-slate-900 text-right shrink-0">
                        {formatCurrency(p.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Ledger Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Customer Ledger & Quotations
            </h2>
            <p className="text-xs text-slate-450 mt-0.5">
              Chronological log of invoices and quotations generated for this business profile.
            </p>
          </div>
        </div>

        {customerInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <FileSpreadsheet className="h-10 w-10 text-slate-200 mb-3" />
            <p className="font-bold text-slate-500 text-sm">No transaction records found</p>
            <p className="text-xs mt-1">Create an invoice or quotation above to start log ledger.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-slate-600 min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Document No</th>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Type</th>
                  <th className="py-3 px-5 text-right">Taxable Value</th>
                  <th className="py-3 px-5 text-right">Grand Total</th>
                  <th className="py-3 px-5">Payment Status</th>
                  <th className="py-3 px-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {customerInvoices
                  .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
                  .map((inv) => {
                    const isQuote = (inv.type || "invoice") === "quotation";
                    
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-slate-900">
                          {inv.invoiceNo}
                        </td>
                        <td className="py-3.5 px-5 text-slate-500">
                          {formatDate(inv.invoiceDate)}
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isQuote
                                ? "bg-amber-50 text-amber-705 border border-amber-100"
                                : "bg-indigo-50 text-indigo-705 border border-indigo-100"
                            }`}
                          >
                            {isQuote ? "Quotation" : "Tax Invoice"}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right font-semibold text-slate-700">
                          {formatCurrency(inv.taxableValueTotal)}
                        </td>
                        <td className="py-3.5 px-5 text-right font-extrabold text-slate-900">
                          {formatCurrency(inv.grandTotal)}
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              inv.status === "paid"
                                ? "bg-emerald-50 text-emerald-705 border-emerald-100"
                                : inv.status === "sent"
                                ? "bg-blue-50 text-blue-705 border-blue-100"
                                : inv.status === "overdue"
                                ? "bg-rose-50 text-rose-705 border-rose-100"
                                : "bg-slate-50 text-slate-605 border-slate-100"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                inv.status === "paid"
                                  ? "bg-emerald-600"
                                  : inv.status === "sent"
                                  ? "bg-blue-500"
                                  : inv.status === "overdue"
                                  ? "bg-rose-500"
                                  : "bg-slate-500"
                              }`}
                            />
                            {inv.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                              title="View Document Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                            <a
                              href={`/api/invoices/${inv.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                              title="Download PDF Invoice"
                            >
                              <Download className="h-3.5 w-3.5 text-indigo-650" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
