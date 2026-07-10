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
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Trash2,
  FileSpreadsheet,
} from "lucide-react";
import { Purchase } from "@/lib/types";
import { formatCurrency, formatDate, cn, exportToCsv } from "@/lib/utils";
import { deletePurchaseAction } from "@/app/actions";

interface PurchasesListProps {
  initialPurchases: Purchase[];
}

const ITEMS_PER_PAGE = 20;

export default function PurchasesList({ initialPurchases }: PurchasesListProps) {
  const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Advanced filter states
  const [amountFilter, setAmountFilter] = useState<"all" | "under_5k" | "5k_10k" | "10k_25k" | "25k_50k" | "50k_100k" | "over_100k">("all");
  const [gstFilter, setGstFilter] = useState<"all" | "gst" | "simple">("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "purchase_no">("date_desc");

  // Filter purchases based on inputs
  const filteredPurchases = purchases.filter((pur) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      pur.purchaseNo.toLowerCase().includes(q) ||
      pur.supplierName.toLowerCase().includes(q) ||
      (pur.supplierBillNo && pur.supplierBillNo.toLowerCase().includes(q));

    const matchesStatus = selectedStatus === "all" || pur.status === selectedStatus;

    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(pur.purchaseDate) >= new Date(startDate);
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(pur.purchaseDate) <= endOfDay;
    }

    let matchesAmount = true;
    const total = pur.grandTotal;
    if (amountFilter === "under_5k") {
      matchesAmount = total < 5000;
    } else if (amountFilter === "5k_10k") {
      matchesAmount = total >= 5000 && total <= 10000;
    } else if (amountFilter === "10k_25k") {
      matchesAmount = total >= 10000 && total <= 25000;
    } else if (amountFilter === "25k_50k") {
      matchesAmount = total >= 25000 && total <= 50000;
    } else if (amountFilter === "50k_100k") {
      matchesAmount = total >= 50000 && total <= 100000;
    } else if (amountFilter === "over_100k") {
      matchesAmount = total > 100000;
    }

    let matchesGst = true;
    if (gstFilter === "gst") {
      matchesGst = pur.isGstPurchase;
    } else if (gstFilter === "simple") {
      matchesGst = !pur.isGstPurchase;
    }

    return matchesQuery && matchesStatus && matchesDate && matchesAmount && matchesGst;
  }).sort((a, b) => {
    if (sortBy === "date_desc") {
      return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
    }
    if (sortBy === "date_asc") {
      return new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime();
    }
    if (sortBy === "amount_desc") {
      return b.grandTotal - a.grandTotal;
    }
    if (sortBy === "amount_asc") {
      return a.grandTotal - b.grandTotal;
    }
    if (sortBy === "purchase_no") {
      return b.purchaseNo.localeCompare(a.purchaseNo);
    }
    return 0;
  });

  // Pagination calculations
  const totalItems = filteredPurchases.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const paginatedPurchases = filteredPurchases.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleDelete = async (id: string, purchaseNo: string) => {
    if (
      confirm(
        `Are you sure you want to delete purchase ${purchaseNo}? This will automatically adjust product stock levels accordingly.`
      )
    ) {
      try {
        await deletePurchaseAction(id);
        setPurchases(purchases.filter((p) => p.id !== id));
      } catch (err) {
        alert("Failed to delete purchase. Please try again.");
      }
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Purchase No",
      "Supplier Bill No",
      "Supplier Name",
      "GSTIN",
      "Date",
      "Type",
      "Subtotal",
      "Freight",
      "GST Total",
      "Grand Total",
      "Status",
    ];
    const rows = filteredPurchases.map((p) => [
      p.purchaseNo,
      p.supplierBillNo || "N/A",
      p.supplierName,
      p.supplierGstin || "N/A",
      formatDate(p.purchaseDate),
      p.isGstPurchase ? "GST Purchase" : "Simple Purchase",
      p.subtotal.toString(),
      p.freight.toString(),
      (p.cgstTotal + p.sgstTotal + p.igstTotal).toString(),
      p.grandTotal.toString(),
      p.status.toUpperCase(),
    ]);
    exportToCsv(`purchases_report_${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Purchases
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track inward stock supplies, manage purchase orders, and monitor input tax credit.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 active:scale-95 text-xs sm:text-sm transition-all"
            title="Export filtered purchases to CSV"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export CSV
          </button>
          <Link
            href="/purchases/new"
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-150 hover:shadow-indigo-600/20 active:scale-95 text-xs sm:text-sm"
          >
            <Plus className="h-5 w-5" />
            Add Purchase
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Purchase No, Supplier or Bill No..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 text-sm transition-all"
            />
          </div>

          {/* Date range picker */}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 text-xs sm:text-sm transition-all"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 text-xs sm:text-sm transition-all"
              />
            </div>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 text-sm transition-all"
            >
              <option value="all">All Payment Statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-50">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold mr-2">
            <Filter className="h-3.5 w-3.5" />
            Filters:
          </div>

          {/* GST Purchase Filter */}
          <select
            value={gstFilter}
            onChange={(e) => {
              setGstFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-550 text-xs transition-all"
          >
            <option value="all">All Tax Types</option>
            <option value="gst">GST Bills</option>
            <option value="simple">Simple Bills</option>
          </select>

          {/* Amount range filter */}
          <select
            value={amountFilter}
            onChange={(e) => {
              setAmountFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-550 text-xs transition-all"
          >
            <option value="all">All Amounts</option>
            <option value="under_5k">Under ₹5,000</option>
            <option value="5k_10k">₹5,000 - ₹10,000</option>
            <option value="10k_25k">₹10,000 - ₹25,000</option>
            <option value="25k_50k">₹25,000 - ₹50,000</option>
            <option value="50k_100k">₹50,000 - ₹1,00,000</option>
            <option value="over_100k">Over ₹1,00,000</option>
          </select>

          {/* Sort selection */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-slate-400 text-xs">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-650 font-bold focus:outline-none text-xs transition-all"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="amount_desc">Amount: High to Low</option>
              <option value="amount_asc">Amount: Low to High</option>
              <option value="purchase_no">Purchase Number</option>
            </select>
          </div>
        </div>
      </div>

      {/* Purchases List Table & Mobile Cards */}
      {filteredPurchases.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center text-slate-400 flex flex-col items-center justify-center shadow-sm">
          <ShoppingCart className="h-14 w-14 text-slate-200 mb-3" />
          <h3 className="font-extrabold text-slate-700 text-lg">No purchases found</h3>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-md">
            Try adjusting your search queries, removing active filters, or creating your first purchase record.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Mobile view cards layout */}
          <div className="block sm:hidden divide-y divide-slate-100">
            {paginatedPurchases.map((pur) => (
              <div key={pur.id} className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">{pur.purchaseNo}</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                      pur.status === "paid" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                      pur.status === "pending" && "bg-amber-50 text-amber-700 border border-amber-200"
                    )}
                  >
                    {pur.status}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-700">
                    <span className="font-semibold text-slate-800">{pur.supplierName}</span>
                    <span className="text-slate-400">{formatDate(pur.purchaseDate)}</span>
                  </div>
                  {pur.supplierBillNo && (
                    <div className="text-[10px] text-slate-500">
                      Bill No: <span className="font-medium text-slate-700">{pur.supplierBillNo}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400">
                    {pur.isGstPurchase ? "Tax Invoice (GST)" : "Simple Bill (No GST)"}
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                  <span className="font-black text-slate-900 text-sm">
                    {formatCurrency(pur.grandTotal)}
                  </span>
                  <div className="flex gap-2">
                    <Link
                      href={`/purchases/${pur.id}`}
                      className="text-[10px] font-bold text-indigo-650 hover:underline px-2 py-1 bg-slate-50 rounded"
                    >
                      Manage &rarr;
                    </Link>
                    <button
                      onClick={() => handleDelete(pur.id, pur.purchaseNo)}
                      className="text-[10px] font-bold text-red-500 hover:text-red-700 px-2 py-1 bg-rose-50 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop view table layout */}
          <table className="hidden sm:table w-full border-collapse text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-4 px-5">Purchase No.</th>
                <th className="py-4 px-5">Supplier</th>
                <th className="py-4 px-5">Date</th>
                <th className="py-4 px-5">Bill / Type</th>
                <th className="py-4 px-5 text-right">Taxable Val</th>
                <th className="py-4 px-5 text-right">Grand Total</th>
                <th className="py-4 px-5 text-center">Status</th>
                <th className="py-4 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedPurchases.map((pur) => (
                <tr key={pur.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-5 font-bold text-slate-900">{pur.purchaseNo}</td>
                  <td className="py-4 px-5 font-medium text-slate-800">
                    {pur.supplierName}
                  </td>
                  <td className="py-4 px-5">{formatDate(pur.purchaseDate)}</td>
                  <td className="py-4 px-5">
                    <div className="flex flex-col gap-1 items-start">
                      <span className="text-[11px] font-semibold text-slate-700">
                        {pur.supplierBillNo ? `Bill: ${pur.supplierBillNo}` : "No Bill No."}
                      </span>
                      <span className="inline-flex items-center rounded-md px-1.5 py-0.2 text-[9px] font-medium uppercase text-slate-400">
                        {pur.isGstPurchase ? "GST Purchase" : "Simple"}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-right font-medium text-slate-700">
                    {formatCurrency(pur.taxableValueTotal)}
                  </td>
                  <td className="py-4 px-5 text-right font-black text-slate-900">
                    {formatCurrency(pur.grandTotal)}
                  </td>
                  <td className="py-4 px-5 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
                        pur.status === "paid" && "bg-emerald-50 text-emerald-700",
                        pur.status === "pending" && "bg-amber-50 text-amber-700"
                      )}
                    >
                      {pur.status === "paid" && <CheckCircle2 className="h-3 w-3" />}
                      {pur.status === "pending" && <Clock className="h-3 w-3" />}
                      {pur.status}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Link
                        href={`/purchases/${pur.id}`}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-750"
                      >
                        Manage
                      </Link>
                      <span className="text-slate-200">|</span>
                      <button
                        onClick={() => handleDelete(pur.id, pur.purchaseNo)}
                        className="text-xs font-bold text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/50">
              <div className="text-xs text-slate-500">
                Showing <span className="font-semibold">{startIndex + 1}</span> to{" "}
                <span className="font-semibold">{endIndex}</span> of{" "}
                <span className="font-semibold">{totalItems}</span> purchases
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-slate-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-650" />
                </button>
                {Array.from({ length: totalPages }).map((_, index) => {
                  const page = index + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={cn(
                        "px-3 py-1.5 border text-xs font-bold rounded-lg transition-all",
                        currentPage === page
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95"
                      )}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-slate-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 active:scale-95 transition-all"
                >
                  <ChevronRight className="h-4 w-4 text-slate-650" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
