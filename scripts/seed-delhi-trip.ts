import { loadEnvConfig } from "@next/env";

// Run with:  npx tsx --conditions=react-server scripts/seed-delhi-trip.ts
//
// The condition flag is required because lib/firebase.ts imports "server-only", which
// throws outside a React Server Component unless that condition is set.
//
// Records the settled Delhi trip compiled by Siraj.
//
// The source sheet does not reconcile with its own line items: the seven transport
// entries sum to 13,689 but the sheet wrote 13,589, and the 25,347 subtotal was then
// rounded down to a flat 25,000 before Safwan's 2,100 was added, which is what produced
// the agreed 27,100. Every real cost is entered verbatim below and the round-down is
// recorded as one explicit adjustment line, so the trip lands on the settled figures
// without misstating any individual expense.

loadEnvConfig(process.cwd());

const SECTIONS: { name: string; items: [string, number][] }[] = [
  {
    name: "Transportation",
    items: [
      ["Delhi to Jalandhar", 2966],
      ["To Chandigarh", 339],
      ["To Calicut", 7816],
      ["Metro", 600],
      ["Scooter rent", 600],
      ["Diesel", 500],
      ["Auto and misc", 868],
      ["Train ticket cancellation refund", -1230],
    ],
  },
  { name: "Food", items: [["Food total", 8068]] },
  {
    name: "Rooms",
    items: [
      ["Delhi", 3600],
      ["Jalandhar", 1200],
      ["Rest room", 120],
    ],
  },
  { name: "Adjustment", items: [["Round-off agreed at settlement", -447]] },
  { name: "By Safwan", items: [["Expenses paid by Safwan", 2100]] },
];

const START_DATE = "2026-03-12";
const END_DATE = "2026-03-16";

async function seed() {
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.error("Error: FIREBASE_PROJECT_ID is missing. Create .env.local first.");
    process.exit(1);
  }

  const { saveTrip } = await import("../lib/db");
  const { TripSchema } = await import("../lib/types");
  const { tripTotal, splitShares } = await import("../lib/trip-calculations");

  const now = new Date().toISOString();

  const trip = TripSchema.parse({
    id: crypto.randomUUID(),
    name: "Delhi Trip",
    startDate: START_DATE,
    endDate: END_DATE,
    notes:
      "Compiled by Siraj. Settled at a rounded 27,100 and split equally with Wetta. " +
      "The adjustment line records the agreed round-down from 25,447.",
    sections: SECTIONS.map((section) => ({
      id: crypto.randomUUID(),
      name: section.name,
      items: section.items.map(([description, amount]) => ({
        id: crypto.randomUUID(),
        date: START_DATE,
        description,
        amount,
      })),
    })),
    splits: [
      { id: crypto.randomUUID(), party: "LENORE", mode: "percent", value: 50, isOwn: true },
      { id: crypto.randomUUID(), party: "WETTA", mode: "percent", value: 50, isOwn: false },
    ],
    createdAt: now,
    updatedAt: now,
  });

  await saveTrip(trip);

  console.log(`Seeded "${trip.name}" (${trip.id})`);
  console.log(`  Grand total: ${tripTotal(trip)}`);
  for (const share of splitShares(trip)) {
    console.log(`  ${share.party.padEnd(8)} ${share.amount}${share.isOwn ? "  (ours)" : ""}`);
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
