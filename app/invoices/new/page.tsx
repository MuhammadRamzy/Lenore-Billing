import React from "react";
import { getCompany, getCustomers, getProducts } from "@/lib/db";
import InvoiceForm from "@/components/InvoiceForm";

export const revalidate = 0; // Fetch fresh data on request

export default async function NewInvoicePage() {
  const company = await getCompany();
  const customers = await getCustomers();
  const products = await getProducts();

  // Sort customers: most recent first
  const sortedCustomers = [...customers].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Sort products: alphabetically by name
  const sortedProducts = [...products].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <InvoiceForm
      company={company}
      initialCustomers={sortedCustomers}
      products={sortedProducts}
    />
  );
}
