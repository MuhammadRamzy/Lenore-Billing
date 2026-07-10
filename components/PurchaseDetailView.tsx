"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit2,
  Printer,
  CheckCircle,
  Clock,
  ArrowLeft,
  X,
  Building2,
  ShoppingCart,
  IndianRupee,
} from "lucide-react";
import { Purchase, Company, Product } from "@/lib/types";
import { updatePurchaseAction } from "@/app/actions";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import PurchaseForm from "./PurchaseForm";

interface PurchaseDetailViewProps {
  purchase: Purchase;
  company: Company;
  products: Product[];
}

export default function PurchaseDetailView({
  purchase: initialPurchase,
  company,
  products,
}: PurchaseDetailViewProps) {
  const router = useRouter();
  const [purchase, setPurchase] = useState<Purchase>(initialPurchase);
  const [isEditing, setIsEditing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [printDateTime, setPrintDateTime] = useState("");

  const isInterState = purchase.supplierGstin && purchase.supplierGstin.length >= 2
    ? purchase.supplierGstin.substring(0, 2) !== company.stateCode
    : false;

  useEffect(() => {
    const now = new Date();
    setPrintDateTime(
      now.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    );
  }, []);

  const handleStatusChange = async (newStatus: "pending" | "paid") => {
    setStatusLoading(true);
    try {
      const res = await updatePurchaseAction(purchase.id, {
        purchaseDate: purchase.purchaseDate,
        isGstPurchase: purchase.isGstPurchase,
        supplierName: purchase.supplierName,
        supplierGstin: purchase.supplierGstin,
        supplierAddress: purchase.supplierAddress,
        supplierBillNo: purchase.supplierBillNo,
        lineItems: purchase.lineItems.map((item) => ({
          productId: item.productId || null,
          description: item.description,
          hsnCode: item.hsnCode || null,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          discountPercent: item.discountPercent,
          gstPercent: item.gstPercent,
        })),
        freight: purchase.freight,
        status: newStatus,
        remarks: purchase.remarks,
      });

      if (res.success && res.purchase) {
        setPurchase(res.purchase);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
    } finally {
      setStatusLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey) {
        const key = e.key.toLowerCase();
        if (key === "p") {
          e.preventDefault();
          handlePrint();
        } else if (key === "e") {
          e.preventDefault();
          setIsEditing((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Modifying Purchase Record
          </span>
          <button
            onClick={() => setIsEditing(false)}
            className="inline-flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-all"
          >
            <X className="h-3.5 w-3.5" /> Cancel Edit
          </button>
        </div>
        <PurchaseForm company={company} products={products} purchase={purchase} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* Control Panel: Hidden during print */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/purchases"
            className="inline-flex items-center justify-center p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-655 rounded-xl transition-all"
            title="Back to Purchases List"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
              {purchase.purchaseNo}
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Recorded on {formatDate(purchase.purchaseDate)}
            </p>
          </div>
          <span
            className={cn(
              "ml-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
              purchase.status === "paid" && "bg-emerald-50 text-emerald-700",
              purchase.status === "pending" && "bg-amber-50 text-amber-700"
            )}
          >
            {purchase.status === "paid" ? <CheckCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            {purchase.status}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick status change buttons */}
          <div className="bg-slate-55 p-1 rounded-xl flex gap-1 border border-slate-200/50">
            <button
              onClick={() => handleStatusChange("pending")}
              disabled={statusLoading || purchase.status === "pending"}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                purchase.status === "pending"
                  ? "bg-white text-amber-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 disabled:opacity-50"
              )}
            >
              Mark Pending
            </button>
            <button
              onClick={() => handleStatusChange("paid")}
              disabled={statusLoading || purchase.status === "paid"}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                purchase.status === "paid"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 disabled:opacity-50"
              )}
            >
              Mark Paid
            </button>
          </div>

          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm transition-all active:scale-95"
            title="Edit Purchase Record (Alt+Shift+E)"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-indigo-600/10 transition-all active:scale-95"
            title="Print Purchase Record (Alt+Shift+P)"
          >
            <Printer className="h-4 w-4" />
            Print Voucher
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 md:p-10 shadow-sm relative overflow-hidden print:border-none print:shadow-none print:p-0">
        
        {/* Printable Watermarks */}
        <div className="absolute right-6 top-6 text-right print:block hidden">
          <div className="text-[10px] text-slate-400 font-mono">
            Voucher print date: {printDateTime}
          </div>
        </div>

        {/* Voucher Title */}
        <div className="border-b-2 border-slate-900 pb-5 mb-6 text-center">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">
            PURCHASE INWARD VOUCHER
          </h2>
          <p className="text-[10px] text-slate-500 font-bold tracking-wider mt-1">
            INVENTORY INTAKE RECORD
          </p>
        </div>

        {/* Invoice Entities Row */}
        <div className="grid grid-cols-2 gap-8 text-slate-800 text-xs mb-8">
          {/* Company details */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-slate-500" /> Recorded Inward To:
            </h3>
            <div className="text-sm font-black text-slate-900">{company.name}</div>
            {company.address && <div className="text-slate-500 max-w-xs">{company.address}</div>}
            {company.phone && <div className="text-slate-500">Phone: {company.phone}</div>}
            {company.gstin && (
              <div className="font-bold text-slate-700">
                GSTIN: <span className="font-mono text-slate-900">{company.gstin}</span>
              </div>
            )}
          </div>

          {/* Supplier details */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <ShoppingCart className="h-3.5 w-3.5 text-slate-500" /> Supplied By:
            </h3>
            <div className="text-sm font-black text-slate-900">{purchase.supplierName}</div>
            {purchase.supplierAddress && <div className="text-slate-500 max-w-xs">{purchase.supplierAddress}</div>}
            {purchase.supplierGstin && (
              <div className="font-bold text-slate-700">
                GSTIN: <span className="font-mono text-slate-900">{purchase.supplierGstin}</span>
              </div>
            )}
          </div>
        </div>

        {/* Purchase Metadata Block */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mb-8 print:bg-white print:border-slate-300">
          <div>
            <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Purchase No.</div>
            <div className="font-black text-slate-900 mt-0.5">{purchase.purchaseNo}</div>
          </div>
          <div>
            <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Supplier Bill No.</div>
            <div className="font-black text-slate-900 mt-0.5">{purchase.supplierBillNo || "N/A"}</div>
          </div>
          <div>
            <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Purchase Date</div>
            <div className="font-bold text-slate-800 mt-0.5">{formatDate(purchase.purchaseDate)}</div>
          </div>
          <div>
            <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Tax computation</div>
            <div className="font-bold text-slate-800 mt-0.5">
              {purchase.isGstPurchase ? "Tax Invoice (GST)" : "Simple Bill"}
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-left text-xs border border-slate-200">
            <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[9px]">
              <tr>
                <th className="py-2 px-3 text-center border border-slate-200">Sl</th>
                <th className="py-2 px-3 border border-slate-200">Product / Description</th>
                <th className="py-2 px-3 text-center border border-slate-200">HSN</th>
                <th className="py-2 px-3 text-right border border-slate-200">Qty</th>
                <th className="py-2 px-3 text-right border border-slate-200">Rate</th>
                <th className="py-2 px-3 text-right border border-slate-200">Disc %</th>
                {purchase.isGstPurchase && (
                  <>
                    <th className="py-2 px-3 text-right border border-slate-200">Taxable</th>
                    <th className="py-2 px-3 text-right border border-slate-200">GST %</th>
                    <th className="py-2 px-3 text-right border border-slate-200">Tax Amt</th>
                  </>
                )}
                <th className="py-2 px-3 text-right border border-slate-200">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {purchase.lineItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 text-center border border-slate-200">{item.slNo}</td>
                  <td className="py-2 px-3 border border-slate-200 font-bold text-slate-900">{item.description}</td>
                  <td className="py-2 px-3 text-center border border-slate-200">{item.hsnCode || "-"}</td>
                  <td className="py-2 px-3 text-right border border-slate-200">{item.quantity} {item.unit}</td>
                  <td className="py-2 px-3 text-right border border-slate-200">{formatCurrency(item.rate)}</td>
                  <td className="py-2 px-3 text-right border border-slate-200">{item.discountPercent}%</td>
                  {purchase.isGstPurchase && (
                    <>
                      <td className="py-2 px-3 text-right border border-slate-200">{formatCurrency(item.taxableValue)}</td>
                      <td className="py-2 px-3 text-right border border-slate-200">{item.gstPercent}%</td>
                      <td className="py-2 px-3 text-right border border-slate-200">{formatCurrency(item.cgstAmount + item.sgstAmount + item.igstAmount)}</td>
                    </>
                  )}
                  <td className="py-2 px-3 text-right border border-slate-200 font-black text-slate-950">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
          {/* Remarks */}
          <div className="space-y-4">
            {purchase.remarks && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                  Voucher Remarks / Notes
                </span>
                <p className="text-slate-700 leading-relaxed font-medium">{purchase.remarks}</p>
              </div>
            )}
            <div className="pt-6 border-t border-dashed border-slate-200 print:block hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-bold">Payment Status:</span>
                <span
                  className={cn(
                    "rounded px-2 py-0.5 font-bold uppercase tracking-wider text-[10px]",
                    purchase.status === "paid" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"
                  )}
                >
                  {purchase.status}
                </span>
              </div>
            </div>
          </div>

          {/* Totals Column */}
          <div className="space-y-2 max-w-sm md:ml-auto w-full">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-bold">Subtotal:</span>
              <span className="font-semibold text-slate-800">{formatCurrency(purchase.subtotal)}</span>
            </div>
            {purchase.totalDiscount > 0 && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-bold">Discount Total:</span>
                <span className="font-semibold text-slate-800">-{formatCurrency(purchase.totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-bold">Taxable Value:</span>
              <span className="font-semibold text-slate-800">{formatCurrency(purchase.taxableValueTotal)}</span>
            </div>

            {purchase.isGstPurchase && (
              <>
                {!isInterState ? (
                  <>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500 font-bold">CGST Total:</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(purchase.cgstTotal)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500 font-bold">SGST Total:</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(purchase.sgstTotal)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-bold">IGST Total:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(purchase.igstTotal)}</span>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-bold">Freight Charges:</span>
              <span className="font-semibold text-slate-800">{formatCurrency(purchase.freight)}</span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-150">
              <span className="text-slate-500 font-bold">Round Off:</span>
              <span className="font-semibold text-slate-800">{formatCurrency(purchase.roundOff)}</span>
            </div>

            <div className="flex justify-between py-2 border-b-2 border-slate-900 items-end bg-slate-50 p-2 rounded-xl print:bg-white print:border-slate-800">
              <span className="font-black text-slate-900 text-sm uppercase tracking-wider">Grand Total:</span>
              <span className="text-xl font-black text-slate-950 flex items-center">
                <IndianRupee className="h-5 w-5 mr-0.5 text-indigo-650" />
                {formatCurrency(purchase.grandTotal).replace("₹", "")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
