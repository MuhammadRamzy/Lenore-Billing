"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Printer, Settings, Check, Layout, Tag, Sliders, Eye, FileText, Download, Loader2, Search } from "lucide-react";
import { Product, Company } from "@/lib/types";
import { ProductQrCode } from "./ProductQrCode";
import { formatCurrency } from "@/lib/utils";

interface StickerPrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  company: Company;
}

export default function StickerPrintDialog({
  isOpen,
  onClose,
  products,
  company,
}: StickerPrintDialogProps) {
  // --- Content Selection & Quantities ---
  const [selectedProductIds, setSelectedProductIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    products.forEach((p) => {
      initial[p.id] = true; // Select all by default
    });
    return initial;
  });

  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    products.forEach((p) => {
      initial[p.id] = 1; // 1 copy by default
    });
    return initial;
  });

  // --- Layout Configuration ---
  const [pageSize, setPageSize] = useState<"A4" | "A3">("A4");
  const [columns, setColumns] = useState<number>(3);
  const [stickerWidth, setStickerWidth] = useState<number>(65); // mm
  const [stickerHeight, setStickerHeight] = useState<number>(35); // mm
  const [pageMargin, setPageMargin] = useState<number>(8); // mm
  const [gapSpacing, setGapSpacing] = useState<number>(2.5); // mm
  const [showBorder, setShowBorder] = useState<boolean>(true);

  // --- Sticker Content Customization ---
  const [brandName, setBrandName] = useState<string>("LENORE");
  const [mfgDate, setMfgDate] = useState<string>(() => {
    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[now.getMonth()]} ${now.getFullYear()}`;
  });
  
  const [address, setAddress] = useState<string>(() => {
    return `${company.name}, ${company.city}, ${company.state}`;
  });

  const [showBrand, setShowBrand] = useState<boolean>(true);
  const [showAddress, setShowAddress] = useState<boolean>(true);
  const [showMfgDate, setShowMfgDate] = useState<boolean>(true);
  const [showCode, setShowCode] = useState<boolean>(true);
  const [showMRP, setShowMRP] = useState<boolean>(true);
  const [showHSN, setShowHSN] = useState<boolean>(true);
  const [showLogo, setShowLogo] = useState<boolean>(true);

  const [bulkQtyVal, setBulkQtyVal] = useState<number>(5);
  const [activeTab, setActiveTab] = useState<"products" | "layout" | "content">("products");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  // Selection helpers
  const handleToggleSelectAll = (select: boolean) => {
    const nextSelect: Record<string, boolean> = {};
    products.forEach((p) => {
      nextSelect[p.id] = select;
    });
    setSelectedProductIds(nextSelect);
  };

  const handleSetBulkQuantity = () => {
    if (bulkQtyVal < 1) return;
    const nextQties = { ...quantities };
    products.forEach((p) => {
      if (selectedProductIds[p.id]) {
        nextQties[p.id] = bulkQtyVal;
      }
    });
    setQuantities(nextQties);
  };

  const incrementQty = (id: string, amount: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + amount),
    }));
  };

  // Compile active stickers to print
  const stickersToPrint: { product: Product; index: number }[] = [];
  products.forEach((prod) => {
    if (selectedProductIds[prod.id]) {
      const qty = quantities[prod.id] || 1;
      for (let i = 0; i < qty; i++) {
        stickersToPrint.push({ product: prod, index: i });
      }
    }
  });

  // Print execution handler
  const handlePrint = () => {
    window.print();
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const res = await fetch("/api/products/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products,
          quantities,
          config: {
            pageSize,
            orientation,
            columns,
            stickerWidth,
            stickerHeight,
            pageMargin,
            gapSpacing,
            showBorder,
          },
          custom: {
            brandName,
            mfgDate,
            address,
          },
          toggles: {
            showLogo,
            showBrand,
            showAddress,
            showMfgDate,
            showCode,
            showMRP,
            showHSN,
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate stickers PDF");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stickers_${pageSize.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Error exporting PDF: " + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!isOpen) return null;

  // Paper Dimensions in mm for preview styling
  const paperWidth = pageSize === "A4" 
    ? (orientation === "portrait" ? 210 : 297)
    : (orientation === "portrait" ? 297 : 420);
  const paperHeight = pageSize === "A4" 
    ? (orientation === "portrait" ? 297 : 210)
    : (orientation === "portrait" ? 420 : 297);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col lg:flex-row overflow-hidden animate-in fade-in duration-200">
      
      {/* Dynamic Printing Style Injector */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            * {
              overflow: visible !important;
              scrollbar-width: none !important;
            }
            ::-webkit-scrollbar {
              display: none !important;
            }
            /* Hide non-printable elements */
            header, nav, button, aside, .print\\:hidden, #sticker-control-panel {
              display: none !important;
              visibility: hidden !important;
            }
            body {
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            /* Position printable container at page top-left */
            #printable-sticker-sheet-wrapper {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              display: block !important;
            }
            .page-break-after-always {
              display: block !important;
              width: ${paperWidth}mm !important;
              height: ${paperHeight}mm !important;
              padding: ${pageMargin}mm !important;
              background: white !important;
              box-shadow: none !important;
              margin: 0 auto !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              break-after: page !important;
            }
            @page {
              size: ${pageSize === "A4" ? "A4" : "A3"} ${orientation};
              margin: 0;
            }
          }
        `
      }} />

      {/* Control panel / Settings (Left side) */}
      <div id="sticker-control-panel" className="w-full lg:w-[480px] bg-white border-r border-slate-200 flex flex-col shrink-0 h-full relative z-10 shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Layout className="h-5 w-5 text-indigo-600" />
            <div>
              <h2 className="font-extrabold text-slate-950 text-sm sm:text-base">Sticker Layout Center</h2>
              <p className="text-[0.72rem] text-slate-500 font-medium">Generate custom barcode label sheets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200/80 text-slate-500 hover:text-slate-700 rounded-xl transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 px-3 bg-slate-50/50">
          <button
            onClick={() => setActiveTab("products")}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "products"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            1. Products ({products.filter((p) => selectedProductIds[p.id]).length})
          </button>
          
          <button
            onClick={() => setActiveTab("layout")}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "layout"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            2. Dimensions
          </button>

          <button
            onClick={() => setActiveTab("content")}
            className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "content"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            3. Labels Content
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* TAB 1: PRODUCT SELECTION */}
          {activeTab === "products" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* Bulk actions panel */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider">Quick Select</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleSelectAll(true)}
                      className="text-[0.72rem] font-bold text-indigo-600 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-400">|</span>
                    <button
                      onClick={() => handleToggleSelectAll(false)}
                      className="text-[0.72rem] font-bold text-slate-500 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-slate-100 pt-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-600 font-semibold">Set copies:</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={bulkQtyVal}
                      onChange={(e) => setBulkQtyVal(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 text-center text-xs font-bold bg-white border border-slate-200 rounded-lg py-1 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleSetBulkQuantity}
                    className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-1.5 px-3 rounded-xl text-xs transition-colors"
                  >
                    Apply to Selected
                  </button>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search products by name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none placeholder-slate-400"
                />
              </div>

              {/* Product rows list */}
              <div className="space-y-2 max-h-[350px] lg:max-h-none overflow-y-auto pr-1">
                {(() => {
                  const filteredProducts = products.filter((prod) => {
                    const query = searchQuery.toLowerCase().trim();
                    if (!query) return true;
                    return (
                      prod.name.toLowerCase().includes(query) ||
                      (prod.code && prod.code.toLowerCase().includes(query))
                    );
                  });

                  if (filteredProducts.length === 0) {
                    return (
                      <div className="text-center py-8 text-slate-500 text-xs font-medium">
                        No products match your search.
                      </div>
                    );
                  }

                  return filteredProducts.map((prod) => {
                    const isChecked = !!selectedProductIds[prod.id];
                    return (
                      <div
                        key={prod.id}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-150 ${
                          isChecked
                            ? "bg-indigo-50/40 border-indigo-100"
                            : "bg-white border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) =>
                              setSelectedProductIds((prev) => ({
                                ...prev,
                                [prod.id]: e.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-800 truncate">{prod.name}</h4>
                            <span className="text-[0.72rem] font-mono text-slate-500">{prod.code || "No Code"}</span>
                          </div>
                        </div>

                        {isChecked && (
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <button
                              onClick={() => incrementQty(prod.id, -1)}
                              className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-black text-slate-800">
                              {quantities[prod.id] || 1}
                            </span>
                            <button
                              onClick={() => incrementQty(prod.id, 1)}
                              className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* TAB 2: DIMENSIONS & CONFIG */}
          {activeTab === "layout" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Sheet size toggle */}
              <div>
                <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Target Paper Size
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setPageSize("A4");
                      setColumns(3);
                    }}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      pageSize === "A4"
                        ? "bg-indigo-650 border-indigo-650 text-white shadow-md shadow-indigo-650/10"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>A4 Sheet</span>
                    <span className="text-[0.68rem] opacity-80 font-normal">210mm x 297mm</span>
                  </button>
                  <button
                    onClick={() => {
                      setPageSize("A3");
                      setColumns(4);
                    }}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      pageSize === "A3"
                        ? "bg-indigo-650 border-indigo-650 text-white shadow-md shadow-indigo-650/10"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>A3 Sheet</span>
                    <span className="text-[0.68rem] opacity-80 font-normal">297mm x 420mm</span>
                  </button>
                </div>
              </div>

              {/* Orientation toggle */}
              <div>
                <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Page Orientation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOrientation("portrait")}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      orientation === "portrait"
                        ? "bg-indigo-650 border-indigo-650 text-white shadow-md shadow-indigo-650/10"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>Portrait</span>
                    <span className="text-[0.68rem] opacity-80 font-normal">Vertical layout</span>
                  </button>
                  <button
                    onClick={() => setOrientation("landscape")}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex flex-col items-center gap-1 transition-all ${
                      orientation === "landscape"
                        ? "bg-indigo-650 border-indigo-650 text-white shadow-md shadow-indigo-650/10"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>Landscape</span>
                    <span className="text-[0.68rem] opacity-80 font-normal">Horizontal layout</span>
                  </button>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Grid dimensions */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1">
                  <Sliders className="h-4 w-4 text-indigo-500" />
                  Sticker Grid Adjustments
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  {/* Columns */}
                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-500 mb-1">
                      Columns: <span className="font-black text-slate-800">{columns}</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={columns}
                      onChange={(e) => setColumns(parseInt(e.target.value))}
                      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  {/* GapSpacing */}
                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-500 mb-1">
                      Gap spacing: <span className="font-black text-slate-800">{gapSpacing}mm</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={gapSpacing}
                      onChange={(e) => setGapSpacing(parseFloat(e.target.value))}
                      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  {/* Width */}
                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-500 mb-1">
                      Sticker Width: <span className="font-black text-slate-800">{stickerWidth}mm</span>
                    </label>
                    <input
                      type="range"
                      min={40}
                      max={120}
                      step={1}
                      value={stickerWidth}
                      onChange={(e) => setStickerWidth(parseInt(e.target.value))}
                      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  {/* Height */}
                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-500 mb-1">
                      Sticker Height: <span className="font-black text-slate-800">{stickerHeight}mm</span>
                    </label>
                    <input
                      type="range"
                      min={20}
                      max={80}
                      step={1}
                      value={stickerHeight}
                      onChange={(e) => setStickerHeight(parseInt(e.target.value))}
                      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  {/* Margins */}
                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-500 mb-1">
                      Page Margin: <span className="font-black text-slate-800">{pageMargin}mm</span>
                    </label>
                    <input
                      type="range"
                      min={2}
                      max={25}
                      step={1}
                      value={pageMargin}
                      onChange={(e) => setPageMargin(parseInt(e.target.value))}
                      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  {/* Show Border */}
                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="show-border-chk"
                      checked={showBorder}
                      onChange={(e) => setShowBorder(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="show-border-chk" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      Show Cut Borders
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STICKER CONTENT CUSTOMIZATION */}
          {activeTab === "content" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              
              {/* Text fields inputs */}
              <div className="space-y-3">
                {/* Brand name */}
                <div>
                  <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Brand Name / Top Tag
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. LENORE"
                    className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Address details */}
                <div>
                  <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Manufacturer Address
                  </label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Full Address"
                    className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:border-indigo-500 focus:outline-none resize-none"
                  />
                </div>

                {/* Mfg Date */}
                <div>
                  <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Mfg. Month & Year
                  </label>
                  <input
                    type="text"
                    value={mfgDate}
                    onChange={(e) => setMfgDate(e.target.value)}
                    placeholder="e.g. July 2026"
                    className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <hr className="border-slate-100 my-2" />

              {/* Toggles */}
              <div>
                <label className="block text-[0.72rem] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  Print Content Toggles
                </label>
                <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showBrand}
                      onChange={(e) => setShowBrand(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-650"
                    />
                    <span className="text-xs text-slate-700 font-semibold">Brand Tag</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showCode}
                      onChange={(e) => setShowCode(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-650"
                    />
                    <span className="text-xs text-slate-700 font-semibold">Product Code</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showMRP}
                      onChange={(e) => setShowMRP(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-650"
                    />
                    <span className="text-xs text-slate-700 font-semibold">MRP Price</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showHSN}
                      onChange={(e) => setShowHSN(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-650"
                    />
                    <span className="text-xs text-slate-700 font-semibold">HSN Code</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showMfgDate}
                      onChange={(e) => setShowMfgDate(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-650"
                    />
                    <span className="text-xs text-slate-700 font-semibold">Mfg. Date</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showAddress}
                      onChange={(e) => setShowAddress(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-650"
                    />
                    <span className="text-xs text-slate-700 font-semibold">Address Box</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showLogo}
                      onChange={(e) => setShowLogo(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-650"
                    />
                    <span className="text-xs text-slate-700 font-semibold">Company Logo</span>
                  </label>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="text-[0.72rem] text-slate-500 font-medium text-center sm:text-left">
            Stickers: <span className="font-extrabold text-slate-900">{stickersToPrint.length}</span>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={stickersToPrint.length === 0 || isExportingPdf}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-xl text-xs active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              <Printer className="h-3.5 w-3.5" />
              Print (Browser)
            </button>

            <button
              onClick={handleExportPdf}
              disabled={stickersToPrint.length === 0 || isExportingPdf}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-indigo-650 hover:bg-indigo-750 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-md shadow-indigo-600/10 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Live Preview (Right side) */}
      <div className="flex-1 bg-slate-200 overflow-auto flex justify-center items-start p-6 lg:p-12 relative print:p-0">
        <div className="absolute top-4 left-6 bg-slate-900/80 text-white font-mono text-[0.72rem] py-1 px-3 rounded-full backdrop-blur-sm pointer-events-none z-20 print:hidden">
          Aspect-Ratio Sheet Preview ({pageSize})
        </div>

        {/* Scaled paper sheet wrapper */}
        <div id="printable-sticker-sheet-wrapper" className="flex flex-col gap-8 print:gap-0 origin-top my-4 transition-all duration-300 print:my-0">
          {stickersToPrint.length === 0 ? (
            <div
              style={{
                width: `${paperWidth}mm`,
                minHeight: `${paperHeight}mm`,
                padding: `${pageMargin}mm`,
                boxSizing: "border-box",
              }}
              className="bg-white text-slate-950 font-sans print:shadow-none shadow-2xl flex flex-col items-center justify-center text-slate-500 p-24 text-center"
            >
              <Eye className="h-10 w-10 text-slate-400 mb-3" />
              <h4 className="font-bold text-slate-700 text-sm">Preview is empty</h4>
              <p className="text-[0.72rem] max-w-[200px] mt-1 text-slate-500">
                Select one or more products and add copies on the left panel to render stickers.
              </p>
            </div>
          ) : (() => {
            const usableHeight = paperHeight - 2 * pageMargin;
            const stickerRowHeight = stickerHeight + gapSpacing;
            const rowsPerPage = Math.floor((usableHeight + gapSpacing) / stickerRowHeight) || 1;
            const stickersPerPage = rowsPerPage * columns;

            const previewPages: typeof stickersToPrint[] = [];
            for (let i = 0; i < stickersToPrint.length; i += stickersPerPage) {
              previewPages.push(stickersToPrint.slice(i, i + stickersPerPage));
            }

            return previewPages.map((pageStickers, pageIdx) => (
              <div
                key={pageIdx}
                id={pageIdx === 0 ? "printable-sticker-sheet" : undefined}
                style={{
                  width: `${paperWidth}mm`,
                  height: `${paperHeight}mm`,
                  padding: `${pageMargin}mm`,
                  boxSizing: "border-box",
                }}
                className="bg-white text-slate-950 font-sans print:shadow-none shadow-2xl relative page-break-after-always"
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gap: `${gapSpacing}mm`,
                    width: "100%",
                  }}
                >
                  {pageStickers.map(({ product, index }, idx) => {
                    const mrpAmount = product.defaultRate * (1 + product.defaultGstPercent / 100);
                    
                    return (
                      <div
                        key={`${product.id}-${index}-${idx}`}
                        style={{
                          width: `${stickerWidth}mm`,
                          height: `${stickerHeight}mm`,
                          padding: "2.5mm 3mm",
                          boxSizing: "border-box",
                        }}
                        className={`flex flex-row items-center overflow-hidden select-none bg-white relative transition-all duration-150 ${
                          showBorder ? "border border-slate-200" : "border border-transparent"
                        }`}
                      >
                        {/* Left Section: Clean QR Code (Apple-style minimalist) */}
                        <div className="flex flex-col items-center justify-center w-[30%] h-full shrink-0 border-r border-slate-100 pr-2.5">
                          <ProductQrCode data={product.code || product.id} size={stickerHeight * 2.6} />
                          {showCode && (
                            <span className="text-[6.5px] font-bold font-mono text-slate-500 mt-1 uppercase tracking-wider truncate w-full text-center">
                              {product.code || "N/A"}
                            </span>
                          )}
                        </div>

                        {/* Right Section: Premium Minimalist Product Card */}
                        <div className="flex-1 h-full min-w-0 pl-3 flex flex-col justify-between py-0.5 text-left">
                          
                          {/* Top: Brand Header */}
                          {(showBrand || showLogo) && (
                            <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                              {showLogo && (
                                <img
                                  src="/logo.png"
                                  alt="logo"
                                  className="h-3 w-auto object-contain shrink-0"
                                />
                              )}
                              {showBrand && (
                                <span className="text-[7.5px] font-black uppercase tracking-[0.2em] text-slate-900 truncate max-w-full">
                                  {brandName}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Middle: Product Title & Badges */}
                          <div className="space-y-1">
                            <h3 className="font-extrabold text-[10.5px] text-slate-950 leading-tight uppercase tracking-wide line-clamp-2 break-words">
                              {product.name}
                            </h3>
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {showHSN && product.hsnCode && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-150 text-slate-650 text-[6.5px] font-mono font-semibold">
                                  HSN: {product.hsnCode}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Bottom: Pricing & Manufacturing */}
                          <div className="flex items-end justify-between gap-1.5 mt-auto pt-1.5 border-t border-slate-100">
                            {showMRP && (
                              <div className="flex flex-col">
                                <span className="text-[5.5px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                                  Retail Price
                                </span>
                                <div className="inline-flex items-center gap-1 bg-slate-950 text-white px-2 py-0.5 rounded text-[8.5px] font-black tracking-wide leading-none">
                                  {formatCurrency(mrpAmount)}
                                  <span className="text-[5px] text-slate-400 font-normal">incl. tax</span>
                                </div>
                              </div>
                            )}

                            {showMfgDate && (
                              <div className="text-right flex flex-col">
                                <span className="text-[5.5px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">
                                  Mfg Date
                                </span>
                                <span className="text-[7.5px] font-extrabold text-slate-800 leading-none">
                                  {mfgDate}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Address box footer */}
                          {showAddress && (
                            <div className="text-[5.5px] text-slate-500 truncate mt-1 pt-1 border-t border-slate-50 w-full font-medium">
                              {address}
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Page indicator at bottom */}
                <div className="absolute bottom-2 right-4 text-[0.68rem] text-slate-500 print:hidden">
                  Page {pageIdx + 1} of {previewPages.length}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

    </div>
  );
}
