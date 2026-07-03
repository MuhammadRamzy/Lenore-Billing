import React from "react";
import { getCustomers } from "@/lib/db";
import CustomersList from "@/components/CustomersList";

export const revalidate = 0; // Fresh load on request

export default async function CustomersPage() {
  const customers = await getCustomers();
  
  // Sort customers: most recent first
  const sortedCustomers = [...customers].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return <CustomersList initialCustomers={sortedCustomers} />;
}
