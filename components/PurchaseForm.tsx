"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Keyboard, ShoppingCart, IndianRupee } from "lucide-react";
import { Company, Product, Purchase } from "@/lib/types";
import { calculateLineItem, calculateInvoiceTotals } from "@/lib/calculations";
import { createPurchaseAction, updatePurchaseAction } from "@/app/actions";
import ProductDialog from "./ProductDialog";
import { cn, formatCurrency } from "@/lib/utils";

interface FormLineItem {
  id: string;
  productId: string;
  description: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent: number;
  gstPercent: number;
}

interface PurchaseFormProps {
  company: Company;
  products: Product[];
  purchase?: Purchase;
}

export default function PurchaseForm({ company, products: initialProducts, purchase }: PurchaseFormProps) {
  const router = useRouter();
  const isEditMode = !!purchase;

  // Local products state to support inline additions
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productModalTargetIndex, setProductModalTargetIndex] = useState<number | null>(null);

  // Form Fields
  const [supplierName, setSupplierName] = useState(purchase?.supplierName || "");
  const [supplierGstin, setSupplierGstin] = useState(purchase?.supplierGstin || "");
  const [supplierAddress, setSupplierAddress] = useState(purchase?.supplierAddress || "");
  const [supplierBillNo, setSupplierBillNo] = useState(purchase?.supplierBillNo || "");
  const [purchaseDate, setPurchaseDate] = useState(
    purchase?.purchaseDate ? purchase.purchaseDate.split("T")[0] : new Date().toISOString().split("T")[0]
  );
  const [isGstPurchase, setIsGstPurchase] = useState(purchase ? purchase.isGstPurchase : true);
  const [freight, setFreight] = useState<number>(purchase?.freight || 0);
  const [status, setStatus] = useState<"pending" | "paid">(purchase?.status || "pending");
  const [remarks, setRemarks] = useState(purchase?.remarks || "");

  // Autocomplete search states per row
  const [rowSearchQueries, setRowSearchQueries] = useState<Record<string, string>>({});
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);

  // Line items state
  const [lineItems, setLineItems] = useState<FormLineItem[]>(() => {
    if (purchase && purchase.lineItems) {
      return purchase.lineItems.map((item) => ({
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey) {
        const key = e.key.toLowerCase();
        if (key === "a") {
          e.preventDefault();
          addLineItem();
        } else if (key === "s") {
          e.preventDefault();
          const submitBtn = document.getElementById("submit-purchase-form");
          if (submitBtn) submitBtn.click();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lineItems, supplierName, supplierGstin, purchaseDate, isGstPurchase, freight, status]);

  // Determine if it's inter-state (IGST) or intra-state (CGST+SGST)
  let isInterState = false;
  if (supplierGstin && supplierGstin.length >= 2) {
    const supplierStateCode = supplierGstin.substring(0, 2);
    isInterState = supplierStateCode !== company.stateCode;
  }

  // Calculate processed line items
  const processedItems = lineItems.map((item, index) =>
    calculateLineItem(
      {
        productId: item.productId || null,
        description: item.description,
        hsnCode: item.hsnCode || null,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        discountPercent: item.discountPercent,
        gstPercent: item.gstPercent,
      },
      index + 1,
      isGstPurchase,
      isInterState
    )
  );

  // Calculate invoice totals
  const totals = calculateInvoiceTotals(processedItems, freight);

  const addLineItem = () => {
    const nextId = String(lineItems.length > 0 ? Math.max(...lineItems.map((item) => parseInt(item.id))) + 1 : 1);
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
        discountPercent: 0,
        gstPercent: 18,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) {
      alert("At least one line item is required.");
      return;
    }
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, updates: Partial<FormLineItem>) => {
    setLineItems(
      lineItems.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const selectProductForLineItem = (index: number, product: Product) => {
    const itemToUpdate = lineItems[index];
    if (!itemToUpdate) return;

    updateLineItem(itemToUpdate.id, {
      productId: product.id,
      description: product.name,
      hsnCode: product.hsnCode || "",
      unit: product.unit || "pcs",
      rate: product.defaultRate || 0,
      gstPercent: product.defaultGstPercent || 18,
    });

    setRowSearchQueries((prev) => ({
      ...prev,
      [itemToUpdate.id]: product.name,
    }));
    setFocusedRowId(null);
  };

  const handleOpenProductDialog = (index: number) => {
    setProductModalTargetIndex(index);
    setIsProductModalOpen(true);
  };

  const handleProductCreated = (newProd: Product) => {
    // Add to local state so autocomplete shows it immediately
    setProducts((prev) => [...prev, newProd]);
    
    // Auto-select for the active target line item
    if (productModalTargetIndex !== null) {
      selectProductForLineItem(productModalTargetIndex, newProd);
    }
    setIsProductModalOpen(false);
    setProductModalTargetIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierName.trim()) {
      setError("Supplier name is required");
      return;
    }

    if (lineItems.some((item) => !item.description.trim())) {
      setError("Please fill description for all items");
      return;
    }

    if (lineItems.some((item) => item.quantity <= 0)) {
      setError("Quantity must be greater than zero for all items");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        purchaseDate: new Date(purchaseDate).toISOString(),
        isGstPurchase,
        supplierName,
        supplierGstin: supplierGstin || "",
        supplierAddress: supplierAddress || "",
        supplierBillNo: supplierBillNo || "",
        lineItems: lineItems.map((item) => ({
          productId: item.productId || null,
          description: item.description,
          hsnCode: item.hsnCode || null,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          discountPercent: item.discountPercent,
          gstPercent: item.gstPercent,
        })),
        freight,
        status,
        remarks: remarks || "",
      };

      if (isEditMode && purchase) {
        await updatePurchaseAction(purchase.id, payload);
      } else {
        await createPurchaseAction(payload);
      }

      router.push("/purchases");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Something went wrong while saving purchase.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-16 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-7 w-7 text-indigo-650" />
            {isEditMode ? "Edit Purchase Record" : "Record New Purchase"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Fill in the supplier bill information and products received to synchronize inventory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-[0.72rem] font-mono shadow-sm">
            <Keyboard className="h-3 w-3" /> Alt + Shift + S to Save
          </kbd>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-semibold p-4 rounded-xl flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-red-650 animate-ping" />
          {error}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Details and Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier Info Section */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Supplier Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Supplier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter Supplier Name"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 text-sm transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Supplier GSTIN (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 29GGGGG1234F1Z5"
                  value={supplierGstin}
                  onChange={(e) => setSupplierGstin(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 text-sm transition-all font-medium uppercase"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Supplier Address</label>
                <input
                  type="text"
                  placeholder="Enter Supplier Address"
                  value={supplierAddress}
                  onChange={(e) => setSupplierAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 text-sm transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Line Items Container */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Purchase Line Items</h2>
              <button
                type="button"
                onClick={addLineItem}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-750 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Item (Alt+Shift+A)
              </button>
            </div>

            {/* Responsive Table / Cards */}
            <div className="space-y-4">
              {lineItems.map((item, index) => {
                const searchQuery = rowSearchQueries[item.id] !== undefined ? rowSearchQueries[item.id] : item.description;

                // Match products for autocomplete dropdown
                const filteredProducts = products.filter(
                  (p) =>
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (p.code && p.code.toLowerCase().includes(searchQuery.toLowerCase()))
                );

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col gap-4 relative"
                  >
                    {/* Item Row Header */}
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-slate-500">ITEM #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove Item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Form Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                      {/* Product Name Autocomplete */}
                      <div className="md:col-span-3 relative">
                        <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Product Name / Description *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Type product name to search..."
                          value={searchQuery}
                          onFocus={() => setFocusedRowId(item.id)}
                          onChange={(e) => {
                            setRowSearchQueries((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }));
                            updateLineItem(item.id, { description: e.target.value });
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 text-sm font-semibold transition-all"
                        />

                        {/* Autocomplete Dropdown */}
                        {focusedRowId === item.id && (
                          <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
                            {filteredProducts.slice(0, 10).map((prod) => (
                              <button
                                key={prod.id}
                                type="button"
                                onClick={() => selectProductForLineItem(index, prod)}
                                className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex flex-col justify-between gap-0.5"
                              >
                                <span className="text-slate-900 font-bold">{prod.name}</span>
                                <span className="text-slate-500 text-[0.72rem] flex justify-between">
                                  <span>Code: {prod.code || "N/A"} | HSN: {prod.hsnCode || "N/A"}</span>
                                  <span className="text-slate-500 font-bold">Stock: {prod.stock}</span>
                                </span>
                              </button>
                            ))}
                            {filteredProducts.length === 0 && searchQuery.trim() !== "" && (
                              <div className="p-3 text-center text-xs text-slate-500">
                                No matching products in catalog.
                              </div>
                            )}
                            {/* Inline Add Product Trigger */}
                            <button
                              type="button"
                              onClick={() => handleOpenProductDialog(index)}
                              className="w-full text-left px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 border-t border-indigo-100/50 sticky bottom-0"
                            >
                              <Plus className="h-4 w-4" /> Add New Product to Catalog
                            </button>
                          </div>
                        )}
                      </div>

                      {/* HSN Code */}
                      <div>
                        <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          HSN
                        </label>
                        <input
                          type="text"
                          placeholder="HSN"
                          value={item.hsnCode}
                          onChange={(e) => updateLineItem(item.id, { hsnCode: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 text-sm font-semibold transition-all"
                        />
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Qty *
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="Qty"
                          value={item.quantity === 0 ? "" : item.quantity}
                          onChange={(e) => updateLineItem(item.id, { quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none text-sm font-bold transition-all text-right"
                        />
                      </div>

                      {/* Unit */}
                      <div>
                        <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="pcs"
                          value={item.unit}
                          onChange={(e) => updateLineItem(item.id, { unit: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none text-sm font-semibold transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1 border-t border-slate-100/50">
                      {/* Rate */}
                      <div>
                        <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Purchase Rate *
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={item.rate === 0 ? "" : item.rate}
                          onChange={(e) => updateLineItem(item.id, { rate: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none text-sm font-bold transition-all text-right"
                        />
                      </div>

                      {/* Discount % */}
                      <div>
                        <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Discount %
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="0"
                          value={item.discountPercent === 0 ? "" : item.discountPercent}
                          onChange={(e) => updateLineItem(item.id, { discountPercent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none text-sm font-bold transition-all text-right"
                        />
                      </div>

                      {/* GST % */}
                      <div>
                        <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          GST %
                        </label>
                        <select
                          disabled={!isGstPurchase}
                          value={item.gstPercent}
                          onChange={(e) => updateLineItem(item.id, { gstPercent: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none text-sm font-bold transition-all"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </div>

                      {/* Calculated Amount */}
                      <div className="flex flex-col justify-end text-right pr-2">
                        <span className="text-[0.68rem] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Line Total</span>
                        <span className="text-sm font-black text-slate-800">
                          {formatCurrency(processedItems[index]?.amount || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Settings & Summary */}
        <div className="space-y-6">
          {/* Purchase Settings Panel */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Purchase Config</h2>
            
            {/* Purchase Date */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Purchase Date *</label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 text-sm font-bold transition-all"
              />
            </div>

            {/* Bill No. */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Supplier Bill No. / Ref</label>
              <input
                type="text"
                placeholder="e.g. INV-2024-881"
                value={supplierBillNo}
                onChange={(e) => setSupplierBillNo(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 text-sm transition-all font-semibold"
              />
            </div>

            {/* GST Purchase Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">GST Purchase</label>
                <span className="text-[0.72rem] text-slate-500">Compute Input CGST/SGST/IGST</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGstPurchase}
                  onChange={(e) => {
                    const active = e.target.checked;
                    setIsGstPurchase(active);
                    if (!active) {
                      setLineItems(lineItems.map((item) => ({ ...item, gstPercent: 0 })));
                    } else {
                      setLineItems(lineItems.map((item) => ({ ...item, gstPercent: 18 })));
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-650"></div>
              </label>
            </div>

            {/* Status (Pending / Paid) */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-750 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 text-sm font-bold transition-all"
              >
                <option value="pending">Pending / Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Remarks</label>
              <textarea
                placeholder="Optional supplier notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 text-sm font-medium transition-all resize-none"
              />
            </div>
          </div>

          {/* Totals Summary Panel */}
          <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 text-slate-100 shadow-xl space-y-4">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider">Financial Summary</h2>
            
            <div className="space-y-2 text-xs border-b border-slate-800 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal:</span>
                <span className="font-semibold text-slate-250">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Discount:</span>
                <span className="font-semibold text-slate-250">-{formatCurrency(totals.totalDiscount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Taxable Value:</span>
                <span className="font-semibold text-slate-250">{formatCurrency(totals.taxableValueTotal)}</span>
              </div>

              {isGstPurchase && (
                <>
                  {!isInterState ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500">CGST Total:</span>
                        <span className="font-semibold text-slate-250">{formatCurrency(totals.cgstTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">SGST Total:</span>
                        <span className="font-semibold text-slate-250">{formatCurrency(totals.sgstTotal)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-slate-500">IGST Total:</span>
                      <span className="font-semibold text-slate-250">{formatCurrency(totals.igstTotal)}</span>
                    </div>
                  )}
                </>
              )}

              {/* Freight Input */}
              <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-850 mt-1">
                <span className="text-slate-500 font-medium">Freight charges (₹):</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={freight === 0 ? "" : freight}
                  onChange={(e) => setFreight(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-right text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Round Off:</span>
                <span className="font-mono text-slate-350">{formatCurrency(totals.roundOff)}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Grand Total</span>
                <span className="text-2xl font-black text-white flex items-center tracking-tight">
                  <IndianRupee className="h-5.5 w-5.5 mr-0.5 text-indigo-400" />
                  {formatCurrency(totals.grandTotal).replace("₹", "")}
                </span>
              </div>
            </div>

            <button
              type="submit"
              id="submit-purchase-form"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 mt-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-5 w-5" />
                  {isEditMode ? "Update Purchase" : "Submit Purchase"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Inline Product Creator Modal */}
      <ProductDialog
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setProductModalTargetIndex(null);
        }}
        onSuccess={handleProductCreated}
      />
    </form>
  );
}
