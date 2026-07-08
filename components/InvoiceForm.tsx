"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Save,
  ChevronDown,
  Percent,
  Search,
  ArrowLeft,
  Loader2,
  HelpCircle,
  FileSpreadsheet,
  Camera,
} from "lucide-react";
import { Customer, Product, Company, Invoice } from "@/lib/types";
import { createInvoiceAction, updateInvoiceAction } from "@/app/actions";
import { formatCurrency, cn } from "@/lib/utils";
import CustomerDialog from "./CustomerDialog";
import QrScannerDialog from "./QrScannerDialog";
import ProductDialog from "./ProductDialog";
import { resumeSharedAudio } from "@/lib/audio";

// Standard unit list
const UNITS = ["pcs", "set", "mtr", "box", "nos"];

interface InvoiceFormProps {
  company: Company;
  initialCustomers: Customer[];
  products: Product[];
  invoice?: Invoice | null; // For edit mode
}

interface FormLineItem {
  id: string; // client-only key
  productId: string;
  description: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent: number;
  gstPercent: number;
}

export default function InvoiceForm({
  company,
  initialCustomers,
  products: initialProducts,
  invoice,
}: InvoiceFormProps) {
  const router = useRouter();
  const isEditMode = !!invoice;

  // Customers state (for inline additions)
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Products state (for inline additions)
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productModalTargetIndex, setProductModalTargetIndex] = useState<number | null>(null);

  // QR Scanner States
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrTargetLineIndex, setQrTargetLineIndex] = useState<number | null>(null);

  // Form States
  const [selectedCustomerId, setSelectedCustomerId] = useState(invoice?.customerId || "");
  const [invoiceDate, setInvoiceDate] = useState(
    invoice?.invoiceDate ? invoice.invoiceDate.split("T")[0] : new Date().toISOString().split("T")[0]
  );
  const [isGstInvoice, setIsGstInvoice] = useState(invoice ? invoice.isGstInvoice : true);
  const [freight, setFreight] = useState<number>(invoice?.freight || 0);
  const [remarks, setRemarks] = useState(invoice?.remarks || "");
  const [status, setStatus] = useState<"draft" | "sent" | "paid" | "overdue">(
    invoice?.status || "sent"
  );
  const [docType, setDocType] = useState<"invoice" | "quotation">(
    invoice?.type || "invoice"
  );

  // Invoice Metadata
  const [paymentTerms, setPaymentTerms] = useState(invoice?.meta.paymentTerms || "Cash / 15 Days");
  const [deliveryNote, setDeliveryNote] = useState(invoice?.meta.deliveryNote || "");
  const [buyersOrderNo, setBuyersOrderNo] = useState(invoice?.meta.buyersOrderNo || "");
  const [buyersOrderDate, setBuyersOrderDate] = useState(
    invoice?.meta.buyersOrderDate ? invoice.meta.buyersOrderDate.split("T")[0] : ""
  );
  const [dispatchDocNo, setDispatchDocNo] = useState(invoice?.meta.dispatchDocNo || "");
  const [dispatchedThrough, setDispatchedThrough] = useState(invoice?.meta.dispatchedThrough || "");
  const [destination, setDestination] = useState(invoice?.meta.destination || "");
  const [termsOfDelivery, setTermsOfDelivery] = useState(invoice?.meta.termsOfDelivery || "");

  // Print Visibility Options
  const [showLogo, setShowLogo] = useState(invoice?.meta?.showLogo !== false);
  const [showBankDetails, setShowBankDetails] = useState(invoice?.meta?.showBankDetails !== false);
  const [showDeclaration, setShowDeclaration] = useState(invoice?.meta?.showDeclaration !== false);
  const [showTerms, setShowTerms] = useState(invoice?.meta?.showTerms !== false);

  // Line items state
  const [lineItems, setLineItems] = useState<FormLineItem[]>(() => {
    if (invoice && invoice.lineItems) {
      return invoice.lineItems.map((item) => ({
        id: String(item.slNo),
        productId: item.productId || "",
        description: item.description,
        hsnCode: item.hsnCode || "",
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        discountPercent: item.discountPercent,
        gstPercent: item.gstPercent,
      }));
    }
    return [
      {
        id: "1",
        productId: "",
        description: "",
        hsnCode: "",
        quantity: 1,
        unit: "pcs",
        rate: 0,
        discountPercent: 0,
        gstPercent: 18,
      },
    ];
  });

  // Default Discount Segment state & handlers
  const [defaultDiscountType, setDefaultDiscountType] = useState<"none" | "customer" | "sales" | "wholesale">("none");

  const getDiscountValue = (type: "none" | "customer" | "sales" | "wholesale") => {
    switch (type) {
      case "customer":
        return company.discountCustomer ?? 0;
      case "sales":
        return company.discountSales ?? 0;
      case "wholesale":
        return company.discountWholesale ?? 0;
      default:
        return 0;
    }
  };

  const applyDefaultDiscount = (type: "none" | "customer" | "sales" | "wholesale") => {
    setDefaultDiscountType(type);
    if (type !== "none") {
      const value = getDiscountValue(type);
      setLineItems((prev) =>
        prev.map((item) => ({
          ...item,
          discountPercent: value,
        }))
      );
    }
  };

  const [activeProductSearchIndex, setActiveProductSearchIndex] = useState<number | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveProductSearchIndex(null);
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Keyboard shortcuts for Add Item and Save Invoice
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey) {
        const key = e.key.toLowerCase();
        if (key === "a") {
          e.preventDefault();
          addLineItem();
        } else if (key === "s") {
          e.preventDefault();
          const btn = document.getElementById("submit-invoice-btn");
          if (btn) btn.click();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lineItems]);

  // Lookup selected customer
  const currentCustomer = customers.find((c) => c.id === selectedCustomerId);
  const isInterState = currentCustomer ? currentCustomer.stateCode !== company.stateCode : false;

  // Handle customer added quick modal
  const handleCustomerAdded = (newCust: Customer) => {
    setCustomers((prev) => [newCust, ...prev]);
    setSelectedCustomerId(newCust.id);
  };

  // Handle product added quick modal
  const handleProductCreated = (newProd: Product) => {
    setProducts((prev) => [newProd, ...prev]);
    if (productModalTargetIndex !== null) {
      selectProductForLine(productModalTargetIndex, newProd);
    }
  };

  // Autocomplete products list
  const filteredProducts = products.filter((p) => {
    const q = productSearchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.code && p.code.toLowerCase().includes(q))
    );
  }).slice(0, 8); // limit results for speed

  // Line item manipulation
  const addLineItem = () => {
    const nextId = "item_" + Math.random().toString(36).substring(2, 9);
    setLineItems([
      ...lineItems,
      {
        id: nextId,
        productId: "",
        description: "",
        hsnCode: "",
        quantity: 1,
        unit: "pcs",
        rate: 0,
        discountPercent: getDiscountValue(defaultDiscountType),
        gstPercent: 18,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, fields: Partial<FormLineItem>) => {
    setLineItems(
      lineItems.map((item) => (item.id === id ? { ...item, ...fields } : item))
    );
  };

  const selectProductForLine = (index: number, product: Product) => {
    const items = [...lineItems];
    items[index] = {
      ...items[index],
      productId: product.id,
      description: product.name,
      hsnCode: product.hsnCode || "",
      unit: product.unit,
      rate: product.defaultRate,
      gstPercent: product.defaultGstPercent,
    };
    setLineItems(items);
    setActiveProductSearchIndex(null);
  };

  const handleQrScanSuccess = (scannedCode: string) => {
    const normalized = scannedCode.trim().toLowerCase();
    const matchedProduct = products.find(
      (p) => p.code?.trim().toLowerCase() === normalized || p.id.trim().toLowerCase() === normalized
    );

    if (matchedProduct) {
      if (qrTargetLineIndex !== null) {
        selectProductForLine(qrTargetLineIndex, matchedProduct);
      } else {
        const nextId = "item_" + Math.random().toString(36).substring(2, 9);
        setLineItems([
          ...lineItems,
          {
            id: nextId,
            productId: matchedProduct.id,
            description: matchedProduct.name,
            hsnCode: matchedProduct.hsnCode || "",
            quantity: 1,
            unit: matchedProduct.unit,
            rate: matchedProduct.defaultRate,
            discountPercent: getDiscountValue(defaultDiscountType),
            gstPercent: matchedProduct.defaultGstPercent,
          },
        ]);
      }
    } else {
      alert(`No matching product found in catalog for barcode: "${scannedCode}"`);
    }
  };

  // --- Dynamic Live Calculations ---
  let calculatedSubtotal = 0;
  let calculatedTotalDiscount = 0;
  let calculatedTaxableValueTotal = 0;
  let calculatedCgstTotal = 0;
  let calculatedSgstTotal = 0;
  let calculatedIgstTotal = 0;

  const processedLines = lineItems.map((item, index) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const discPercent = Number(item.discountPercent) || 0;
    const gstPercent = isGstInvoice ? Number(item.gstPercent) || 0 : 0;

    const rowSubtotal = qty * rate;
    const rowDiscount = rowSubtotal * (discPercent / 100);
    const rowTaxable = Math.round((rowSubtotal - rowDiscount + Number.EPSILON) * 100) / 100;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isGstInvoice) {
      if (isInterState) {
        igst = Math.round((rowTaxable * (gstPercent / 100) + Number.EPSILON) * 100) / 100;
      } else {
        cgst = Math.round((rowTaxable * (gstPercent / 200) + Number.EPSILON) * 100) / 100;
        sgst = Math.round((rowTaxable * (gstPercent / 200) + Number.EPSILON) * 100) / 100;
      }
    }

    const rowTotal = Math.round((rowTaxable + cgst + sgst + igst + Number.EPSILON) * 100) / 100;

    calculatedSubtotal += rowSubtotal;
    calculatedTotalDiscount += rowDiscount;
    calculatedTaxableValueTotal += rowTaxable;
    calculatedCgstTotal += cgst;
    calculatedSgstTotal += sgst;
    calculatedIgstTotal += igst;

    return {
      subtotal: rowSubtotal,
      discount: rowDiscount,
      taxableValue: rowTaxable,
      cgst,
      sgst,
      igst,
      total: rowTotal,
    };
  });

  calculatedSubtotal = Math.round((calculatedSubtotal + Number.EPSILON) * 100) / 100;
  calculatedTotalDiscount = Math.round((calculatedTotalDiscount + Number.EPSILON) * 100) / 100;
  calculatedTaxableValueTotal = Math.round((calculatedTaxableValueTotal + Number.EPSILON) * 100) / 100;
  calculatedCgstTotal = Math.round((calculatedCgstTotal + Number.EPSILON) * 100) / 100;
  calculatedSgstTotal = Math.round((calculatedSgstTotal + Number.EPSILON) * 100) / 100;
  calculatedIgstTotal = Math.round((calculatedIgstTotal + Number.EPSILON) * 100) / 100;

  const rawGrandTotal = calculatedTaxableValueTotal + calculatedCgstTotal + calculatedSgstTotal + calculatedIgstTotal + Number(freight);
  const calculatedGrandTotal = Math.round(rawGrandTotal);
  const calculatedRoundOff = Math.round((calculatedGrandTotal - rawGrandTotal + Number.EPSILON) * 100) / 100;

  // Submit invoice to server action
  const handleSave = async () => {
    if (!selectedCustomerId) {
      setErrors({ customerId: "Please select a customer" });
      return;
    }

    // Filter empty lines
    const validLineItems = lineItems.filter((l) => l.description.trim() !== "");
    if (validLineItems.length === 0) {
      setErrors({ lineItems: "Please add at least one line item with a description" });
      return;
    }

    setLoading(true);
    setErrors({});

    const payload = {
      invoiceDate: new Date(invoiceDate).toISOString(),
      isGstInvoice,
      customerId: selectedCustomerId,
      type: docType,
      meta: {
        deliveryNote: deliveryNote || null,
        buyersOrderNo: buyersOrderNo || null,
        buyersOrderDate: buyersOrderDate ? new Date(buyersOrderDate).toISOString() : null,
        dispatchDocNo: dispatchDocNo || null,
        dispatchedThrough: dispatchedThrough || null,
        paymentTerms,
        destination: destination || null,
        termsOfDelivery: termsOfDelivery || null,
        showLogo,
        showBankDetails,
        showDeclaration,
        showTerms,
      },
      lineItems: validLineItems.map((item) => ({
        productId: item.productId || null,
        description: item.description,
        hsnCode: item.hsnCode || null,
        quantity: Number(item.quantity) || 1,
        unit: item.unit,
        rate: Number(item.rate) || 0,
        discountPercent: Number(item.discountPercent) || 0,
        gstPercent: Number(item.gstPercent) || 0,
      })),
      freight: Number(freight) || 0,
      remarks: remarks || null,
      status,
    };

    try {
      let result;
      if (isEditMode && invoice) {
        result = await updateInvoiceAction(invoice.id, payload);
      } else {
        result = await createInvoiceAction(payload);
      }

      if (result.success && result.invoice) {
        router.push(`/invoices/${result.invoice.id}`);
      }
    } catch (err: any) {
      console.error(err);
      setErrors({ general: err.message || "Failed to save invoice" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header and Back navigation */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
            POS Terminal
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {isEditMode 
                ? `Edit ${invoice.type === "quotation" ? "Quotation" : "Invoice"} - ${invoice.invoiceNo}` 
                : `Create New ${docType === "quotation" ? "Quotation" : "Billing Invoice"}`}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Issue commercial tax invoices or simple quotations and bills to dealers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Document Type Selector */}
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase">Type:</span>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as "invoice" | "quotation")}
                disabled={isEditMode}
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="invoice">Tax Invoice</option>
                <option value="quotation">Quotation</option>
              </select>
            </div>

            {/* Status Selector */}
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase">Status:</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer capitalize"
              >
                <option value="sent">Sent / Pending</option>
                <option value="draft">Draft</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {errors.general && (
        <div className="p-4 bg-rose-50 text-rose-700 text-sm font-semibold rounded-xl">
          {errors.general}
        </div>
      )}

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 columns: Customer Details, Line Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & General Block */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-50 pb-3 flex items-center justify-between">
              <span>Customer Details</span>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Quick-Add Customer
              </button>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Customer *
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                  className={cn(
                    "w-full text-sm rounded-lg border px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors text-slate-800",
                    errors.customerId ? "border-rose-400 focus:border-rose-500" : "border-slate-200"
                  )}
                >
                  <option value="">-- Choose customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city})
                    </option>
                  ))}
                </select>
                {errors.customerId && (
                  <span className="text-xs text-rose-500 mt-1">{errors.customerId}</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Invoice Date
                </label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none transition-colors text-slate-800"
                />
              </div>
            </div>

            {/* Default Discount Toggle & Segment Select */}
            <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="defaultDiscountToggle"
                  checked={defaultDiscountType !== "none"}
                  onChange={(e) => {
                    const nextType = e.target.checked ? "customer" : "none";
                    applyDefaultDiscount(nextType);
                  }}
                  className="rounded border-slate-350 text-indigo-605 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="defaultDiscountToggle" className="text-xs font-bold text-slate-700 uppercase tracking-wider cursor-pointer select-none">
                  Set Default Discount Profile
                </label>
              </div>

              {defaultDiscountType !== "none" && (
                <div className="flex items-center gap-2 shrink-0 animate-in fade-in duration-200">
                  <span className="text-xs font-semibold text-slate-500">Discount Segment:</span>
                  <select
                    value={defaultDiscountType}
                    onChange={(e) => applyDefaultDiscount(e.target.value as any)}
                    className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
                  >
                    <option value="customer">Customer Preset ({company.discountCustomer ?? 0}%)</option>
                    <option value="sales">Sales Promo Preset ({company.discountSales ?? 0}%)</option>
                    <option value="wholesale">Wholesale Preset ({company.discountWholesale ?? 0}%)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Quick snapshot of selected customer */}
            {currentCustomer && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase">Customer Snapshot</span>
                  <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {isInterState ? "Inter-state (IGST)" : "Intra-state (CGST + SGST)"}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">{currentCustomer.name}</div>
                <div className="text-xs text-slate-500">
                  {currentCustomer.address}, {currentCustomer.city}, {currentCustomer.state} -{" "}
                  {currentCustomer.pincode}
                </div>
                {currentCustomer.gstin && (
                  <div className="text-xs font-mono font-bold text-slate-800 mt-1">
                    GSTIN: {currentCustomer.gstin}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Line Items Block */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h2 className="text-base font-bold text-slate-800">Line Items</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase">GST Toggle:</span>
                <button
                  type="button"
                  onClick={() => setIsGstInvoice(!isGstInvoice)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    isGstInvoice ? "bg-indigo-600" : "bg-slate-200"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      isGstInvoice ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
                <span className="text-xs font-bold text-slate-700">
                  {isGstInvoice ? "GST Invoice" : "Simple Bill"}
                </span>
              </div>
            </div>

            {errors.lineItems && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg">
                {errors.lineItems}
              </div>
            )}

            {/* Line items desktop grid / mobile layouts */}
            <div className="space-y-4">
              {lineItems.map((item, index) => {
                const calculations = processedLines[index];
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3 relative group"
                  >
                    {/* Index & delete */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-400">Sl No. {index + 1}</span>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      )}
                    </div>

                    {/* Product autocomplete and details */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      {/* Product select & Description */}
                      <div className="sm:col-span-2 relative">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Product Name / Description *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Type description or search..."
                            value={item.description}
                            onChange={(e) => {
                              updateLineItem(item.id, { description: e.target.value, productId: "" });
                              setProductSearchQuery(e.target.value);
                              setActiveProductSearchIndex(index);
                            }}
                            onFocus={() => {
                              setProductSearchQuery(item.description);
                              setActiveProductSearchIndex(index);
                            }}
                            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              resumeSharedAudio();
                              setQrTargetLineIndex(index);
                              setIsQrScannerOpen(true);
                            }}
                            className="p-2 border border-slate-200 hover:border-indigo-400 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors bg-white shrink-0 flex items-center justify-center"
                            title="Scan QR Code"
                          >
                            <Camera className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Search Autocomplete dropdown popup */}
                        {activeProductSearchIndex === index && (
                          <div
                            ref={dropdownRef}
                            className="absolute left-0 right-0 z-20 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto"
                          >
                            <div className="p-2 border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                              <span>Catalog Autocomplete</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setProductModalTargetIndex(index);
                                  setIsProductModalOpen(true);
                                }}
                                className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md hover:border-indigo-400 transition-colors cursor-pointer"
                              >
                                + Add New Product
                              </button>
                            </div>
                            {filteredProducts.length === 0 ? (
                              <div className="p-4 text-xs text-slate-400 italic flex flex-col gap-2 items-center justify-center">
                                <span>No matching catalog items</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProductModalTargetIndex(index);
                                    setIsProductModalOpen(true);
                                  }}
                                  className="text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-lg transition-colors shadow-sm cursor-pointer"
                                >
                                  + Create New Product
                                </button>
                              </div>
                            ) : (
                              filteredProducts.map((prod) => (
                                <button
                                  key={prod.id}
                                  type="button"
                                  onClick={() => selectProductForLine(index, prod)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 transition-colors flex justify-between border-b border-slate-50 last:border-0"
                                >
                                  <div>
                                    <div className="font-bold text-slate-800">{prod.name}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                      Code: {prod.code || "N/A"} | HSN: {prod.hsnCode || "N/A"} | Stock:{" "}
                                      {prod.stock !== undefined && prod.stock <= 0 ? (
                                        <span className="text-rose-600 font-bold">Out of stock</span>
                                      ) : prod.stock !== undefined && prod.stock <= 10 ? (
                                        <span className="text-amber-600 font-bold">Low ({prod.stock})</span>
                                      ) : (
                                        <span className="text-emerald-600 font-bold">{prod.stock ?? 100} avail</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="font-bold text-slate-900">
                                      {formatCurrency(prod.defaultRate)}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      GST {prod.defaultGstPercent}%
                                    </div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* HSN Code */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          HSN/SAC Code
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 8481.80.20"
                          value={item.hsnCode}
                          onChange={(e) => updateLineItem(item.id, { hsnCode: e.target.value })}
                          className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white font-mono"
                        />
                      </div>

                      {/* Unit */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Unit
                        </label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateLineItem(item.id, { unit: e.target.value })}
                          className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 bg-white focus:border-indigo-500 focus:outline-none"
                        >
                          {UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Numeric parameters grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                      {/* Quantity */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="0.001"
                          step="any"
                          required
                          value={item.quantity}
                          onChange={(e) =>
                            updateLineItem(item.id, { quantity: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white font-mono"
                        />
                        {(() => {
                          const linkedProd = products.find((p) => p.id === item.productId);
                          const isStockInsufficient = linkedProd && item.quantity > (linkedProd.stock ?? 0);
                          if (isStockInsufficient) {
                            return (
                              <span className="text-[9px] text-rose-605 font-bold block mt-0.5 leading-none">
                                ⚠️ Exceeds stock ({linkedProd.stock ?? 0} avail)
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Rate */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Base Rate (INR)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={item.rate}
                          onChange={(e) =>
                            updateLineItem(item.id, { rate: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                        />
                      </div>

                      {/* Discount % */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Discount %
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.discountPercent}
                          onChange={(e) =>
                            updateLineItem(item.id, {
                              discountPercent: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none bg-white"
                        />
                      </div>

                      {/* GST % (only enabled/visible if GST invoice toggle is on) */}
                      {isGstInvoice ? (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            GST %
                          </label>
                          <select
                            value={item.gstPercent}
                            onChange={(e) =>
                              updateLineItem(item.id, {
                                gstPercent: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 bg-white focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                          </select>
                        </div>
                      ) : (
                        <div className="hidden sm:block opacity-40">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            GST %
                          </label>
                          <div className="w-full text-sm rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 font-medium text-slate-500">
                            Exempt
                          </div>
                        </div>
                      )}

                      {/* Row calculated Total */}
                      <div className="col-span-2 sm:col-span-1 text-right sm:text-left self-end">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Taxable Value
                        </div>
                        <div className="text-sm font-extrabold text-slate-800 py-1.5">
                          {formatCurrency(calculations.taxableValue)}
                        </div>
                      </div>
                    </div>

                    {/* Tax breakup feedback for user check */}
                    {isGstInvoice && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-semibold">
                        <span>GST: {item.gstPercent}%</span>
                        {!isInterState ? (
                          <>
                            <span>CGST ({(item.gstPercent / 2).toFixed(1)}%): {formatCurrency(calculations.cgst)}</span>
                            <span>SGST ({(item.gstPercent / 2).toFixed(1)}%): {formatCurrency(calculations.sgst)}</span>
                          </>
                        ) : (
                          <span>IGST ({item.gstPercent}%): {formatCurrency(calculations.igst)}</span>
                        )}
                        <span className="ml-auto text-slate-800 font-extrabold">
                          Total Amount: {formatCurrency(calculations.total)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add More Items Button and QR Scanner Button row */}
            <div className="grid grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={addLineItem}
                className="py-3 border border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/10 text-slate-700 hover:text-indigo-600 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 bg-white shadow-sm"
              >
                <Plus className="h-4.5 w-4.5" />
                Add Line Item
              </button>
              
              <button
                type="button"
                onClick={() => {
                  resumeSharedAudio();
                  setQrTargetLineIndex(null);
                  setIsQrScannerOpen(true);
                }}
                className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all duration-155 flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 active:scale-95"
              >
                <Camera className="h-4.5 w-4.5" />
                Scan QR to Add
              </button>
            </div>
          </div>
        </div>

        {/* Right column: Delivery, Transport details and Invoice Totals summary */}
        <div className="space-y-6">
          {/* Dispatch & Delivery details */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-50 pb-3">
              Dispatch & Terms
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Payment Terms *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cash / 15 Days Net"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Delivery Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Immediate Delivery / Site F.O.R."
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Buyer's Order No.
                  </label>
                  <input
                    type="text"
                    placeholder="PO number"
                    value={buyersOrderNo}
                    onChange={(e) => setBuyersOrderNo(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Order Date
                  </label>
                  <input
                    type="date"
                    value={buyersOrderDate}
                    onChange={(e) => setBuyersOrderDate(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Dispatch Doc No.
                  </label>
                  <input
                    type="text"
                    placeholder="Challan / LR no"
                    value={dispatchDocNo}
                    onChange={(e) => setDispatchDocNo(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Dispatched Through
                  </label>
                  <input
                    type="text"
                    placeholder="Transport service"
                    value={dispatchedThrough}
                    onChange={(e) => setDispatchedThrough(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Destination
                  </label>
                  <input
                    type="text"
                    placeholder="Delivery city"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Terms of Delivery
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Paid by buyer"
                    value={termsOfDelivery}
                    onChange={(e) => setTermsOfDelivery(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Print Options */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 border-b border-slate-50 pb-3">
              Print Details Configuration
            </h2>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer py-1 select-none">
                <input
                  type="checkbox"
                  checked={showLogo}
                  onChange={(e) => setShowLogo(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 border-slate-350 cursor-pointer"
                />
                <span className="text-sm font-semibold text-slate-705">Show Brand Logo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer py-1 select-none">
                <input
                  type="checkbox"
                  checked={showBankDetails}
                  onChange={(e) => setShowBankDetails(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 border-slate-350 cursor-pointer"
                />
                <span className="text-sm font-semibold text-slate-705">Show Bank Account Details</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer py-1 select-none">
                <input
                  type="checkbox"
                  checked={showDeclaration}
                  onChange={(e) => setShowDeclaration(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 border-slate-350 cursor-pointer"
                />
                <span className="text-sm font-semibold text-slate-705">Show Terms & Declaration</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer py-1 select-none">
                <input
                  type="checkbox"
                  checked={showTerms}
                  onChange={(e) => setShowTerms(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 border-slate-350 cursor-pointer"
                />
                <span className="text-sm font-semibold text-slate-705">Show Dispatch Info</span>
              </label>
            </div>
          </div>

          {/* Calculations Totals Block */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-white shadow-xl space-y-6">
            <h2 className="text-base font-bold tracking-wide uppercase text-slate-400 border-b border-slate-800 pb-3 flex items-center justify-between">
              <span>Billing Summary</span>
              <FileSpreadsheet className="h-5 w-5 text-indigo-400" />
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal (Base Value):</span>
                <span className="font-semibold text-slate-200">
                  {formatCurrency(calculatedSubtotal)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Discount:</span>
                <span className="font-semibold text-rose-400">
                  -{formatCurrency(calculatedTotalDiscount)}
                </span>
              </div>
              <div className="flex justify-between text-slate-300 font-bold border-t border-slate-800 pt-2">
                <span>Taxable Value Total:</span>
                <span>{formatCurrency(calculatedTaxableValueTotal)}</span>
              </div>

              {/* GST Division breakdown */}
              {isGstInvoice && (
                <div className="p-3 bg-slate-950/40 rounded-xl space-y-2 mt-2 border border-slate-800/40">
                  {!isInterState ? (
                    <>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>CGST Total:</span>
                        <span>{formatCurrency(calculatedCgstTotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>SGST Total:</span>
                        <span>{formatCurrency(calculatedSgstTotal)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>IGST Total:</span>
                      <span>{formatCurrency(calculatedIgstTotal)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Freight Charge input */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                <span className="text-slate-400">Freight/Transport Charges:</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={freight || ""}
                  onChange={(e) => setFreight(parseFloat(e.target.value) || 0)}
                  className="w-24 text-right text-sm rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 focus:border-indigo-500 focus:outline-none font-bold text-slate-200"
                  placeholder="0.00"
                />
              </div>

              {/* Round-off */}
              {calculatedRoundOff !== 0 && (
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Round-off adjustment:</span>
                  <span>
                    {calculatedRoundOff > 0 ? "+" : ""}
                    {calculatedRoundOff}
                  </span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-between items-baseline border-t border-slate-800 pt-4 mt-2">
                <span className="text-base font-bold text-slate-200">Grand Total:</span>
                <span className="text-3xl font-black text-white tracking-tight">
                  {formatCurrency(calculatedGrandTotal)}
                </span>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Remarks / Payment Instructions
              </label>
              <textarea
                placeholder="e.g. Bank details inside, thank you..."
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 focus:border-indigo-500 focus:outline-none text-slate-200 placeholder-slate-600"
              />
            </div>

            {/* Actions panel */}
            <div className="pt-2">
              <button
                id="submit-invoice-btn"
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-75"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                {isEditMode ? "Save Changes" : "Record Invoice"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Quick Add Modal Dialog */}
      <CustomerDialog
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={handleCustomerAdded}
      />

      {/* QR Scanner Dialog Overlay */}
      <QrScannerDialog
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onScanSuccess={handleQrScanSuccess}
      />

      {/* Product Quick Add Modal Dialog */}
      <ProductDialog
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setProductModalTargetIndex(null);
        }}
        onSuccess={handleProductCreated}
      />
    </div>
  );
}
