"use client";

import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { Customer } from "@/lib/types";
import { createCustomerAction, updateCustomerAction } from "@/app/actions";
import { Loader2 } from "lucide-react";

export const INDIAN_STATES = [
  { name: "Maharashtra", code: "27" },
  { name: "Gujarat", code: "24" },
  { name: "Karnataka", code: "29" },
  { name: "Delhi", code: "07" },
  { name: "Tamil Nadu", code: "33" },
  { name: "Uttar Pradesh", code: "09" },
  { name: "West Bengal", code: "19" },
  { name: "Telangana", code: "36" },
  { name: "Rajasthan", code: "08" },
  { name: "Andhra Pradesh", code: "37" },
  { name: "Bihar", code: "10" },
  { name: "Haryana", code: "06" },
  { name: "Madhya Pradesh", code: "23" },
  { name: "Kerala", code: "32" },
  { name: "Punjab", code: "03" },
  { name: "Assam", code: "18" },
  { name: "Chhattisgarh", code: "22" },
  { name: "Goa", code: "30" },
  { name: "Himachal Pradesh", code: "02" },
  { name: "Jharkhand", code: "20" },
  { name: "Odisha", code: "21" },
  { name: "Uttarakhand", code: "05" },
  { name: "Jammu & Kashmir", code: "01" },
];

interface CustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (customer: Customer) => void;
  customer?: Customer | null;
}

export default function CustomerDialog({
  isOpen,
  onClose,
  onSuccess,
  customer,
}: CustomerDialogProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("Maharashtra");
  const [stateCode, setStateCode] = useState("27");
  const [pincode, setPincode] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (customer) {
      setName(customer.name || "");
      setAddress(customer.address || "");
      setCity(customer.city || "");
      setStateName(customer.state || "Maharashtra");
      setStateCode(customer.stateCode || "27");
      setPincode(customer.pincode || "");
      setGstin(customer.gstin || "");
      setPhone(customer.phone || "");
      setEmail(customer.email || "");
    } else {
      setName("");
      setAddress("");
      setCity("");
      setStateName("Maharashtra");
      setStateCode("27");
      setPincode("");
      setGstin("");
      setPhone("");
      setEmail("");
    }
    setErrors({});
  }, [customer, isOpen]);

  // Handle auto state code filling
  const handleStateChange = (stateNameValue: string) => {
    setStateName(stateNameValue);
    const matched = INDIAN_STATES.find((s) => s.name === stateNameValue);
    if (matched) {
      setStateCode(matched.code);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const payload = {
      name,
      address: address || null,
      city: city || null,
      state: stateName || null,
      stateCode: stateCode || null,
      pincode: pincode || null,
      gstin: gstin || null,
      phone: phone || null,
      email: email || null,
    };

    try {
      let result;
      if (customer) {
        result = await updateCustomerAction(customer.id, payload);
      } else {
        result = await createCustomerAction(payload);
      }

      if (result.success) {
        if (onSuccess && result.customer) {
          onSuccess(result.customer);
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
      title={customer ? "Edit Customer Details" : "Add New Customer"}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.general && (
          <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-lg">
            {errors.general}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Customer Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Krishna Sanitary Ware"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
          />
          {errors.name && <span className="text-xs text-rose-500 mt-1">{errors.name}</span>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Phone Number
            </label>
            <input
              type="text"
              placeholder="10-digit mobile"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
            {errors.phone && <span className="text-xs text-rose-500 mt-1">{errors.phone}</span>}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="e.g. client@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
            {errors.email && <span className="text-xs text-rose-500 mt-1">{errors.email}</span>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Billing Address
          </label>
          <input
            type="text"
            placeholder="Shop no, street, locality"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
          />
          {errors.address && <span className="text-xs text-rose-500 mt-1">{errors.address}</span>}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              City
            </label>
            <input
              type="text"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
            {errors.city && <span className="text-xs text-rose-500 mt-1">{errors.city}</span>}
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              State & Code
            </label>
            <div className="flex gap-2">
              <select
                value={stateName}
                onChange={(e) => handleStateChange(e.target.value)}
                className="flex-1 text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:border-indigo-500 focus:outline-none transition-colors"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                readOnly
                value={stateCode}
                className="w-12 text-center text-sm rounded-lg border border-slate-200 bg-slate-50 px-1 py-2 font-mono font-bold text-slate-500 focus:outline-none"
                title="State Code (Auto-filled)"
              />
            </div>
            {errors.state && <span className="text-xs text-rose-500 mt-1">{errors.state}</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Pincode
            </label>
            <input
              type="text"
              placeholder="6-digit pin"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none transition-colors"
            />
            {errors.pincode && <span className="text-xs text-rose-500 mt-1">{errors.pincode}</span>}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              GSTIN (Optional)
            </label>
            <input
              type="text"
              placeholder="15-digit GSTIN"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono uppercase focus:border-indigo-500 focus:outline-none transition-colors"
            />
            {errors.gstin && <span className="text-xs text-rose-500 mt-1">{errors.gstin}</span>}
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
            {customer ? "Save Changes" : "Add Customer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
