"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Edit2,
  Printer,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowLeft,
  X,
  CreditCard,
  Building2,
  User,
  ShoppingBag,
} from "lucide-react";
import { Invoice, Company, Customer, Product } from "@/lib/types";
import { updateInvoiceStatusAction, convertQuotationToInvoiceAction } from "@/app/actions";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import InvoiceForm from "./InvoiceForm";

interface InvoiceDetailViewProps {
  invoice: Invoice;
  company: Company;
  customers: Customer[];
  products: Product[];
}

export default function InvoiceDetailView({
  invoice: initialInvoice,
  company,
  customers,
  products,
}: InvoiceDetailViewProps) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice>(initialInvoice);
  const [isEditing, setIsEditing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [printDateTime, setPrintDateTime] = useState("");

  const isInterState = invoice.customerSnapshot.stateCode !== company.stateCode;

  // Set the print date/time watermark on the client to avoid hydration mismatch
  useEffect(() => {
    const now = new Date();
    const formatted = now.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    setPrintDateTime(formatted);
  }, []);

  // Status handler
  const handleStatusChange = async (newStatus: "draft" | "sent" | "paid" | "overdue") => {
    setStatusLoading(true);
    try {
      const res = await updateInvoiceStatusAction(invoice.id, newStatus);
      if (res.success) {
        setInvoice((prev) => ({ ...prev, status: newStatus }));
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

  const handleConvertToInvoice = async () => {
    if (!confirm("Are you sure you want to convert this quotation into a commercial Tax Invoice? This will generate a new invoice number and deduct item stock levels.")) {
      return;
    }
    setStatusLoading(true);
    try {
      const res = await convertQuotationToInvoiceAction(invoice.id);
      if (res.success && res.invoice) {
        setInvoice(res.invoice);
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to convert quotation to invoice");
    } finally {
      setStatusLoading(false);
    }
  };

  // Keyboard shortcuts for Print and Download PDF
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey) {
        const key = e.key.toLowerCase();
        if (key === "p") {
          e.preventDefault();
          handlePrint();
        } else if (key === "d") {
          e.preventDefault();
          const link = document.getElementById("download-pdf-link");
          if (link) link.click();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);



  const hasDispatchDetails = !!(
    invoice.meta.deliveryNote ||
    invoice.meta.buyersOrderNo ||
    invoice.meta.dispatchDocNo ||
    invoice.meta.dispatchedThrough
  );

  const hasShipmentDetails = !!(
    invoice.meta.destination ||
    invoice.meta.termsOfDelivery
  );

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm print:hidden">
          <span className="text-sm font-semibold text-slate-500">Editing Mode</span>
          <button
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" /> Cancel Edit
          </button>
        </div>
        <InvoiceForm
          company={company}
          initialCustomers={customers}
          products={products}
          invoice={invoice}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Header Panel */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/invoices")}
              className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-mono text-sm font-bold text-slate-500">
              {invoice.type === "quotation" ? "Quotation Ledger" : "Invoice Ledger"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider",
                invoice.status === "paid" && "bg-emerald-50 text-emerald-700",
                invoice.status === "sent" && "bg-amber-50 text-amber-700",
                invoice.status === "draft" && "bg-slate-100 text-slate-700",
                invoice.status === "overdue" && "bg-rose-50 text-rose-700"
              )}
            >
              {invoice.status}
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {invoice.type === "quotation" ? "Quotation" : "Invoice"} {invoice.invoiceNo}
            </h1>
            <p className="text-sm text-slate-550 mt-1">
              Created on {formatDate(invoice.createdAt)} &bull; Last updated {formatDate(invoice.updatedAt)}
            </p>
          </div>

          {/* Quick Actions Panel */}
          <div className="flex flex-wrap items-center gap-2 sm:self-end">
            {/* Mark status options */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
              <button
                disabled={statusLoading || invoice.status === "paid"}
                onClick={() => handleStatusChange("paid")}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1",
                  invoice.status === "paid"
                    ? "bg-emerald-50 text-emerald-700"
                    : "hover:bg-slate-100 text-slate-500 disabled:opacity-50"
                )}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Mark Paid
              </button>
              <button
                disabled={statusLoading || invoice.status === "sent"}
                onClick={() => handleStatusChange("sent")}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1",
                  invoice.status === "sent"
                    ? "bg-amber-50 text-amber-700"
                    : "hover:bg-slate-100 text-slate-500 disabled:opacity-50"
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                Mark Sent
              </button>
            </div>

            {/* Convert to Invoice */}
            {invoice.type === "quotation" && (
              <button
                disabled={statusLoading}
                onClick={handleConvertToInvoice}
                className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-md shadow-emerald-600/10 cursor-pointer"
              >
                <CheckCircle className="h-4 w-4" />
                Convert to Invoice
              </button>
            )}

            {/* Edit */}
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </button>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-55 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm transition-colors cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>

            {/* PDF API Route Download */}
            <a
              id="download-pdf-link"
              href={`/api/invoices/${invoice.id}/pdf`}
              className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          </div>
        </div>
      </div>

      {/* Invoice Document Layout (Designed for A4 preview & print) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-10 max-w-4xl mx-auto print:border-0 print:shadow-none print:p-0 print:mx-0 print:w-full text-slate-800 relative font-sans text-xs">
        {/* Header Block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b-2 border-slate-800 pb-6">
          {/* Company Details */}
          <div className="flex items-start gap-4">
            {invoice.meta.showLogo !== false && (
              <img src="/logo.png" alt="Lenore Logo" className="h-16 w-auto object-contain shrink-0 bg-slate-50 p-1.5 rounded-xl border border-slate-100 print:bg-transparent print:border-0" />
            )}
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {company.name}
              </h2>
              {company.tagline && (
                <p className="text-[0.72rem] text-slate-500 font-bold italic tracking-wide mt-0.5">
                  {company.tagline}
                </p>
              )}
              <div className="text-slate-600 mt-2.5 space-y-0.5">
                <p>{company.address}</p>
                <p>{company.city} - {company.pincode}, {company.state}</p>
                <p className="font-medium">Phone: {company.phone} &bull; Email: {company.email}</p>
                {company.gstin && (
                  <p className="font-mono font-bold text-slate-900 text-xs mt-1">
                    GSTIN: {company.gstin}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Invoice Document Title & Sequence */}
          <div className="sm:text-right flex flex-col justify-between items-start sm:items-end">
            <div className="bg-slate-900 text-white px-4 py-2 rounded-lg inline-block text-sm font-black uppercase tracking-wider">
              {invoice.type === "quotation"
                ? "QUOTATION"
                : invoice.isGstInvoice
                ? "TAX INVOICE"
                : "INVOICE / BILL"}
            </div>
            <div className="mt-4 sm:mt-0 text-slate-650 space-y-1">
              <div>
                <span className="text-[0.72rem] text-slate-450 font-bold uppercase block sm:inline">
                  {invoice.type === "quotation" ? "Quotation No: " : "Invoice No: "}
                </span>
                <span className="font-black text-slate-900 text-sm">{invoice.invoiceNo}</span>
              </div>
              <div>
                <span className="text-[0.72rem] text-slate-450 font-bold uppercase block sm:inline">
                  {invoice.type === "quotation" ? "Quotation Date: " : "Invoice Date: "}
                </span>
                <span className="font-bold text-slate-800">
                  {formatDate(invoice.invoiceDate)}
                </span>
              </div>
              {invoice.meta.paymentTerms && (
                <div>
                  <span className="text-[0.72rem] text-slate-500 font-bold uppercase block sm:inline">
                    Payment Terms:{" "}
                  </span>
                  <span className="font-semibold text-slate-700">
                    {invoice.meta.paymentTerms}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dispatch details block (Conditionalized to avoid empty layouts) */}
        {hasDispatchDetails && invoice.meta.showTerms !== false && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-slate-200 py-4 text-[0.72rem] text-slate-600 print:py-3">
            {invoice.meta.deliveryNote && (
              <div>
                <div className="font-bold text-slate-500 uppercase">Delivery Note</div>
                <div className="font-bold text-slate-800 mt-0.5">{invoice.meta.deliveryNote}</div>
              </div>
            )}
            {invoice.meta.buyersOrderNo && (
              <div>
                <div className="font-bold text-slate-500 uppercase">Buyer's Order No.</div>
                <div className="font-bold text-slate-800 mt-0.5">
                  {invoice.meta.buyersOrderNo}
                  {invoice.meta.buyersOrderDate && ` dtd. ${formatDate(invoice.meta.buyersOrderDate)}`}
                </div>
              </div>
            )}
            {invoice.meta.dispatchDocNo && (
              <div>
                <div className="font-bold text-slate-500 uppercase">Dispatch Challan / Doc</div>
                <div className="font-bold text-slate-800 mt-0.5">{invoice.meta.dispatchDocNo}</div>
              </div>
            )}
            {invoice.meta.dispatchedThrough && (
              <div>
                <div className="font-bold text-slate-500 uppercase">Dispatched Through</div>
                <div className="font-bold text-slate-800 mt-0.5">{invoice.meta.dispatchedThrough}</div>
              </div>
            )}
          </div>
        )}

        {/* Client snapshot Block */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-slate-200 py-5">
          {/* Bill To */}
          <div className="space-y-1">
            <div className="text-[0.72rem] text-slate-500 font-bold uppercase tracking-wider mb-1">
              Bill To (Buyer)
            </div>
            <h3 className="font-black text-slate-900 text-sm">
              {invoice.customerSnapshot.name}
            </h3>
            <p className="text-slate-600">{invoice.customerSnapshot.address}</p>
            <p className="text-slate-600">
              State: <span className="font-semibold">{invoice.customerSnapshot.state}</span>
              {invoice.customerSnapshot.stateCode && ` (Code: ${invoice.customerSnapshot.stateCode})`}
            </p>
            {invoice.customerSnapshot.gstin && (
              <p className="font-mono font-bold text-slate-900 mt-1">
                GSTIN: {invoice.customerSnapshot.gstin}
              </p>
            )}
          </div>

          {/* Place of supply / Destination (Conditionalized) */}
          {hasShipmentDetails && (
            <div className="sm:text-right space-y-1">
              <div className="text-[0.72rem] text-slate-500 font-bold uppercase tracking-wider mb-1">
                Shipment / Destination
              </div>
              {invoice.meta.destination && (
                <p className="text-slate-700">
                  Destination: <span className="font-bold">{invoice.meta.destination}</span>
                </p>
              )}
              {invoice.meta.termsOfDelivery && (
                <p className="text-slate-600">
                  Terms of Delivery: <span className="font-medium">{invoice.meta.termsOfDelivery}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <div className="py-6 overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[0.72rem] font-bold text-slate-500 uppercase border border-slate-200">
              <tr className="print:bg-slate-100">
                <th className="py-2 px-3 border border-slate-200 text-center w-8">Sl</th>
                <th className="py-2 px-3 border border-slate-200">Description of Goods</th>
                <th className="py-2 px-3 border border-slate-200 text-center">HSN/SAC</th>
                <th className="py-2 px-3 border border-slate-200 text-right w-12">Qty</th>
                <th className="py-2 px-3 border border-slate-200 text-center w-12">Unit</th>
                <th className="py-2 px-3 border border-slate-200 text-right">Rate</th>
                <th className="py-2 px-3 border border-slate-200 text-right">Disc %</th>
                <th className="py-2 px-3 border border-slate-200 text-right">Taxable Val</th>
                {invoice.isGstInvoice && (
                  <>
                    {!isInterState ? (
                      <>
                        <th className="py-2 px-3 border border-slate-200 text-right">CGST</th>
                        <th className="py-2 px-3 border border-slate-200 text-right">SGST</th>
                      </>
                    ) : (
                      <th className="py-2 px-3 border border-slate-200 text-right">IGST</th>
                    )}
                  </>
                )}
                <th className="py-2 px-3 border border-slate-200 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item) => (
                <tr key={item.slNo} className="hover:bg-slate-50/50 print:break-inside-avoid">
                  <td className="py-2.5 px-3 border border-slate-200 text-center">{item.slNo}</td>
                  <td className="py-2.5 px-3 border border-slate-200 font-bold text-slate-900">
                    {item.description}
                  </td>
                  <td className="py-2.5 px-3 border border-slate-200 text-center font-mono text-[0.72rem]">
                    {item.hsnCode || "-"}
                  </td>
                  <td className="py-2.5 px-3 border border-slate-200 text-right">{item.quantity}</td>
                  <td className="py-2.5 px-3 border border-slate-200 text-center text-slate-500 uppercase text-[0.68rem] font-semibold">
                    {item.unit}
                  </td>
                  <td className="py-2.5 px-3 border border-slate-200 text-right">{formatCurrency(item.rate)}</td>
                  <td className="py-2.5 px-3 border border-slate-200 text-right">
                    {item.discountPercent > 0 ? `${item.discountPercent}%` : "-"}
                  </td>
                  <td className="py-2.5 px-3 border border-slate-200 text-right">
                    {formatCurrency(item.taxableValue)}
                  </td>
                  {invoice.isGstInvoice && (
                    <>
                      {!isInterState ? (
                        <>
                          <td className="py-2.5 px-3 border border-slate-200 text-right">
                            <div className="font-bold text-slate-800">{formatCurrency(item.cgstAmount)}</div>
                            <div className="text-[8px] text-slate-500 font-semibold">
                              ({(item.gstPercent / 2).toFixed(1)}%)
                            </div>
                          </td>
                          <td className="py-2.5 px-3 border border-slate-200 text-right">
                            <div className="font-bold text-slate-800">{formatCurrency(item.sgstAmount)}</div>
                            <div className="text-[8px] text-slate-500 font-semibold">
                              ({(item.gstPercent / 2).toFixed(1)}%)
                            </div>
                          </td>
                        </>
                      ) : (
                        <td className="py-2.5 px-3 border border-slate-200 text-right">
                          <div className="font-bold text-slate-800">{formatCurrency(item.igstAmount)}</div>
                          <div className="text-[8px] text-slate-500 font-semibold">
                            ({item.gstPercent}%)
                          </div>
                        </td>
                      )}
                    </>
                  )}
                  <td className="py-2.5 px-3 border border-slate-200 text-right font-bold text-slate-900">
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-start border-t border-slate-200 pt-6 print:break-inside-avoid">
          {/* Bank Details & Words */}
          <div className="sm:col-span-7 space-y-4">
            {/* Amount in words */}
            <div>
              <div className="text-[0.68rem] text-slate-500 font-bold uppercase tracking-wider">
                Amount Chargeable (in words)
              </div>
              <div className="font-bold text-slate-900 mt-1 capitalize leading-snug">
                {invoice.amountInWords}
              </div>
            </div>

            {/* Company Bank details */}
            {invoice.meta.showBankDetails !== false && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 print:bg-white print:break-inside-avoid">
                <div className="text-[0.68rem] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5 text-slate-500" /> Company Bank Account
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-700">
                  <div>
                    <span className="text-[0.68rem] text-slate-500 font-medium block">Bank Name</span>
                    <span className="font-bold text-slate-800 text-[0.76rem]">
                      {company.bank.bankName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[0.68rem] text-slate-500 font-medium block">Account Number</span>
                    <span className="font-bold text-slate-900 text-[0.76rem] font-mono">
                      {company.bank.accountNo}
                    </span>
                  </div>
                  <div>
                    <span className="text-[0.68rem] text-slate-500 font-medium block">IFSC Code</span>
                    <span className="font-bold text-slate-900 text-[0.76rem] font-mono">
                      {company.bank.ifsc}
                    </span>
                  </div>
                  <div>
                    <span className="text-[0.68rem] text-slate-500 font-medium block">Branch</span>
                    <span className="font-bold text-slate-800 text-[0.76rem]">
                      {company.bank.branch}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Math breakdown */}
          <div className="sm:col-span-5 border border-slate-200 rounded-xl overflow-hidden text-sm print:break-inside-avoid">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider print:bg-slate-100">
              Totals Calculation
            </div>
            <div className="p-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-700">
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
              {invoice.totalDiscount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Total Discount:</span>
                  <span className="font-semibold text-rose-500">
                    -{formatCurrency(invoice.totalDiscount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-800 font-bold border-t border-slate-100 pt-2">
                <span>Taxable Value:</span>
                <span>{formatCurrency(invoice.taxableValueTotal)}</span>
              </div>

              {/* GST divisions */}
              {invoice.isGstInvoice && (
                <div className="space-y-1.5 pt-1.5 border-t border-slate-100 text-slate-500">
                  {!isInterState ? (
                    <>
                      <div className="flex justify-between text-[0.76rem]">
                        <span>CGST Total:</span>
                        <span>{formatCurrency(invoice.cgstTotal)}</span>
                      </div>
                      <div className="flex justify-between text-[0.76rem]">
                        <span>SGST Total:</span>
                        <span>{formatCurrency(invoice.sgstTotal)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-[0.76rem]">
                      <span>IGST Total:</span>
                      <span>{formatCurrency(invoice.igstTotal)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Freight */}
              {invoice.freight > 0 && (
                <div className="flex justify-between text-slate-500 border-t border-slate-100 pt-2">
                  <span>Freight Charge:</span>
                  <span className="font-semibold text-slate-700">
                    {formatCurrency(invoice.freight)}
                  </span>
                </div>
              )}

              {/* Round off */}
              {invoice.roundOff !== 0 && (
                <div className="flex justify-between text-slate-500 text-[0.72rem]">
                  <span>Round-off:</span>
                  <span>
                    {invoice.roundOff > 0 ? "+" : ""}
                    {invoice.roundOff}
                  </span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-between items-baseline border-t border-slate-800 pt-3 mt-1.5">
                <span className="font-black text-slate-900">Grand Total:</span>
                <span className="text-xl font-black text-indigo-700">
                  {formatCurrency(invoice.grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Declarations and Signature lines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-end border-t border-slate-300 pt-8 mt-8 text-[0.72rem] text-slate-600 print:break-inside-avoid">
          <div>
            {invoice.meta.showDeclaration !== false && (
              <>
                <div className="font-bold text-slate-800 uppercase">Declaration</div>
                <p className="mt-1.5 leading-relaxed text-slate-500">
                  We declare that this invoice shows the actual price of the goods described and that all
                  particulars are true and correct. Goods once sold will not be taken back.
                </p>
              </>
            )}
          </div>
          <div className="sm:text-right space-y-12">
            <div>
              <span className="text-slate-500 font-semibold block">for</span>
              <span className="font-bold text-slate-900 uppercase block">{company.name}</span>
            </div>
            <div>
              <span className="border-t border-slate-300 pt-2 px-6 font-bold text-slate-700 inline-block">
                Authorised Signatory
              </span>
            </div>
          </div>
        </div>

        {/* Footer print line */}
        <div className="text-center text-[0.68rem] text-slate-400 font-medium uppercase tracking-wider mt-12 pt-6 border-t border-slate-100 relative">
          This is a computer generated invoice and requires no physical signature.
          {printDateTime && (
            <div className="hidden print:block absolute right-0 bottom-0 text-[8px] text-slate-500 font-mono font-bold lowercase tracking-normal">
              printed on: {printDateTime}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
