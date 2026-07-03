"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { Invoice, Customer } from "@/lib/types";
import { formatCurrency, formatDate, cn, exportToCsv } from "@/lib/utils";
import { deleteInvoiceAction } from "@/app/actions";

interface InvoicesListProps {
  initialInvoices: Invoice[];
  customers: Customer[];
}

const ITEMS_PER_PAGE = 20;

export default function InvoicesList({ initialInvoices, customers }: InvoicesListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Advanced filter states
  const [amountFilter, setAmountFilter] = useState<"all" | "under_10k" | "10k_50k" | "over_50k">("all");
  const [gstFilter, setGstFilter] = useState<"all" | "gst" | "simple">("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "invoice_no">("date_desc");

  // Filter invoices based on inputs
  const filteredInvoices = invoices.filter((inv) => {
    // 1. Search Query (invoice number or customer name)
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      inv.invoiceNo.toLowerCase().includes(q) ||
      inv.customerSnapshot.name.toLowerCase().includes(q);

    // 2. Status filter
    const matchesStatus = selectedStatus === "all" || inv.status === selectedStatus;

    // 2b. Document type filter
    const matchesType = selectedType === "all" || (inv.type || "invoice") === selectedType;

    // 3. Customer filter
    const matchesCustomer =
      selectedCustomerId === "all" || inv.customerId === selectedCustomerId;

    // 4. Date filter
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(inv.invoiceDate) >= new Date(startDate);
    }
    if (endDate) {
      // Set end date to end of day to include the date fully
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(inv.invoiceDate) <= endOfDay;
    }

    // 5. Amount Filter
    let matchesAmount = true;
    const total = inv.grandTotal;
    if (amountFilter === "under_10k") {
      matchesAmount = total < 10000;
    } else if (amountFilter === "10k_50k") {
      matchesAmount = total >= 10000 && total <= 50000;
    } else if (amountFilter === "over_50k") {
      matchesAmount = total > 50000;
    }

    // 6. GST Filter
    let matchesGst = true;
    if (gstFilter === "gst") {
      matchesGst = inv.isGstInvoice;
    } else if (gstFilter === "simple") {
      matchesGst = !inv.isGstInvoice;
    }

    return matchesQuery && matchesStatus && matchesType && matchesCustomer && matchesDate && matchesAmount && matchesGst;
  }).sort((a, b) => {
    if (sortBy === "date_desc") {
      return new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
    } else if (sortBy === "date_asc") {
      return new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime();
    } else if (sortBy === "amount_desc") {
      return b.grandTotal - a.grandTotal;
    } else if (sortBy === "amount_asc") {
      return a.grandTotal - b.grandTotal;
    } else if (sortBy === "invoice_no") {
      return a.invoiceNo.localeCompare(b.invoiceNo);
    }
    return 0;
  });

  // Pagination calculations
  const totalItems = filteredInvoices.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, selectedType, selectedCustomerId, startDate, endDate, amountFilter, gstFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedStatus("all");
    setSelectedType("all");
    setSelectedCustomerId("all");
    setStartDate("");
    setEndDate("");
    setAmountFilter("all");
    setGstFilter("all");
    setSortBy("date_desc");
  };

  // Delete Action
  const handleDelete = async (id: string, no: string) => {
    if (confirm(`Are you sure you want to permanently delete and remove invoice "${no}"?`)) {
      try {
        await deleteInvoiceAction(id);
        setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      } catch (err: any) {
        alert(err.message || "Failed to delete invoice.");
      }
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ["Document Type", "No", "Customer Name", "Date", "GST Registered", "Taxable Value", "CGST", "SGST", "IGST", "Grand Total", "Status"];
    const rows = filteredInvoices.map((inv) => [
      inv.type === "quotation" ? "Quotation" : "Invoice",
      inv.invoiceNo,
      inv.customerSnapshot.name,
      inv.invoiceDate,
      inv.isGstInvoice ? "YES" : "NO",
      inv.taxableValueTotal.toString(),
      inv.cgstTotal.toString(),
      inv.sgstTotal.toString(),
      inv.igstTotal.toString(),
      inv.grandTotal.toString(),
      inv.status,
    ]);
    exportToCsv("lenore_invoices_ledger.csv", headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Invoices
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse transaction logs, print invoices, and export sales ledger sheets.
          </p>
        </div>
        
        {/* Header Actions */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition-all duration-150 active:scale-95 text-xs"
            title="Download Invoice Ledger CSV"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export Ledger
          </button>
          
          <Link
            href="/invoices/new"
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-150 active:scale-95 text-sm"
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </Link>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        {/* Search */}
        <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus-within:border-indigo-500 transition-colors">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by invoice number or customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm focus:outline-none placeholder-slate-400 text-slate-800"
          />
        </div>

        {/* Multi-Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
          {/* Customer filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Filter by Customer
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-700 cursor-pointer"
            >
              <option value="all">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Document Type filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Document Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-700 cursor-pointer"
            >
              <option value="all">All Documents</option>
              <option value="invoice">Tax Invoices</option>
              <option value="quotation">Quotations</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Payment Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-700 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent / Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none transition-colors text-slate-700 cursor-pointer"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none transition-colors text-slate-700 cursor-pointer"
            />
          </div>

          {/* Amount Bracket */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Amount Range
            </label>
            <select
              value={amountFilter}
              onChange={(e: any) => setAmountFilter(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-700 cursor-pointer"
            >
              <option value="all">All Amounts</option>
              <option value="under_10k">Under ₹10,000</option>
              <option value="10k_50k">₹10,000 - ₹50,000</option>
              <option value="over_50k">Over ₹50,000</option>
            </select>
          </div>

          {/* Billing Type */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Tax Invoice Type
            </label>
            <select
              value={gstFilter}
              onChange={(e: any) => setGstFilter(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-700 cursor-pointer"
            >
              <option value="all">All Invoices</option>
              <option value="gst">GST Invoices Only</option>
              <option value="simple">Simple Invoices Only</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-700 cursor-pointer"
            >
              <option value="date_desc">Date (Newest First)</option>
              <option value="date_asc">Date (Oldest First)</option>
              <option value="amount_desc">Amount (High to Low)</option>
              <option value="amount_asc">Amount (Low to High)</option>
              <option value="invoice_no">Invoice Number</option>
            </select>
          </div>
        </div>

        {/* Clear Filters helper */}
        {(selectedStatus !== "all" ||
          selectedType !== "all" ||
          selectedCustomerId !== "all" ||
          startDate ||
          endDate ||
          amountFilter !== "all" ||
          gstFilter !== "all" ||
          searchQuery) && (
          <div className="flex justify-end pt-2 border-t border-slate-50">
            <button
              onClick={clearFilters}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Invoice List Table / Cards */}
      {paginatedInvoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 flex flex-col items-center justify-center shadow-sm">
          <FileSpreadsheet className="h-12 w-12 text-slate-200 mb-3" />
          <p className="font-semibold text-slate-500">No invoices matched filters</p>
          <p className="text-xs mt-1">Try resetting the filters or create a new invoice.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-5">Invoice No.</th>
                    <th className="py-3.5 px-5">Customer</th>
                    <th className="py-3.5 px-5">Date</th>
                    <th className="py-3.5 px-5">Type</th>
                    <th className="py-3.5 px-5 text-right">Taxable Value</th>
                    <th className="py-3.5 px-5 text-right">Total Amount</th>
                    <th className="py-3.5 px-5 text-center">Status</th>
                    <th className="py-3.5 px-5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-5 font-bold text-slate-900">{inv.invoiceNo}</td>
                      <td className="py-4 px-5 font-medium text-slate-800">
                        {inv.customerSnapshot.name}
                      </td>
                      <td className="py-4 px-5">{formatDate(inv.invoiceDate)}</td>
                      <td className="py-4 px-5">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              inv.type === "quotation"
                                ? "bg-amber-50 text-amber-700 border border-amber-250"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-250"
                            )}
                          >
                            {inv.type === "quotation" ? "Quotation" : "Tax Invoice"}
                          </span>
                          <span
                            className="inline-flex items-center rounded-md px-1.5 py-0.2 text-[9px] font-medium uppercase text-slate-500"
                          >
                            {inv.isGstInvoice ? "GST (18%)" : "Simple Bill"}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-right font-medium text-slate-700">
                        {formatCurrency(inv.taxableValueTotal)}
                      </td>
                      <td className="py-4 px-5 text-right font-black text-slate-900">
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
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="text-xs font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 px-3 py-1.5 rounded-lg transition-colors inline-block"
                          >
                            Manage
                          </Link>
                          <button
                            onClick={() => handleDelete(inv.id, inv.invoiceNo)}
                            className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 transition-colors"
                            title="Delete Invoice"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Grid/Card View */}
          <div className="md:hidden space-y-4">
            {paginatedInvoices.map((inv) => (
              <div
                key={inv.id}
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3 relative"
              >
                <div className="flex items-center justify-between pr-8">
                  <span className="font-black text-slate-900">{inv.invoiceNo}</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider",
                      inv.status === "paid" && "bg-emerald-50 text-emerald-700",
                      inv.status === "sent" && "bg-amber-50 text-amber-700",
                      inv.status === "draft" && "bg-slate-100 text-slate-700",
                      inv.status === "overdue" && "bg-rose-50 text-rose-700"
                    )}
                  >
                    {inv.status}
                  </span>
                </div>

                {/* Delete button top right for mobile */}
                <button
                  onClick={() => handleDelete(inv.id, inv.invoiceNo)}
                  className="absolute top-4 right-4 p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                  title="Delete Invoice"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <div>
                  <h3 className="font-bold text-slate-800 leading-snug">{inv.customerSnapshot.name}</h3>
                  <div className="text-xs text-slate-400 mt-1">
                    Date: <span className="font-medium text-slate-700">{formatDate(inv.invoiceDate)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-end pt-3 border-t border-slate-50">
                  <div>
                    <div className="flex flex-col gap-1 items-start">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          inv.type === "quotation"
                            ? "bg-amber-50 text-amber-700 border border-amber-250"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-250"
                        )}
                      >
                        {inv.type === "quotation" ? "Quotation" : "Tax Invoice"}
                      </span>
                      <span
                        className="inline-flex items-center rounded-md px-1.5 py-0.2 text-[9px] font-medium uppercase text-slate-500"
                      >
                        {inv.isGstInvoice ? "GST Invoice" : "Simple Bill"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Total Billed</div>
                    <div className="font-black text-slate-950 text-lg leading-none mt-1">
                      {formatCurrency(inv.grandTotal)}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="w-full text-center text-xs font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 py-2.5 rounded-xl transition-all border border-slate-100 block"
                  >
                    Manage Invoice
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-4 py-3.5 rounded-xl border border-slate-100 shadow-sm text-sm text-slate-600 font-medium">
              <div>
                Showing <span className="font-bold text-slate-900">{startIndex + 1}</span> to{" "}
                <span className="font-bold text-slate-900">
                  {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}
                </span>{" "}
                of <span className="font-bold text-slate-900">{totalItems}</span> transactions
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center px-3 font-semibold text-slate-800">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
