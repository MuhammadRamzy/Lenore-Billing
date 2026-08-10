import React from "react";
import { notFound } from "next/navigation";
import { getTrips } from "@/lib/db";
import TripForm from "@/components/TripForm";

export const revalidate = 0;

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trips = await getTrips();
  const trip = trips.find((t) => t.id === id);

  if (!trip) notFound();

  return <TripForm trip={trip} />;
}
