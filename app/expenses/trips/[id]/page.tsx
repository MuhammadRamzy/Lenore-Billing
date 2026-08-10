import React from "react";
import { notFound } from "next/navigation";
import { getTrips } from "@/lib/db";
import TripDetail from "@/components/TripDetail";

export const revalidate = 0;

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === id);

  if (!trip) notFound();

  return <TripDetail trip={trip} />;
}
