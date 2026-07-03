"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Save,
  CheckCircle,
  Loader2,
  FileText,
} from "lucide-react";
import { Company, CompanySchema } from "@/lib/types";
import { updateCompanyAction } from "@/app/actions";
import { cn } from "@/lib/utils";

interface SettingsFormProps {
  initialCompany: Company;
}

export default function SettingsForm({ initialCompany }: SettingsFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<Company>(initialCompany);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (path: string, value: string) => {
    setSuccess(false);
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[path];
      return updated;
    });

    if (path === "lowStockLimit") {
      const parsedVal = parseInt(value, 10);
      setFormData((prev) => ({
        ...prev,
        lowStockLimit: isNaN(parsedVal) ? 0 : parsedVal,
      }));
    } else if (path.startsWith("bank.")) {
      const field = path.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        bank: {
          ...prev.bank,
          [field]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [path]: value,
      }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setErrors({});

    // Client-side Zod validation
    const result = CompanySchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const path = err.path.join(".");
        newErrors[path] = err.message;
      });
      setErrors(newErrors);
      setLoading(false);
      return;
    }

    try {
      const res = await updateCompanyAction(formData);
      if (res.success) {
        setSuccess(true);
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      setErrors({ general: err.message || "Failed to update settings" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Invoice Settings
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure company branding, GST tax details, and default bank account info for invoices.
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-150 active:scale-95 text-sm disabled:opacity-70 self-start sm:self-auto cursor-pointer"
        >
          {loading ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : (
            <Save className="h-4.5 w-4.5" />
          )}
          Save Settings
        </button>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-sm font-bold rounded-xl flex items-center gap-2 border border-emerald-100 animate-in fade-in slide-in-from-top-1 duration-200">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>Settings saved successfully. Changes are now live across all documents!</span>
        </div>
      )}

      {errors.general && (
        <div className="p-4 bg-rose-50 text-rose-800 text-sm font-bold rounded-xl border border-rose-100">
          {errors.general}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Brand Information Section */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
          <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-2">
            <Building className="h-5 w-5 text-indigo-600" />
            Company Profile
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                Brand/Company Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="e.g. Wetta Bath Fittings"
                className={cn(
                  "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800",
                  errors.name ? "border-rose-400" : "border-slate-200"
                )}
              />
              {errors.name && (
                <span className="text-xs text-rose-500 mt-1 block">{errors.name}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                Tagline / Subtitle
              </label>
              <input
                type="text"
                value={formData.tagline || ""}
                onChange={(e) => handleChange("tagline", e.target.value)}
                placeholder="e.g. Premium Bath Fittings & Accessories"
                className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                Logo Image URL
              </label>
              <input
                type="text"
                value={formData.logoUrl || ""}
                onChange={(e) => handleChange("logoUrl", e.target.value)}
                placeholder="e.g. /logo.png"
                className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Bank details Section */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
          <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-indigo-600" />
            Bank Settlement Details
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                Bank Name *
              </label>
              <input
                type="text"
                required
                value={formData.bank.bankName}
                onChange={(e) => handleChange("bank.bankName", e.target.value)}
                placeholder="e.g. HDFC Bank"
                className={cn(
                  "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800",
                  errors["bank.bankName"] ? "border-rose-400" : "border-slate-200"
                )}
              />
              {errors["bank.bankName"] && (
                <span className="text-xs text-rose-500 mt-1 block">{errors["bank.bankName"]}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                Account Number *
              </label>
              <input
                type="text"
                required
                value={formData.bank.accountNo}
                onChange={(e) => handleChange("bank.accountNo", e.target.value)}
                placeholder="e.g. 5010023456789"
                className={cn(
                  "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800 font-mono",
                  errors["bank.accountNo"] ? "border-rose-400" : "border-slate-200"
                )}
              />
              {errors["bank.accountNo"] && (
                <span className="text-xs text-rose-500 mt-1 block">{errors["bank.accountNo"]}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                  IFSC Code *
                </label>
                <input
                  type="text"
                  required
                  value={formData.bank.ifsc}
                  onChange={(e) => handleChange("bank.ifsc", e.target.value)}
                  placeholder="e.g. HDFC0000123"
                  className={cn(
                    "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800 font-mono uppercase",
                    errors["bank.ifsc"] ? "border-rose-400" : "border-slate-200"
                  )}
                />
                {errors["bank.ifsc"] && (
                  <span className="text-xs text-rose-500 mt-1 block">{errors["bank.ifsc"]}</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                  Branch Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.bank.branch}
                  onChange={(e) => handleChange("bank.branch", e.target.value)}
                  placeholder="e.g. Fort Branch"
                  className={cn(
                    "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800",
                    errors["bank.branch"] ? "border-rose-400" : "border-slate-200"
                  )}
                />
                {errors["bank.branch"] && (
                  <span className="text-xs text-rose-500 mt-1 block">{errors["bank.branch"]}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Address and Tax Information Section */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5 md:col-span-2">
          <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-indigo-600" />
            Registration, Location & Contact Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            <div className="sm:col-span-2 md:col-span-3">
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                Registered Office Address *
              </label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="e.g. 12, G.I.D.C Ind. Area"
                className={cn(
                  "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800",
                  errors.address ? "border-rose-400" : "border-slate-200"
                )}
              />
              {errors.address && (
                <span className="text-xs text-rose-500 mt-1 block">{errors.address}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                City / Town *
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => handleChange("city", e.target.value)}
                placeholder="e.g. Rajkot"
                className={cn(
                  "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800",
                  errors.city ? "border-rose-400" : "border-slate-200"
                )}
              />
              {errors.city && (
                <span className="text-xs text-rose-500 mt-1 block">{errors.city}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                State Name *
              </label>
              <input
                type="text"
                required
                value={formData.state}
                onChange={(e) => handleChange("state", e.target.value)}
                placeholder="e.g. Gujarat"
                className={cn(
                  "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800",
                  errors.state ? "border-rose-400" : "border-slate-200"
                )}
              />
              {errors.state && (
                <span className="text-xs text-rose-500 mt-1 block">{errors.state}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5" title="State Code is critical for GST (CGST/SGST vs IGST) calculations.">
                  State Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={formData.stateCode}
                  onChange={(e) => handleChange("stateCode", e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 24"
                  className={cn(
                    "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800 font-mono text-center",
                    errors.stateCode ? "border-rose-400" : "border-slate-200"
                  )}
                />
                {errors.stateCode && (
                  <span className="text-xs text-rose-500 mt-1 block">{errors.stateCode}</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                  Pincode *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={formData.pincode}
                  onChange={(e) => handleChange("pincode", e.target.value.replace(/\D/g, ""))}
                  placeholder="360003"
                  className={cn(
                    "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800 font-mono text-center",
                    errors.pincode ? "border-rose-400" : "border-slate-200"
                  )}
                />
                {errors.pincode && (
                  <span className="text-xs text-rose-500 mt-1 block">{errors.pincode}</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                GSTIN Registration
              </label>
              <input
                type="text"
                value={formData.gstin || ""}
                onChange={(e) => handleChange("gstin", e.target.value.toUpperCase())}
                placeholder="24ABCDE1234F1Z5"
                className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800 font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                Phone Number *
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="9876543210"
                className={cn(
                  "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800 font-mono",
                  errors.phone ? "border-rose-400" : "border-slate-200"
                )}
              />
              {errors.phone && (
                <span className="text-xs text-rose-500 mt-1 block">{errors.phone}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email || ""}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="info@wettafittings.com"
                className={cn(
                  "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800",
                  errors.email ? "border-rose-400" : "border-slate-200"
                )}
              />
              {errors.email && (
                <span className="text-xs text-rose-500 mt-1 block">{errors.email}</span>
              )}
            </div>
          </div>
        </div>

        {/* System & Warning Settings Section */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5 md:col-span-2">
          <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-50 pb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            System & Billing Configurations
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                Low Stock Threshold (Warning limit)
              </label>
              <input
                type="number"
                required
                min={0}
                value={formData.lowStockLimit ?? 5}
                onChange={(e) => handleChange("lowStockLimit", e.target.value)}
                placeholder="e.g. 5"
                className={cn(
                  "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800 font-mono",
                  errors.lowStockLimit ? "border-rose-400" : "border-slate-200"
                )}
              />
              {errors.lowStockLimit && (
                <span className="text-xs text-rose-500 mt-1 block">{errors.lowStockLimit}</span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                Invoice Number Prefix
              </label>
              <input
                type="text"
                required
                value={formData.invoicePrefix ?? "INV"}
                onChange={(e) => handleChange("invoicePrefix", e.target.value)}
                placeholder="e.g. INV"
                className={cn(
                  "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800 font-mono",
                  errors.invoicePrefix ? "border-rose-400" : "border-slate-200"
                )}
              />
              {errors.invoicePrefix && (
                <span className="text-xs text-rose-500 mt-1 block">{errors.invoicePrefix}</span>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1.5">
                Default Terms & Conditions
              </label>
              <textarea
                value={formData.termsAndConditions || ""}
                onChange={(e) => handleChange("termsAndConditions", e.target.value)}
                placeholder="Enter standard declaration or invoice footer terms here..."
                rows={3}
                className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
