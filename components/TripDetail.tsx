"use client";

import React, { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Download,
  Pencil,
  AlertCircle,
  FolderPlus,
} from "lucide-react";
import { Trip, TripSection } from "@/lib/types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { sectionTotal, tripTotal, splitShares } from "@/lib/trip-calculations";
import { updateTripAction } from "@/app/actions";

interface TripDetailProps {
  trip: Trip;
}

const inputClass =
  "px-3 py-2 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 hover:bg-white rounded-xl text-xs transition-colors outline-none font-semibold text-slate-800";

function today(): string {
  return new Date().toISOString().substring(0, 10);
}

export default function TripDetail({ trip: initialTrip }: TripDetailProps) {
  const router = useRouter();
  const [trip, setTrip] = useState<Trip>(initialTrip);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // One draft row per section, so several sections can be filled without interfering.
  const [drafts, setDrafts] = useState<Record<string, { date: string; description: string; amount: string }>>({});
  const descriptionRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const total = tripTotal(trip);
  const shares = splitShares(trip);

  // Every mutation builds a new trip and persists it, so local state and Firestore
  // never disagree about what the totals are derived from.
  const persist = (next: Trip) => {
    setTrip(next);
    setError(null);
    startTransition(async () => {
      const result = await updateTripAction(next);
      if (!result.success) {
        setError(result.error);
        setTrip(trip);
        return;
      }
      setTrip(result.trip!);
      router.refresh();
    });
  };

  const draftFor = (sectionId: string) =>
    drafts[sectionId] ?? { date: today(), description: "", amount: "" };

  const setDraft = (sectionId: string, patch: Partial<{ date: string; description: string; amount: string }>) => {
    setDrafts({ ...drafts, [sectionId]: { ...draftFor(sectionId), ...patch } });
  };

  const addSection = () => {
    const name = window.prompt("Section name (for example Transportation, Food, Rooms)");
    if (!name?.trim()) return;

    persist({
      ...trip,
      sections: [...trip.sections, { id: crypto.randomUUID(), name: name.trim(), items: [] }],
    });
  };

  const renameSection = (section: TripSection) => {
    const name = window.prompt("Rename section", section.name);
    if (!name?.trim()) return;

    persist({
      ...trip,
      sections: trip.sections.map((s) => (s.id === section.id ? { ...s, name: name.trim() } : s)),
    });
  };

  const deleteSection = (section: TripSection) => {
    if (!window.confirm(`Delete "${section.name}" and its ${section.items.length} item(s)?`)) return;

    persist({ ...trip, sections: trip.sections.filter((s) => s.id !== section.id) });
  };

  const addItem = (sectionId: string) => {
    const draft = draftFor(sectionId);
    const amount = parseFloat(draft.amount);

    if (!draft.description.trim() || Number.isNaN(amount)) return;

    persist({
      ...trip,
      sections: trip.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              items: [
                ...s.items,
                {
                  id: crypto.randomUUID(),
                  date: draft.date,
                  description: draft.description.trim(),
                  amount,
                },
              ],
            }
          : s
      ),
    });

    // Keep the date, clear the rest, and return focus so a run of items can be typed
    // without reaching for the mouse.
    setDrafts({ ...drafts, [sectionId]: { date: draft.date, description: "", amount: "" } });
    descriptionRefs.current[sectionId]?.focus();
  };

  const deleteItem = (sectionId: string, itemId: string) => {
    persist({
      ...trip,
      sections: trip.sections.map((s) =>
        s.id === sectionId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s
      ),
    });
  };

  return (
    <div className="max-w-3xl space-y-4">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft size={13} />
        Back to expenses
      </Link>

      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-sm font-black text-slate-900">{trip.name}</h1>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            {formatDate(trip.startDate)}
            {trip.endDate ? ` – ${formatDate(trip.endDate)}` : ""}
          </p>
          {trip.notes && (
            <p className="text-[11px] text-slate-600 font-medium mt-2">{trip.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/api/trips/${trip.id}/pdf`}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-[11px] font-bold transition-all shadow-sm"
          >
            <Download size={13} />
            PDF
          </a>
          <Link
            href={`/expenses/trips/${trip.id}/edit`}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
            aria-label="Edit trip details"
          >
            <Pencil size={14} />
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl">
          <AlertCircle size={13} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-rose-700">{error}</p>
        </div>
      )}

      {trip.sections.map((section) => {
        const draft = draftFor(section.id);

        return (
          <div key={section.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-black uppercase tracking-wide text-slate-700">
                {section.name}
              </h2>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-sm font-black text-slate-900 mr-2">
                  {formatCurrency(sectionTotal(section))}
                </span>
                <button
                  onClick={() => renameSection(section)}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  aria-label={`Rename ${section.name}`}
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => deleteSection(section)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  aria-label={`Delete ${section.name}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {section.items.length > 0 && (
              <div className="divide-y divide-slate-50">
                {section.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-2">
                    <span className="text-[10px] font-bold text-slate-400 w-16 shrink-0">
                      {formatDate(item.date)}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 flex-1 min-w-0 truncate">
                      {item.description}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-black shrink-0",
                        item.amount < 0 ? "text-emerald-600" : "text-slate-900"
                      )}
                    >
                      {formatCurrency(item.amount)}
                    </span>
                    <button
                      onClick={() => deleteItem(section.id, item.id)}
                      className="p-1 text-slate-300 hover:text-rose-600 rounded transition-all shrink-0"
                      aria-label={`Delete ${item.description}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft(section.id, { date: e.target.value })}
                className={cn(inputClass, "w-36 shrink-0")}
              />
              <input
                ref={(el) => {
                  descriptionRefs.current[section.id] = el;
                }}
                value={draft.description}
                onChange={(e) => setDraft(section.id, { description: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem(section.id);
                  }
                }}
                placeholder="Description"
                className={cn(inputClass, "flex-1 min-w-0")}
              />
              <input
                type="number"
                step="0.01"
                value={draft.amount}
                onChange={(e) => setDraft(section.id, { amount: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem(section.id);
                  }
                }}
                placeholder="Amount"
                title="Use a minus sign for a refund"
                className={cn(inputClass, "w-28 shrink-0")}
              />
              <button
                onClick={() => addItem(section.id)}
                disabled={isPending}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition-all shrink-0 active:scale-95"
                aria-label={`Add item to ${section.name}`}
              >
                <Plus size={14} />
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              Use a minus sign for a refund, for example −1230 for a cancelled ticket.
            </p>
          </div>
        );
      })}

      <button
        onClick={addSection}
        className="flex items-center gap-1.5 px-4 py-2.5 border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 text-slate-600 hover:text-indigo-600 rounded-2xl text-xs font-bold transition-all w-full justify-center"
      >
        <FolderPlus size={14} />
        Add section
      </button>

      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wide text-slate-700">
            Grand total
          </span>
          <span className="text-lg font-black text-slate-900">{formatCurrency(total)}</span>
        </div>

        {trip.splits.length > 0 && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            {shares.map((share) => (
              <div key={share.party} className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-bold",
                    share.isOwn ? "text-indigo-600" : "text-slate-600"
                  )}
                >
                  {share.party}
                  {share.isOwn && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[9px]">
                      YOURS
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs font-black",
                    share.isOwn ? "text-indigo-600" : "text-slate-700"
                  )}
                >
                  {formatCurrency(share.amount)}
                </span>
              </div>
            ))}
            <p className="text-[10px] text-slate-400 font-medium pt-1">
              Only your share is counted in dashboard expenses.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
