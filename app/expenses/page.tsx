import React from "react";
import { getExpenses } from "@/lib/db";
import ExpensesList from "@/components/ExpensesList";

export const revalidate = 0;

export default async function ExpensesPage() {
  const expenses = await getExpenses();

  return <ExpensesList initialExpenses={expenses} />;
}
