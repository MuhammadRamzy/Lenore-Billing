"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, AlertCircle, Users } from "lucide-react";
import { Trip, TripSplit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { validateSplits } from "@/lib/trip-calculations";
import { createTripAction, updateTripAction } from "@/app/actions";

interface TripFormProps {
  trip: Trip | null;
}

const inputClass =
  "px-3 py-2 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 hover:bg-white rounded-xl text-xs w-full transition-colors outline-none font-semibold text-slate-800";

const labelClass = "block text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1.5";

function today(): string {
  return new Date().toISOString().substring(0, 10);
}

export default function TripForm({ trip }: TripFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(trip?.name ?? "");
  const [startDate, setStartDate] = useState(trip?.startDate ?? today());
  const [endDate, setEndDate] = useState(trip?.endDate ?? "");
  const [notes, setNotes] = useState(trip?.notes ?? "");
  const [splits, setSplits] = useState<TripSplit[]>(trip?.splits ?? []);
  const [error, setError] = useState<string | null>(null);

  // Validation needs a whole Trip. Sections only affect amount-mode validation, so the
  // existing ones are carried through to keep the live check accurate while editing.
  const draft: Trip = {
    id: trip?.id ?? "00000000-0000-4000-8000-000000000000",
    name: name || "Untitled",
    startDate,
    endDate: endDate || null,
    notes,
    sections: trip?.sections ?? [],
    splits,
    createdAt: trip?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const splitError = validateSplits(draft);

  const addSplit = () => {
    // The first row added is our own share, since every split needs exactly one.
    const isFirst = splits.length === 0;
    const mode = splits[0]?.mode ?? "percent";
    setSplits([
      ...splits,
      { id: crypto.randomUUID(), party: "", mode, value: 0, isOwn: isFirst },
    ]);
  };

  const updateSplit = (id: string, patch: Partial<TripSplit>) => {
    setSplits(splits.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeSplit = (id: string) => {
    const remaining = splits.filter((s) => s.id !== id);
    // Never leave the trip without an own share.
    if (remaining.length > 0 && !remaining.some((s) => s.isOwn)) {
      setSplits(remaining.map((s, i) => (i === 0 ? { ...s, isOwn: true } : s)));
      return;
    }
    setSplits(remaining);
  };

  // Modes cannot be mixed, so changing one row changes them all.
  const setMode = (mode: TripSplit["mode"]) => {
    setSplits(splits.map((s) => ({ ...s, mode, value: 0 })));
  };

  const markOwn = (id: string) => {
    setSplits(splits.map((s) => ({ ...s, isOwn: s.id === id })));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        startDate,
        endDate: endDate || null,
        notes: notes.trim(),
        sections: trip?.sections ?? [],
        splits,
      };

      const result = trip
        ? await updateTripAction({ ...trip, ...payload })
        : await createTripAction(payload);

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push(`/expenses/trips/${result.trip!.id}`);
      router.refresh();
    });
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft size={13} />
        Back to expenses
      </Link>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-black text-slate-900">
            {trip ? "Edit trip" : "New trip"}
          </h2>

          <div>
            <label className={labelClass} htmlFor="trip-name">Trip name</label>
            <input
              id="trip-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Delhi Trip"
              required
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="trip-start">Start date</label>
              <input
                id="trip-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="trip-end">End date (optional)</label>
              <input
                id="trip-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="trip-notes">Notes (optional)</label>
            <textarea
              id="trip-notes"
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={cn(inputClass, "resize-none")}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Users size={13} className="text-slate-400" />
                Cost split
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Leave empty if the whole trip is yours. Only your share reaches the dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={addSplit}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[11px] font-bold transition-all shrink-0"
            >
              <Plus size={12} />
              Add party
            </button>
          </div>

          {splits.length > 0 && (
            <>
              <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {(["percent", "amount"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[10px] font-bold transition-all",
                      splits[0].mode === m
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {m === "percent" ? "By percentage" : "By fixed amount"}
                  </button>
                ))}
              </div>

              {splits[0].mode === "amount" && (
                <p className="text-[11px] text-slate-500 font-medium">
                  Enter what the other parties owe. Your share is whatever remains, so it grows
                  as you add items.
                </p>
              )}

              <div className="space-y-2">
                {splits.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <input
                      value={s.party}
                      onChange={(e) => updateSplit(s.id, { party: e.target.value })}
                      placeholder="Party name"
                      className={cn(inputClass, "flex-1")}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={s.value === 0 ? "" : s.value}
                      onChange={(e) =>
                        updateSplit(s.id, { value: parseFloat(e.target.value) || 0 })
                      }
                      disabled={s.isOwn && s.mode === "amount"}
                      placeholder={s.isOwn && s.mode === "amount" ? "remainder" : "0"}
                      className={cn(inputClass, "w-28 shrink-0 disabled:bg-slate-100 disabled:text-slate-400")}
                    />
                    <span className="text-[11px] font-bold text-slate-400 w-4 shrink-0">
                      {s.mode === "percent" ? "%" : "₹"}
                    </span>
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 shrink-0 cursor-pointer">
                      <input
                        type="radio"
                        name="own-share"
                        checked={s.isOwn}
                        onChange={() => markOwn(s.id)}
                        className="accent-indigo-600"
                      />
                      Ours
                    </label>
                    <button
                      type="button"
                      onClick={() => removeSplit(s.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shrink-0"
                      aria-label={`Remove ${s.party || "party"}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {splitError && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl">
              <AlertCircle size={13} className="text-rose-600 shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold text-rose-700">{splitError}</p>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl">
            <AlertCircle size={13} className="text-rose-600 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-rose-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || splitError !== null || !name.trim()}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
        >
          {isPending ? "Saving…" : trip ? "Save changes" : "Create trip"}
        </button>
      </form>
    </div>
  );
}
