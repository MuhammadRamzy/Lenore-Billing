import React from "react";
import { getPurchases } from "@/lib/db";
import PurchasesList from "@/components/PurchasesList";

export const revalidate = 0;

export default async function PurchasesPage() {
  const purchases = await getPurchases();

  return <PurchasesList initialPurchases={purchases} />;
}
