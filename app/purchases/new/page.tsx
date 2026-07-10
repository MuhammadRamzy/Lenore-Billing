import React from "react";
import { getCompany, getProducts } from "@/lib/db";
import PurchaseForm from "@/components/PurchaseForm";

export const revalidate = 0;

export default async function NewPurchasePage() {
  const company = await getCompany();
  const products = await getProducts();

  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PurchaseForm
      company={company}
      products={sortedProducts}
    />
  );
}
