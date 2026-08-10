"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Plane, Trash2, Users, ChevronRight } from "lucide-react";
import { Trip } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { tripTotal, ownShare, splitShares } from "@/lib/trip-calculations";
import { deleteTripAction } from "@/app/actions";

interface TripsListProps {
  trips: Trip[];
}

export default function TripsList({ trips }: TripsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (trip: Trip) => {
    if (!window.confirm(`Delete "${trip.name}" and all its line items?`)) return;

    setDeletingId(trip.id);
    startTransition(async () => {
      await deleteTripAction(trip.id);
      setDeletingId(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">Trips</h2>
          <p className="text-[11px] text-slate-500 font-medium">
            Group many small costs under one trip, then share the breakdown.
          </p>
        </div>
        <Link
          href="/expenses/trips/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 shrink-0"
        >
          <Plus size={14} />
          New trip
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-10 shadow-sm text-center">
          <div className="inline-flex p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl mb-3">
            <Plane size={20} />
          </div>
          <p className="text-xs font-bold text-slate-800">No trips yet</p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Create one to group travel costs together.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => {
            const total = tripTotal(trip);
            const share = ownShare(trip);
            const isSplit = trip.splits.length > 0;
            const itemCount = trip.sections.reduce((n, s) => n + s.items.length, 0);

            return (
              <div
                key={trip.id}
                className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4"
              >
                <Link href={`/expenses/trips/${trip.id}`} className="flex-1 min-w-0 group">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-black text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                      {trip.name}
                    </p>
                    <ChevronRight
                      size={13}
                      className="text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    {formatDate(trip.startDate)}
                    {trip.endDate ? ` – ${formatDate(trip.endDate)}` : ""}
                    {" · "}
                    {trip.sections.length} section{trip.sections.length === 1 ? "" : "s"}
                    {" · "}
                    {itemCount} item{itemCount === 1 ? "" : "s"}
                  </p>
                  {isSplit && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Users size={11} className="text-slate-400 shrink-0" />
                      {splitShares(trip).map((s) => (
                        <span
                          key={s.party}
                          className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-[10px] font-bold text-slate-600"
                        >
                          {s.party} {formatCurrency(s.amount)}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>

                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-slate-900">{formatCurrency(total)}</p>
                  {isSplit && (
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                      your share {formatCurrency(share)}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleDelete(trip)}
                  disabled={isPending && deletingId === trip.id}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shrink-0 disabled:opacity-40"
                  aria-label={`Delete ${trip.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
