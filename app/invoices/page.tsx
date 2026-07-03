import React from "react";
import { getInvoices, getCustomers } from "@/lib/db";
import InvoicesList from "@/components/InvoicesList";

export const revalidate = 0; // Fresh load on request

export default async function InvoicesPage() {
  const invoices = await getInvoices();
  const customers = await getCustomers();

  // Sort invoices: most recent first
  const sortedInvoices = [...invoices].sort(
    (a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()
  );

  return <InvoicesList initialInvoices={sortedInvoices} customers={customers} />;
}
