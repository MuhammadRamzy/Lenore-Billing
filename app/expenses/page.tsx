import React from "react";
import { getExpenses, getTrips } from "@/lib/db";
import ExpensesTabs from "@/components/ExpensesTabs";

export const revalidate = 0;

export default async function ExpensesPage() {
  const [expenses, trips] = await Promise.all([getExpenses(), getTrips()]);

  return <ExpensesTabs expenses={expenses} trips={trips} />;
}
