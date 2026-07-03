"use client";

import React, { useState } from "react";
import {
  Plus,
  Search,
  Edit,
  FileSpreadsheet,
  Package,
  ChevronLeft,
  ChevronRight,
  QrCode,
  Download,
  Printer,
  Trash2,
} from "lucide-react";
import { Product } from "@/lib/types";
import ProductDialog from "./ProductDialog";
import { formatCurrency, exportToCsv, triggerServerDownload } from "@/lib/utils";
import { ProductQrCode } from "./ProductQrCode";
import { deleteProductAction } from "@/app/actions";
import QRCode from "qrcode";
import JSZip from "jszip";

interface ProductsListProps {
  initialProducts: Product[];
  lowStockLimit?: number;
}

const ITEMS_PER_PAGE = 20;

export default function ProductsList({ initialProducts, lowStockLimit = 5 }: ProductsListProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Dialog & Modal States
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);
  const [isPrintingLabels, setIsPrintingLabels] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  // Advanced Filter States
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out" | "available">("all");
  const [priceFilter, setPriceFilter] = useState<"all" | "under_1000" | "1000_5000" | "over_5000">("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "stock_asc" | "stock_desc" | "price_asc" | "price_desc">("name_asc");

  // Filter products by search query and advanced criteria
  const filteredProducts = products.filter((p) => {
    // 1. Search Query
    const q = searchQuery.toLowerCase();
    const code = p.code ? p.code.toLowerCase() : "";
    const name = p.name ? p.name.toLowerCase() : "";
    const hsn = p.hsnCode ? p.hsnCode.toLowerCase() : "";
    const matchesSearch = code.includes(q) || name.includes(q) || hsn.includes(q);

    // 2. Stock Filter
    let matchesStock = true;
    if (stockFilter === "low") {
      matchesStock = (p.stock ?? 0) > 0 && (p.stock ?? 0) <= lowStockLimit;
    } else if (stockFilter === "out") {
      matchesStock = (p.stock ?? 0) <= 0;
    } else if (stockFilter === "available") {
      matchesStock = (p.stock ?? 0) > lowStockLimit;
    }

    // 3. Price Filter
    let matchesPrice = true;
    const price = p.defaultRate;
    if (priceFilter === "under_1000") {
      matchesPrice = price < 1000;
    } else if (priceFilter === "1000_5000") {
      matchesPrice = price >= 1000 && price <= 5000;
    } else if (priceFilter === "over_5000") {
      matchesPrice = price > 5000;
    }

    return matchesSearch && matchesStock && matchesPrice;
  }).sort((a, b) => {
    if (sortBy === "name_asc") {
      return a.name.localeCompare(b.name);
    } else if (sortBy === "name_desc") {
      return b.name.localeCompare(a.name);
    } else if (sortBy === "stock_asc") {
      return (a.stock ?? 0) - (b.stock ?? 0);
    } else if (sortBy === "stock_desc") {
      return (b.stock ?? 0) - (a.stock ?? 0);
    } else if (sortBy === "price_asc") {
      return a.defaultRate - b.defaultRate;
    } else if (sortBy === "price_desc") {
      return b.defaultRate - a.defaultRate;
    }
    return 0;
  });

  // Pagination calculations
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Adjust page if it exceeds total pages after filtering
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, stockFilter, priceFilter]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedProduct(null);
    setIsDialogOpen(true);
  };

  const handleSuccess = (updatedProduct: Product) => {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === updatedProduct.id);
      if (idx !== -1) {
        // Edit flow
        const updated = [...prev];
        updated[idx] = updatedProduct;
        return updated;
      } else {
        // Add flow
        return [updatedProduct, ...prev];
      }
    });
  };

  // Delete Action
  const handleDelete = async (product: Product) => {
    if (confirm(`Are you sure you want to remove "${product.name}" from the catalog?`)) {
      try {
        await deleteProductAction(product.id);
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
      } catch (err: any) {
        alert(err.message || "Failed to delete product.");
      }
    }
  };

  // View individual QR Code
  const handleViewQr = (product: Product) => {
    setQrProduct(product);
    setIsQrModalOpen(true);
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ["Item Code", "Product Name", "HSN Code", "Unit", "Base Rate (ex. GST)", "GST %", "Stock"];
    const rows = filteredProducts.map((p) => [
      p.code || "",
      p.name,
      p.hsnCode || "",
      p.unit,
      p.defaultRate.toString(),
      p.defaultGstPercent.toString(),
      (p.stock ?? 0).toString(),
    ]);
    exportToCsv("lenore_products_catalog.csv", headers, rows);
  };

  // Bulk ZIP Download QRs
  const handleBulkDownloadQRs = async () => {
    if (filteredProducts.length === 0) return;
    setIsDownloadingZip(true);
    try {
      const zip = new JSZip();
      for (const prod of filteredProducts) {
        const code = prod.code || prod.id;
        // Generate QR code data URL (High quality scale 8)
        const qrUrl = await QRCode.toDataURL(code, { margin: 2, scale: 8 });
        const base64Data = qrUrl.replace(/^data:image\/png;base64,/, "");
        const fileName = `qr_${prod.code || prod.id.slice(0, 8)}_${prod.name.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
        zip.file(fileName, base64Data, { base64: true });
      }
      
      const base64 = await zip.generateAsync({ type: "base64" });
      triggerServerDownload("lenore_product_qrs.zip", "application/zip", base64, true);
    } catch (error) {
      console.error("Bulk QR download failed:", error);
      alert("Failed to generate zip file.");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Products Catalog
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage inventory list, print sticker barcodes, and export item data.
          </p>
        </div>
        
        {/* Actions panel */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition-all duration-150 active:scale-95 text-xs"
            title="Download CSV"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export CSV
          </button>
          
          <button
            onClick={handleBulkDownloadQRs}
            disabled={isDownloadingZip || filteredProducts.length === 0}
            className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition-all duration-150 active:scale-95 text-xs disabled:opacity-50"
            title="Download all QR Codes as ZIP"
          >
            <Download className="h-4 w-4 text-indigo-600 animate-pulse" />
            {isDownloadingZip ? "Generating..." : "Download QRs (ZIP)"}
          </button>

          <button
            onClick={() => setIsPrintingLabels(true)}
            className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition-all duration-150 active:scale-95 text-xs"
            title="Print Sticker labels in sheets"
          >
            <Printer className="h-4 w-4 text-slate-600" />
            Print Stickers
          </button>

          <button
            onClick={handleAdd}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-indigo-600/10 transition-all duration-150 active:scale-95 text-xs"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Search & Advanced Filters Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
          <Search className="h-5 w-5 text-slate-450 shrink-0" />
          <input
            type="text"
            placeholder="Search by code, description, HSN code..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full text-sm bg-transparent focus:outline-none placeholder-slate-400 text-slate-800"
          />
        </div>

        {/* Filter controls row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Stock Status
            </label>
            <select
              value={stockFilter}
              onChange={(e: any) => setStockFilter(e.target.value)}
              className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All Stocks</option>
              <option value="low">Low Stock (&le; {lowStockLimit})</option>
              <option value="out">Out of Stock (0)</option>
              <option value="available">Available (&gt; {lowStockLimit})</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Price Range
            </label>
            <select
              value={priceFilter}
              onChange={(e: any) => setPriceFilter(e.target.value)}
              className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All Prices</option>
              <option value="under_1000">Under ₹1,000</option>
              <option value="1000_5000">₹1,000 - ₹5,000</option>
              <option value="over_5000">Over ₹5,000</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="name_asc">Name (A - Z)</option>
              <option value="name_desc">Name (Z - A)</option>
              <option value="stock_asc">Stock (Low to High)</option>
              <option value="stock_desc">Stock (High to Low)</option>
              <option value="price_asc">Price (Low to High)</option>
              <option value="price_desc">Price (High to Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Table / Cards */}
      {paginatedProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 flex flex-col items-center justify-center shadow-sm">
          <Search className="h-12 w-12 text-slate-200 mb-3" />
          <p className="font-semibold text-slate-500">No products found</p>
          <p className="text-xs mt-1">Try refining your search query or add a new catalog item.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-5 w-16 text-center">QR</th>
                    <th className="py-3.5 px-5 w-24">Code</th>
                    <th className="py-3.5 px-5">Description</th>
                    <th className="py-3.5 px-5">HSN Code</th>
                    <th className="py-3.5 px-5">Unit</th>
                    <th className="py-3.5 px-5 text-right">Base Rate</th>
                    <th className="py-3.5 px-5 text-center">GST %</th>
                    <th className="py-3.5 px-5 text-center">Stock</th>
                    <th className="py-3.5 px-5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedProducts.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => handleViewQr(prod)}
                          className="hover:scale-105 transition-transform"
                          title="Click to view QR"
                        >
                          <ProductQrCode data={prod.code || prod.id} size={36} />
                        </button>
                      </td>
                      <td className="py-4 px-5 font-mono text-xs font-bold text-indigo-600">
                        {prod.code || <span className="text-slate-300 italic font-sans font-normal">-</span>}
                      </td>
                      <td className="py-4 px-5 font-bold text-slate-900">{prod.name}</td>
                      <td className="py-4 px-5 font-mono text-xs font-semibold text-slate-600">
                        {prod.hsnCode || <span className="text-slate-300 italic font-sans font-normal">-</span>}
                      </td>
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                          {prod.unit}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right font-bold text-slate-900">
                        {formatCurrency(prod.defaultRate)}
                      </td>
                      <td className="py-4 px-5 text-center font-semibold text-slate-700">
                        {prod.defaultGstPercent}%
                      </td>
                      <td className="py-4 px-5 text-center">
                        {prod.stock !== undefined && prod.stock <= 0 ? (
                          <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
                            Out of stock
                          </span>
                        ) : prod.stock !== undefined && prod.stock <= lowStockLimit ? (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                            Low stock ({prod.stock})
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                            {prod.stock ?? 100} available
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewQr(prod)}
                            className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition-colors"
                            title="View QR Code"
                          >
                            <QrCode className="h-4.5 w-4.5" />
                          </button>
                          <button
                            onClick={() => handleEdit(prod)}
                            className="p-2 hover:bg-slate-100 hover:text-slate-800 rounded-lg text-slate-400 transition-colors"
                            title="Edit Product"
                          >
                            <Edit className="h-4.5 w-4.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(prod)}
                            className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 transition-colors"
                            title="Remove Product"
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
          {paginatedProducts.map((prod) => (
            <div
              key={prod.id}
              className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 relative"
            >
              <div className="flex gap-3">
                <button
                  onClick={() => handleViewQr(prod)}
                  className="shrink-0"
                  title="View larger QR"
                >
                  <ProductQrCode data={prod.code || prod.id} size={48} />
                </button>
                <div className="pr-12">
                  <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">
                    {prod.code || "NO CODE"}
                  </span>
                  <h3 className="font-bold text-slate-900 leading-snug mt-1">{prod.name}</h3>
                </div>
              </div>

              {/* Actions Box Absolute Top Right */}
              <div className="absolute top-4 right-4 flex gap-1">
                <button
                  onClick={() => handleEdit(prod)}
                  className="p-2 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-colors"
                  title="Edit Product"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(prod)}
                  className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors"
                  title="Remove Product"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex justify-between items-end pt-3 border-t border-slate-50">
                <div className="space-y-1">
                  {prod.hsnCode && (
                    <div className="text-[11px] font-mono text-slate-400">
                      HSN: <span className="font-semibold text-slate-600">{prod.hsnCode}</span>
                    </div>
                  )}
                  <div className="text-xs text-slate-500">
                    Unit: <span className="font-semibold text-slate-700">{prod.unit}</span>
                  </div>
                  <div className="mt-1">
                    {prod.stock !== undefined && prod.stock <= 0 ? (
                      <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        Out of stock
                      </span>
                    ) : prod.stock !== undefined && prod.stock <= 10 ? (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        Low stock ({prod.stock})
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        {prod.stock ?? 100} available
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Base Price (ex. GST)</div>
                  <div className="font-black text-slate-900 text-lg leading-none mt-1">
                    {formatCurrency(prod.defaultRate)}
                  </div>
                  <div className="text-[10px] font-bold text-indigo-500 mt-1">
                    GST {prod.defaultGstPercent}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3.5 rounded-xl border border-slate-100 shadow-sm text-sm text-slate-600 font-medium">
          <div>
            Showing <span className="font-bold text-slate-900">{startIndex + 1}</span> to{" "}
            <span className="font-bold text-slate-900">
              {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}
            </span>{" "}
            of <span className="font-bold text-slate-900">{totalItems}</span> products
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

      {/* Edit/Add Dialog overlay */}
      <ProductDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        product={selectedProduct}
        onSuccess={handleSuccess}
      />

      {/* Individual QR Detail Modal */}
      {isQrModalOpen && qrProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm">Product Barcode QR</h3>
              <button 
                onClick={() => setIsQrModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="flex flex-col items-center py-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] tracking-widest font-black text-slate-400 uppercase">LENORE</span>
              <h4 className="font-bold text-slate-800 text-sm mt-1 px-4 truncate w-full">{qrProduct.name}</h4>
              <div className="my-4">
                <ProductQrCode data={qrProduct.code || qrProduct.id} size={150} />
              </div>
              <span className="font-mono text-xs font-bold text-indigo-600">{qrProduct.code || qrProduct.id}</span>
              <span className="text-sm font-black text-slate-900 mt-1">
                {formatCurrency(qrProduct.defaultRate * (1 + qrProduct.defaultGstPercent / 100))} <span className="text-[9px] font-normal text-slate-500">(inc. GST)</span>
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    const code = qrProduct.code || qrProduct.id;
                    const dataUrl = await QRCode.toDataURL(code, { margin: 2, scale: 8 });
                    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
                    const safeName = qrProduct.name.replace(/[^a-zA-Z0-9]/g, "_");
                    triggerServerDownload(`qr_${safeName}.png`, "image/png", base64Data, true);
                  } catch (err) {
                    console.error("QR Code download failed:", err);
                    alert("Failed to download QR code PNG");
                  }
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs"
              >
                <Download className="h-4 w-4" />
                Download PNG
              </button>
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Sticker Sheets Print View Overlay */}
      {isPrintingLabels && (
        <div className="fixed inset-0 bg-white z-[9999] overflow-auto p-8 print:p-0 print:absolute print:inset-0">
          <div className="flex justify-between items-center mb-6 print:hidden border-b pb-4">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">QR Sticker Sheets (Sticker Grid Preview)</h3>
              <p className="text-xs text-slate-500 mt-1">Ready for 3x8 sticker sheets print layout.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm"
              >
                Print Stickers
              </button>
              <button
                onClick={() => setIsPrintingLabels(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2 rounded-xl text-sm"
              >
                Close Preview
              </button>
            </div>
          </div>
          
          {/* Grid layout optimized for A4 print labels (e.g. 3x8 sticker sheets) */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-[800px] mx-auto print:max-w-full print:gap-2">
            {filteredProducts.map((prod) => (
              <div key={prod.id} className="border border-slate-200 rounded-lg p-3 text-center flex flex-col items-center justify-between min-h-[165px] bg-white print:border-slate-400 print:p-2 break-inside-avoid shadow-sm">
                <div className="text-[8px] font-black tracking-widest text-slate-400 uppercase">LENORE</div>
                <div className="font-bold text-xs text-slate-900 max-h-8 overflow-hidden line-clamp-2 mt-0.5">{prod.name}</div>
                <div className="my-1.5">
                  <ProductQrCode data={prod.code || prod.id} size={56} />
                </div>
                <div className="text-[9px] font-mono font-bold text-indigo-600">{prod.code || prod.id.slice(0, 8)}</div>
                <div className="text-xs font-black text-slate-950 mt-0.5">{formatCurrency(prod.defaultRate * (1 + prod.defaultGstPercent / 100))} <span className="text-[8px] font-normal text-slate-400">(inc. GST)</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
