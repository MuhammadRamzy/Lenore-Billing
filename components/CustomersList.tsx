"use client";

import React, { useState } from "react";
import {
  Plus,
  Search,
  Edit,
  Phone,
  Mail,
  MapPin,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";
import { Customer } from "@/lib/types";
import CustomerDialog from "./CustomerDialog";
import { formatDate, exportToCsv } from "@/lib/utils";
import { deleteCustomerAction } from "@/app/actions";
import Link from "next/link";

interface CustomersListProps {
  initialCustomers: Customer[];
}

export default function CustomersList({ initialCustomers }: CustomersListProps) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dialog States
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Advanced Filter States
  const [gstFilter, setGstFilter] = useState<"all" | "gst" | "unregistered">("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "recent">("recent");

  // Get unique states from customer list
  const uniqueStates = React.useMemo(() => {
    const states = customers.map((c) => c.state).filter((s): s is string => !!s);
    return Array.from(new Set(states)).sort();
  }, [customers]);

  // Filter and sort customers
  const filteredCustomers = customers.filter((c) => {
    // 1. Search Query
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.gstin && c.gstin.toLowerCase().includes(q)) ||
      (c.city && c.city.toLowerCase().includes(q));

    // 2. GST Status Filter
    let matchesGst = true;
    if (gstFilter === "gst") {
      matchesGst = !!c.gstin;
    } else if (gstFilter === "unregistered") {
      matchesGst = !c.gstin;
    }

    // 3. State Filter
    const matchesState = stateFilter === "all" || c.state === stateFilter;

    return matchesSearch && matchesGst && matchesState;
  }).sort((a, b) => {
    if (sortBy === "name_asc") {
      return a.name.localeCompare(b.name);
    } else if (sortBy === "name_desc") {
      return b.name.localeCompare(a.name);
    } else if (sortBy === "recent") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
  });

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedCustomer(null);
    setIsDialogOpen(true);
  };

  const handleSuccess = (updatedCustomer: Customer) => {
    setCustomers((prev) => {
      const idx = prev.findIndex((c) => c.id === updatedCustomer.id);
      if (idx !== -1) {
        // Edit flow
        const updated = [...prev];
        updated[idx] = updatedCustomer;
        return updated;
      } else {
        // Add flow
        return [updatedCustomer, ...prev];
      }
    });
  };

  // Delete Customer
  const handleDelete = async (customer: Customer) => {
    if (confirm(`Are you sure you want to delete customer account "${customer.name}"?`)) {
      try {
        await deleteCustomerAction(customer.id);
        setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      } catch (err: any) {
        alert(err.message || "Failed to delete customer.");
      }
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ["Name", "Phone", "Email", "Address", "City", "State", "State Code", "Pincode", "GSTIN"];
    const rows = filteredCustomers.map((c) => [
      c.name,
      c.phone || "",
      c.email || "",
      c.address || "",
      c.city || "",
      c.state || "",
      c.stateCode || "",
      c.pincode || "",
      c.gstin || "",
    ]);
    exportToCsv("lenore_customers_directory.csv", headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Customers
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain account details, shipping addresses, and GSTIN records.
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition-all duration-150 active:scale-95 text-xs"
            title="Download CSV"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export CSV
          </button>
          
          <button
            onClick={handleAdd}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-150 active:scale-95 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Search & Advanced Filters Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
          <Search className="h-5 w-5 text-slate-450 shrink-0" />
          <input
            type="text"
            placeholder="Search by name, city, phone, email or GSTIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm bg-transparent focus:outline-none placeholder-slate-400 text-slate-800"
          />
        </div>

        {/* Filter controls row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              GST Registration
            </label>
            <select
              value={gstFilter}
              onChange={(e: any) => setGstFilter(e.target.value)}
              className="w-full text-sm font-bold text-slate-705 bg-white border border-slate-202 rounded-xl px-3 py-2 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All Accounts</option>
              <option value="gst">GST Registered Only</option>
              <option value="unregistered">Unregistered Business</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Filter by State
            </label>
            <select
              value={stateFilter}
              onChange={(e: any) => setStateFilter(e.target.value)}
              className="w-full text-sm font-bold text-slate-705 bg-white border border-slate-202 rounded-xl px-3 py-2 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All States</option>
              {uniqueStates.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Sort Directory
            </label>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full text-sm font-bold text-slate-705 bg-white border border-slate-202 rounded-xl px-3 py-2 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="recent">Most Recent First</option>
              <option value="name_asc">Alphabetical (A - Z)</option>
              <option value="name_desc">Alphabetical (Z - A)</option>
            </select>
          </div>
        </div>

        {/* Clear Filters helper */}
        {(gstFilter !== "all" || stateFilter !== "all" || sortBy !== "recent" || searchQuery !== "") && (
          <div className="flex justify-end pt-2 border-t border-slate-50">
            <button
              onClick={() => {
                setSearchQuery("");
                setGstFilter("all");
                setStateFilter("all");
                setSortBy("recent");
              }}
              className="text-xs font-bold text-indigo-650 hover:text-indigo-750 transition-colors"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Customers Table / Cards */}
      {filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 flex flex-col items-center justify-center shadow-sm">
          <Search className="h-12 w-12 text-slate-200 mb-3" />
          <p className="font-semibold text-slate-500">No customers found</p>
          <p className="text-xs mt-1">Try refining your search query or add a new customer.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-5">Name</th>
                    <th className="py-3.5 px-5">Contact Details</th>
                    <th className="py-3.5 px-5">City & State</th>
                    <th className="py-3.5 px-5">GSTIN</th>
                    <th className="py-3.5 px-5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-5">
                        <Link href={`/customers/${cust.id}`} className="font-bold text-slate-900 hover:text-indigo-600 hover:underline transition-all">
                          {cust.name}
                        </Link>
                        <div className="text-xs text-slate-400 mt-1 max-w-xs truncate" title={cust.address || undefined}>
                          {cust.address}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          {cust.phone || "N/A"}
                        </div>
                        {cust.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                            <Mail className="h-3.5 w-3.5 text-slate-300" />
                            {cust.email}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-medium text-slate-800">
                          {cust.city || "N/A"}{cust.city && cust.state ? `, ${cust.state}` : (cust.state || "")}
                        </div>
                        <div className="text-xs text-indigo-500 font-bold mt-1">
                          State Code: {cust.stateCode || "N/A"}
                        </div>
                      </td>
                      <td className="py-4 px-5 font-mono text-xs font-bold text-slate-800">
                        {cust.gstin || (
                          <span className="text-slate-300 italic font-sans font-normal">None</span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(cust)}
                            className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition-colors"
                            title="Edit Customer"
                          >
                            <Edit className="h-4.5 w-4.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(cust)}
                            className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 transition-colors"
                            title="Remove Customer"
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
            {filteredCustomers.map((cust) => (
              <div
                key={cust.id}
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3 relative"
              >
                <div className="pr-20">
                  <Link href={`/customers/${cust.id}`} className="font-bold text-slate-900 leading-snug hover:text-indigo-600 hover:underline transition-all block">
                    {cust.name}
                  </Link>
                  <div className="flex items-center gap-1 text-[11px] text-indigo-500 font-bold mt-1 bg-indigo-50 px-2 py-0.5 rounded-full w-max">
                    State Code: {cust.stateCode || "N/A"} ({cust.state || "N/A"})
                  </div>
                </div>

                {/* Actions Box Absolute Top Right */}
                <div className="absolute top-4 right-4 flex gap-1">
                  <button
                    onClick={() => handleEdit(cust)}
                    className="p-2 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"
                    title="Edit Customer"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cust)}
                    className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                    title="Remove Customer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-1.5 text-sm text-slate-600 pt-2 border-t border-slate-50">
                  <div className="flex gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      {[cust.address, cust.city].filter(Boolean).join(", ") || "No Address Provided"}
                      {cust.pincode ? ` - ${cust.pincode}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{cust.phone || "No Phone Provided"}</span>
                  </div>
                  {cust.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="truncate">{cust.email}</span>
                    </div>
                  )}
                  {cust.gstin && (
                    <div className="text-xs font-mono font-bold bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg w-max mt-2 border border-slate-100">
                      GST: {cust.gstin}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Edit/Add Dialog overlay */}
      <CustomerDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        customer={selectedCustomer}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
