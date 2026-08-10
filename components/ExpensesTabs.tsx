"use client";

import React, { useState } from "react";
import { Receipt, Plane } from "lucide-react";
import { Expense, Trip } from "@/lib/types";
import { cn } from "@/lib/utils";
import ExpensesList from "./ExpensesList";
import TripsList from "./TripsList";

interface ExpensesTabsProps {
  expenses: Expense[];
  trips: Trip[];
}

export default function ExpensesTabs({ expenses, trips }: ExpensesTabsProps) {
  const [activeTab, setActiveTab] = useState<"ledger" | "trips">("ledger");

  const tabClass = (isActive: boolean) =>
    cn(
      "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all",
      isActive
        ? "bg-white text-slate-950 shadow-sm"
        : "text-slate-500 hover:text-slate-800"
    );

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab("ledger")}
          className={tabClass(activeTab === "ledger")}
        >
          <Receipt size={13} />
          Ledger
        </button>
        <button
          onClick={() => setActiveTab("trips")}
          className={tabClass(activeTab === "trips")}
        >
          <Plane size={13} />
          Trips
          {trips.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-md text-[0.72rem]">
              {trips.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "ledger" ? (
        <ExpensesList initialExpenses={expenses} />
      ) : (
        <TripsList trips={trips} />
      )}
    </div>
  );
}
