import React from "react";
import { notFound } from "next/navigation";
import { getInvoices, getCompany, getCustomers, getProducts } from "@/lib/db";
import InvoiceDetailView from "@/components/InvoiceDetailView";

export const revalidate = 0; // Fetch fresh data on request

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const invoices = await getInvoices();
  const invoice = invoices.find((inv) => inv.id === id);

  if (!invoice) {
    notFound();
  }

  const company = await getCompany();
  const customers = await getCustomers();
  const products = await getProducts();

  return (
    <InvoiceDetailView
      invoice={invoice}
      company={company}
      customers={customers}
      products={products}
    />
  );
}
