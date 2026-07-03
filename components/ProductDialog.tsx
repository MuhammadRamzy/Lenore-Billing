"use client";

import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { Product } from "@/lib/types";
import { createProductAction, updateProductAction } from "@/app/actions";
import { Loader2 } from "lucide-react";

interface ProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (product: Product) => void;
  product?: Product | null;
}

export default function ProductDialog({
  isOpen,
  onClose,
  onSuccess,
  product,
}: ProductDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [defaultRate, setDefaultRate] = useState("0");
  const [defaultGstPercent, setDefaultGstPercent] = useState("18");
  const [stock, setStock] = useState("0");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (product) {
      setCode(product.code || "");
      setName(product.name || "");
      setHsnCode(product.hsnCode || "");
      setUnit(product.unit || "pcs");
      setDefaultRate(String(product.defaultRate));
      setDefaultGstPercent(String(product.defaultGstPercent));
      setStock(String(product.stock ?? 0));
    } else {
      setCode("");
      setName("");
      setHsnCode("");
      setUnit("pcs");
      setDefaultRate("0");
      setDefaultGstPercent("18");
      setStock("0");
    }
    setErrors({});
  }, [product, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const payload = {
      code: code || null,
      name,
      hsnCode: hsnCode || null,
      unit,
      defaultRate: parseFloat(defaultRate) || 0,
      defaultGstPercent: parseFloat(defaultGstPercent) || 0,
      stock: parseInt(stock, 10) || 0,
    };

    try {
      let result;
      if (product) {
        result = await updateProductAction(product.id, payload);
      } else {
        result = await createProductAction(payload);
      }

      if (result.success) {
        if (onSuccess && result.product) {
          onSuccess(result.product);
        }
        onClose();
      }
    } catch (err: any) {
      if (err.name === "ZodError" || err.errors) {
        const fieldErrors: Record<string, string> = {};
        err.errors?.forEach((e: any) => {
          if (e.path && e.path.length > 0) {
            fieldErrors[e.path[0]] = e.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        setErrors({ general: err.message || "Something went wrong" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? "Edit Catalog Product" : "Add Product to Catalog"}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.general && (
          <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg">
            {errors.general}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Item Code
            </label>
            <input
              type="text"
              placeholder="e.g. CT103"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 uppercase font-mono focus:border-indigo-500 focus:outline-none transition-colors"
            />
            {errors.code && <span className="text-xs text-rose-500 mt-1">{errors.code}</span>}
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              HSN/SAC Code
            </label>
            <input
              type="text"
              placeholder="e.g. 8481.80.20"
              value={hsnCode}
              onChange={(e) => setHsnCode(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono focus:border-indigo-500 focus:outline-none transition-colors"
            />
            {errors.hsnCode && <span className="text-xs text-rose-500 mt-1">{errors.hsnCode}</span>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Product Name / Description *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Colten Pillar Cock 7-in Wetta"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
          />
          {errors.name && <span className="text-xs text-rose-500 mt-1">{errors.name}</span>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Unit *
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors"
            >
              <option value="pcs">pcs (Pieces)</option>
              <option value="set">set (Sets)</option>
              <option value="mtr">mtr (Meters)</option>
              <option value="box">box (Boxes)</option>
              <option value="nos">nos (Numbers)</option>
            </select>
            {errors.unit && <span className="text-xs text-rose-500 mt-1">{errors.unit}</span>}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              GST % *
            </label>
            <select
              value={defaultGstPercent}
              onChange={(e) => setDefaultGstPercent(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors"
            >
              <option value="0">0%</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18% (Standard)</option>
              <option value="28">28%</option>
            </select>
            {errors.defaultGstPercent && (
              <span className="text-xs text-rose-500 mt-1">{errors.defaultGstPercent}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Base Rate (INR) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              min="0"
              value={defaultRate}
              onChange={(e) => setDefaultRate(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
            {errors.defaultRate && (
              <span className="text-xs text-rose-500 mt-1">{errors.defaultRate}</span>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Stock Quantity *
            </label>
            <input
              type="number"
              step="1"
              required
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
            {errors.stock && (
              <span className="text-xs text-rose-500 mt-1">{errors.stock}</span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-600/10 flex items-center gap-2 disabled:opacity-75 transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {product ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
