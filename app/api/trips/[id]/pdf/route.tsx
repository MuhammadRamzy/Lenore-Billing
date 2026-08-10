import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { pdf, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { getTrips, getCompany } from "@/lib/db";
import { isAuthenticated } from "@/lib/api-auth";
import { sectionTotal, tripTotal, splitShares } from "@/lib/trip-calculations";
import type { Trip, Company } from "@/lib/types";

export const revalidate = 0;

const styles = StyleSheet.create({
  page: {
    padding: 34,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#334155",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: "#0f172a",
    paddingBottom: 10,
    marginBottom: 14,
  },
  company: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  companyMeta: { fontSize: 8, color: "#64748b", marginTop: 2 },
  tripName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f172a", textAlign: "right" },
  tripDates: { fontSize: 8, color: "#64748b", marginTop: 2, textAlign: "right" },
  notes: { fontSize: 8, color: "#475569", marginBottom: 12, lineHeight: 1.4 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f1f5f9",
    paddingVertical: 5,
    paddingHorizontal: 7,
    marginTop: 10,
  },
  sectionName: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f172a", textTransform: "uppercase" },
  sectionTotal: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3.5,
    paddingHorizontal: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f1f5f9",
  },
  date: { width: "18%", color: "#94a3b8", fontSize: 8 },
  description: { width: "60%", color: "#334155" },
  amount: { width: "22%", textAlign: "right", fontFamily: "Helvetica-Bold", color: "#0f172a" },
  refund: { width: "22%", textAlign: "right", fontFamily: "Helvetica-Bold", color: "#059669" },
  emptySection: { paddingVertical: 4, paddingHorizontal: 7, fontSize: 8, color: "#94a3b8" },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 2,
    borderTopColor: "#0f172a",
    marginTop: 14,
    paddingTop: 8,
  },
  grandLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0f172a", textTransform: "uppercase" },
  grandValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  splitBox: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 10,
  },
  splitTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  splitRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  splitParty: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#334155" },
  splitAmount: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  footer: { marginTop: 20, fontSize: 7, color: "#94a3b8", textAlign: "center" },
});

// Rupee glyphs are not present in the built-in Helvetica font, so amounts are prefixed
// with "Rs." to avoid rendering as a blank box in the PDF.
function money(value: number): string {
  const formatted = Math.abs(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? "-" : ""}Rs. ${formatted}`;
}

function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function TripDocument({ trip, company }: { trip: Trip; company: Company }) {
  const total = tripTotal(trip);
  const shares = splitShares(trip);
  const hasSplit = trip.splits.length > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>{company.name}</Text>
            {company.gstin ? <Text style={styles.companyMeta}>GSTIN: {company.gstin}</Text> : null}
          </View>
          <View>
            <Text style={styles.tripName}>{trip.name}</Text>
            <Text style={styles.tripDates}>
              {formatDay(trip.startDate)}
              {trip.endDate ? ` - ${formatDay(trip.endDate)}` : ""}
            </Text>
          </View>
        </View>

        {trip.notes ? <Text style={styles.notes}>{trip.notes}</Text> : null}

        {trip.sections.map((section) => (
          <View key={section.id} wrap={false}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionName}>{section.name}</Text>
              <Text style={styles.sectionTotal}>{money(sectionTotal(section))}</Text>
            </View>

            {section.items.length === 0 ? (
              <Text style={styles.emptySection}>No items recorded.</Text>
            ) : (
              section.items.map((item) => (
                <View key={item.id} style={styles.row}>
                  <Text style={styles.date}>{formatDay(item.date)}</Text>
                  <Text style={styles.description}>{item.description}</Text>
                  {/* Refunds print as negative figures rather than being netted away, so
                      the receiving party can see what came back. */}
                  <Text style={item.amount < 0 ? styles.refund : styles.amount}>
                    {money(item.amount)}
                  </Text>
                </View>
              ))
            )}
          </View>
        ))}

        <View style={styles.grandRow}>
          <Text style={styles.grandLabel}>Grand total</Text>
          <Text style={styles.grandValue}>{money(total)}</Text>
        </View>

        {hasSplit ? (
          <View style={styles.splitBox}>
            <Text style={styles.splitTitle}>Cost split</Text>
            {shares.map((share) => {
              const split = trip.splits.find((s) => s.party === share.party);
              const basis =
                split?.mode === "percent" ? `${split.value}%` : "fixed";
              return (
                <View key={share.party} style={styles.splitRow}>
                  <Text style={styles.splitParty}>
                    {share.party} ({basis})
                  </Text>
                  <Text style={styles.splitAmount}>{money(share.amount)}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.footer}>
          Generated {new Date().toLocaleDateString("en-IN")} · {company.name}
        </Text>
      </Page>
    </Document>
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const trips = await getTrips();
    const trip = trips.find((t) => t.id === id);

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const company = await getCompany();
    const doc = <TripDocument trip={trip} company={company} />;
    const stream = await pdf(doc).toBuffer();

    const slug = trip.name.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");

    return new Response(stream as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug || "trip"}-expenses.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Trip PDF generation failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
