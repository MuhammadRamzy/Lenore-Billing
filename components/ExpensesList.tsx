"use client";

import React, { useState } from "react";
import {
  Plus,
  Search,
  Calendar,
  Filter,
  Trash2,
  Edit,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Info,
  IndianRupee,
  Receipt,
  CreditCard,
} from "lucide-react";
import { Expense } from "@/lib/types";
import { formatCurrency, formatDate, cn, exportToCsv } from "@/lib/utils";
import {
  createExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
} from "@/app/actions";
import Modal from "./Modal";

interface ExpensesListProps {
  initialExpenses: Expense[];
}

const ITEMS_PER_PAGE = 20;

const CATEGORIES = [
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "salaries", label: "Salaries" },
  { value: "marketing", label: "Marketing" },
  { value: "freight", label: "Freight" },
  { value: "travel", label: "Travel" },
  { value: "miscellaneous", label: "Miscellaneous" },
];

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI (Google Pay/PhonePe)" },
  { value: "other", label: "Other" },
];

export default function ExpensesList({ initialExpenses }: ExpensesListProps) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form Fields State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().substring(0, 10),
    category: "miscellaneous" as Expense["category"],
    amount: "",
    paymentMode: "upi" as Expense["paymentMode"],
    description: "",
    referenceNo: "",
    gstin: "",
    gstAmount: "",
  });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter expenses
  const filteredExpenses = expenses.filter((exp) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      exp.description.toLowerCase().includes(q) ||
      (exp.referenceNo && exp.referenceNo.toLowerCase().includes(q)) ||
      (exp.gstin && exp.gstin.toLowerCase().includes(q));

    const matchesCategory = selectedCategory === "all" || exp.category === selectedCategory;
    const matchesPaymentMode = selectedPaymentMode === "all" || exp.paymentMode === selectedPaymentMode;

    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(exp.date) >= new Date(startDate);
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(exp.date) <= endOfDay;
    }

    return matchesQuery && matchesCategory && matchesPaymentMode && matchesDate;
  }).sort((a, b) => {
    if (sortBy === "date_desc") {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    if (sortBy === "date_asc") {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    if (sortBy === "amount_desc") {
      return b.amount - a.amount;
    }
    if (sortBy === "amount_asc") {
      return a.amount - b.amount;
    }
    return 0;
  });

  // Pagination
  const totalItems = filteredExpenses.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);

  // Totals of filtered list
  const totalExpensesAmount = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const totalGstAmount = filteredExpenses.reduce((acc, curr) => acc + (curr.gstAmount || 0), 0);

  const handleOpenAddModal = () => {
    setEditingExpense(null);
    setFormData({
      date: new Date().toISOString().substring(0, 10),
      category: "miscellaneous",
      amount: "",
      paymentMode: "upi",
      description: "",
      referenceNo: "",
      gstin: "",
      gstAmount: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      date: expense.date.substring(0, 10),
      category: expense.category,
      amount: String(expense.amount),
      paymentMode: expense.paymentMode,
      description: expense.description,
      referenceNo: expense.referenceNo || "",
      gstin: expense.gstin || "",
      gstAmount: expense.gstAmount ? String(expense.gstAmount) : "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description) {
      setFormError("Description is required");
      return;
    }
    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      setFormError("Please enter a valid amount greater than 0");
      return;
    }

    const gstAmt = parseFloat(formData.gstAmount) || 0;
    if (gstAmt < 0) {
      setFormError("GST Amount cannot be negative");
      return;
    }
    if (gstAmt > amt) {
      setFormError("GST Amount cannot exceed the total expense amount");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const payload = {
        date: formData.date,
        category: formData.category,
        amount: amt,
        paymentMode: formData.paymentMode,
        description: formData.description,
        referenceNo: formData.referenceNo || null,
        gstin: formData.gstin ? formData.gstin.toUpperCase() : null,
        gstAmount: gstAmt,
      };

      if (editingExpense) {
        const res = await updateExpenseAction(editingExpense.id, payload);
        if (res.success && res.expense) {
          setExpenses((prev) =>
            prev.map((e) => (e.id === editingExpense.id ? res.expense! : e))
          );
          setIsModalOpen(false);
        }
      } else {
        const res = await createExpenseAction(payload);
        if (res.success && res.expense) {
          setExpenses((prev) => [res.expense!, ...prev]);
          setIsModalOpen(false);
        }
      }
    } catch (err: any) {
      setFormError(err.message || "An error occurred while saving the expense.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, description: string) => {
    if (confirm(`Are you sure you want to delete the expense: "${description}"?`)) {
      try {
        const res = await deleteExpenseAction(id);
        if (res.success) {
          setExpenses((prev) => prev.filter((e) => e.id !== id));
        }
      } catch (err) {
        alert("Failed to delete expense record.");
      }
    }
  };

  const handleExportCSV = () => {
    const filename = `expenses_${new Date().toISOString().substring(0, 10)}.csv`;
    const headers = [
      "Date",
      "Category",
      "Description",
      "Amount",
      "GST Amount",
      "Payment Mode",
      "Ref No",
      "GSTIN",
    ];

    const rows = filteredExpenses.map((exp) => [
      exp.date,
      CATEGORIES.find((c) => c.value === exp.category)?.label || exp.category,
      exp.description,
      String(exp.amount),
      String(exp.gstAmount || 0),
      PAYMENT_MODES.find((p) => p.value === exp.paymentMode)?.label || exp.paymentMode,
      exp.referenceNo || "",
      exp.gstin || "",
    ]);

    exportToCsv(filename, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingDown className="h-7 w-7 text-indigo-600 shrink-0" />
            Expense Ledger
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Track and monitor office rents, utility bills, salaries, freight, and general overhead.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            title="Export CSV Report"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export CSV
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-indigo-600/10 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl shrink-0">
            <IndianRupee className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[0.72rem] text-slate-500 font-bold uppercase tracking-wider">
              Total Filtered Expenses
            </div>
            <div className="text-xl font-extrabold text-slate-950 mt-1">
              {formatCurrency(totalExpensesAmount)}
            </div>
            <div className="text-[0.72rem] text-slate-500 font-medium mt-1">
              Sum of all selected expense ledger items
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[0.72rem] text-slate-500 font-bold uppercase tracking-wider">
              Claimable Input GST
            </div>
            <div className="text-xl font-extrabold text-slate-950 mt-1">
              {formatCurrency(totalGstAmount)}
            </div>
            <div className="text-[0.72rem] text-slate-500 font-medium mt-1">
              VAT/GST input tax credit from overhead bills
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search description, reference no, gstin..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 hover:bg-white rounded-xl text-xs w-full transition-colors outline-none font-medium text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-slate-200 focus:border-indigo-500 bg-slate-50/50 rounded-xl text-xs w-full transition-colors outline-none font-semibold text-slate-700"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={selectedPaymentMode}
                onChange={(e) => setSelectedPaymentMode(e.target.value)}
                className="px-3 py-2 border border-slate-200 focus:border-indigo-500 bg-slate-50/50 rounded-xl text-xs w-full transition-colors outline-none font-semibold text-slate-700"
              >
                <option value="all">All Pay Modes</option>
                {PAYMENT_MODES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-slate-200 focus:border-indigo-500 bg-slate-50/50 rounded-xl text-xs w-full transition-colors outline-none font-semibold text-slate-700"
              >
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="amount_desc">Highest Amount</option>
                <option value="amount_asc">Lowest Amount</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg text-[0.72rem] w-full outline-none font-semibold text-slate-700"
                title="Start Date"
              />
              <span className="text-slate-500 text-xs">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-lg text-[0.72rem] w-full outline-none font-semibold text-slate-700"
                title="End Date"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Table Section */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {paginatedExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <Info className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No expense records found</p>
            <p className="text-xs text-slate-500 mt-1">Try modifying your search query or category filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table View */}
            <table className="w-full text-left border-collapse hidden md:table">
              <thead>
                <tr className="bg-slate-900 text-white text-[0.72rem] uppercase font-bold tracking-wider">
                  <th className="py-3.5 px-6 border-b border-slate-800">Date</th>
                  <th className="py-3.5 px-6 border-b border-slate-800">Category</th>
                  <th className="py-3.5 px-6 border-b border-slate-800">Description</th>
                  <th className="py-3.5 px-6 border-b border-slate-800">Payment Mode</th>
                  <th className="py-3.5 px-6 border-b border-slate-800 text-right">GST Claims</th>
                  <th className="py-3.5 px-6 border-b border-slate-800 text-right">Amount</th>
                  <th className="py-3.5 px-6 border-b border-slate-800 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {paginatedExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 whitespace-nowrap text-slate-500 font-medium">
                      {formatDate(exp.date)}
                    </td>
                    <td className="py-3.5 px-6 whitespace-nowrap">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[0.72rem] font-bold uppercase tracking-wider",
                          exp.category === "rent" && "bg-amber-55 bg-amber-50 text-amber-700",
                          exp.category === "utilities" && "bg-blue-55 bg-blue-50 text-blue-700",
                          exp.category === "salaries" && "bg-indigo-50 text-indigo-700",
                          exp.category === "marketing" && "bg-purple-50 text-purple-700",
                          exp.category === "freight" && "bg-teal-50 text-teal-700",
                          exp.category === "travel" && "bg-emerald-50 text-emerald-700",
                          exp.category === "miscellaneous" && "bg-slate-100 text-slate-700"
                        )}
                      >
                        {CATEGORIES.find((c) => c.value === exp.category)?.label || exp.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 max-w-xs truncate">
                      <div className="font-bold text-slate-900">{exp.description}</div>
                      {exp.referenceNo && (
                        <div className="text-[0.72rem] text-slate-500 font-medium mt-0.5">
                          Ref: {exp.referenceNo}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-6 whitespace-nowrap">
                      <span className="flex items-center gap-1 text-[0.76rem] text-slate-600 font-medium">
                        <CreditCard className="h-3.5 w-3.5 text-slate-500" />
                        {PAYMENT_MODES.find((p) => p.value === exp.paymentMode)?.label || exp.paymentMode}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right whitespace-nowrap">
                      {exp.gstAmount ? (
                        <div>
                          <div className="font-bold text-slate-800">{formatCurrency(exp.gstAmount)}</div>
                          {exp.gstin && <div className="text-[0.68rem] text-slate-450">{exp.gstin}</div>}
                        </div>
                      ) : (
                        <span className="text-slate-350 text-[0.72rem] font-medium">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right font-extrabold text-rose-600 whitespace-nowrap">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="py-3.5 px-6 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEditModal(exp)}
                          className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100"
                          title="Edit Record"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(exp.id, exp.description)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100"
                          title="Delete Record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile List View */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginatedExpenses.map((exp) => (
                <div key={exp.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{exp.description}</div>
                      <div className="text-[0.72rem] text-slate-500 font-medium mt-0.5">
                        {formatDate(exp.date)} &bull; {PAYMENT_MODES.find((p) => p.value === exp.paymentMode)?.label}
                      </div>
                    </div>
                    <span className="font-extrabold text-rose-600 text-sm">
                      {formatCurrency(exp.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[0.72rem]">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-bold uppercase">
                      {CATEGORIES.find((c) => c.value === exp.category)?.label || exp.category}
                    </span>
                    {exp.gstAmount && (
                      <span className="text-slate-500 font-medium">
                        GST claimed: {formatCurrency(exp.gstAmount)}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end items-center gap-3 pt-1 border-t border-slate-50">
                    <button
                      onClick={() => handleOpenEditModal(exp)}
                      className="text-xs text-indigo-600 font-bold flex items-center gap-1"
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(exp.id, exp.description)}
                      className="text-xs text-rose-600 font-bold flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> to{" "}
              <span className="font-bold text-slate-800">{endIndex}</span> of{" "}
              <span className="font-bold text-slate-800">{totalItems}</span> records
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold text-slate-700 px-3">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Expense Dialog Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense ? "Edit Expense Entry" : "Record Expense Entry"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[0.72rem] text-slate-500 font-bold uppercase tracking-wider mb-1.5">
                Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                required
                className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 hover:bg-white rounded-xl text-xs font-semibold text-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="block text-[0.72rem] text-slate-500 font-bold uppercase tracking-wider mb-1.5">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    category: e.target.value as Expense["category"],
                  }))
                }
                required
                className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 bg-slate-50/50 rounded-xl text-xs font-semibold text-slate-800 outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[0.72rem] text-slate-500 font-bold uppercase tracking-wider mb-1.5">
              Description *
            </label>
            <input
              type="text"
              placeholder="e.g. Office electricity bill Jun 2026"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              required
              className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 hover:bg-white rounded-xl text-xs font-semibold text-slate-800 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[0.72rem] text-slate-500 font-bold uppercase tracking-wider mb-1.5">
                Total Amount (Inc. GST) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs text-slate-500 font-bold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                  className="w-full pl-7 pr-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 hover:bg-white rounded-xl text-xs font-semibold text-slate-800 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[0.72rem] text-slate-500 font-bold uppercase tracking-wider mb-1.5">
                Payment Mode *
              </label>
              <select
                value={formData.paymentMode}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    paymentMode: e.target.value as Expense["paymentMode"],
                  }))
                }
                required
                className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 bg-slate-50/50 rounded-xl text-xs font-semibold text-slate-800 outline-none"
              >
                {PAYMENT_MODES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <h4 className="text-[0.72rem] text-slate-500 font-bold uppercase tracking-wider mb-3">
              Tax Details (Optional - For Input Tax Credit)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[0.72rem] text-slate-450 font-bold mb-1.5">
                  GSTIN (Supplier)
                </label>
                <input
                  type="text"
                  placeholder="29AAAAA1111A1Z1"
                  value={formData.gstin}
                  onChange={(e) => setFormData((prev) => ({ ...prev, gstin: e.target.value }))}
                  maxLength={15}
                  className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 hover:bg-white rounded-xl text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[0.72rem] text-slate-455 font-bold mb-1.5">
                  GST Paid Component
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs text-slate-500 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.gstAmount}
                    onChange={(e) => setFormData((prev) => ({ ...prev, gstAmount: e.target.value }))}
                    className="w-full pl-7 pr-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 hover:bg-white rounded-xl text-xs font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[0.72rem] text-slate-500 font-bold uppercase tracking-wider mb-1.5">
              Reference / Receipt No. (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Txn ID, invoice no, bill receipt number"
              value={formData.referenceNo}
              onChange={(e) => setFormData((prev) => ({ ...prev, referenceNo: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 hover:bg-white rounded-xl text-xs font-semibold text-slate-800 outline-none"
            />
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 border border-slate-250 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold hover:shadow-lg disabled:opacity-40 transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? "Saving..." : editingExpense ? "Update Entry" : "Save Entry"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
