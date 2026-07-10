import React from "react";
import { notFound } from "next/navigation";
import { getPurchases, getCompany, getProducts } from "@/lib/db";
import PurchaseDetailView from "@/components/PurchaseDetailView";

export const revalidate = 0;

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PurchaseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const purchases = await getPurchases();
  const purchase = purchases.find((p) => p.id === id);

  if (!purchase) {
    notFound();
  }

  const company = await getCompany();
  const products = await getProducts();

  return (
    <PurchaseDetailView
      purchase={purchase}
      company={company}
      products={products}
    />
  );
}
