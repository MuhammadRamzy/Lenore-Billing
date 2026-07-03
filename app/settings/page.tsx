import React from "react";
import { getCompany } from "@/lib/db";
import SettingsForm from "@/components/SettingsForm";

export const revalidate = 0;

export default async function SettingsPage() {
  const company = await getCompany();
  return <SettingsForm initialCompany={company} />;
}
