# Trip Expenses — Design

**Date:** 2026-08-10
**Status:** Approved for planning

## Problem

Expenses are recorded one flat row at a time. A business trip is not one expense — it is
dozens of small ones that only mean something together. The team currently tracks a trip
in a text message, then works out the split by hand.

A real example, the Delhi trip:

```
DELHI TRIP EXP BY SIRAJ.
Transportation.
  Delhi to jalandar. 1436+1530
  to Chandigarh.     339
  To Calicut.        7816
  Metro.             600
  Scooter Rent.      600
  Diesel.            500
  Auto+.             868
  Total. 13,589
  Rtn. 1230 (train ticket cancellation)
  Total. 13,589-1230 = 12,359
FOOD TOTAL. (8068)
ROOMS.
  DELHI.       3600
  JALANDAR.    1200
  REST ROOM.   120
  TOTAL. 4920
12,359 + 8068 + 4920 = 25,347
By SAFWAN. 2100
TOTAL. 27,100
LENORE. 27,100/2 = 13,550
WETTA.  27,100/2 = 13,550
```

This sheet defines the requirements:

1. Named sections with their own subtotals (Transportation, Food, Rooms).
2. A section may be a single lump figure with no breakdown (`FOOD TOTAL 8068`).
3. Refund lines that subtract (`Rtn. 1230`).
4. A contributor's spending appended as its own block (`By SAFWAN 2100`).
5. The grand total split between two parties (Lenore / Wetta).
6. The result shared as a document, so the other party can reimburse.

## Scope

**In scope:** trips containing sections and line items; per-trip cost split between
parties; trip totals in the dashboard; PDF export of a trip.

**Out of scope**, deliberately:

- Per-person totals and reimbursement tracking. `By SAFWAN` is modelled as an ordinary
  section, which is exactly how the team already writes it.
- Advances and settlement (money handed out before a trip, balance returned after).
- Parsing inline arithmetic such as `1436+1530`. The user enters the total.
- A rounding feature. The trailing `(25,000)` on the Delhi sheet is a deliberate
  round-down from 25,347 that feeds the final 27,100, so it is load-bearing rather than
  cosmetic. It is recorded as an ordinary negative line item in an "Adjustment" section,
  which keeps the round-down explicit and auditable without adding a rounding rule to the
  model. Note also that the sheet's transport subtotal is 100 short of its own line items
  (13,689, written as 13,589); the round-down absorbs the difference, so the settled
  27,100 stands either way.
- GST, payment mode, and reference numbers on trip line items. Trip entry is deliberately
  fast; a cost needing full tax treatment belongs in the ordinary expense ledger.

## Approach

Trips are their own records in a new `trips` collection, separate from `expenses`.

Two alternatives were rejected:

- **Every trip line as an `Expense` with a `tripId`.** Conflicts with fast entry, since
  `Expense` requires `paymentMode`, `description` and `gstAmount` on every taxi fare. It
  also makes the split incoherent: a 50/50 trip would need every individual line halved,
  and refund lines make that worse.
- **Posting one summary expense into the ledger.** Double-counts as soon as anyone edits
  the trip after posting.

Keeping trips out of the `expenses` collection means existing expense figures cannot
double-count, and the split is applied once, at the trip level.

## Data model

New schemas in `lib/types.ts`, following the existing Zod-schema-plus-inferred-type
pattern.

```ts
export const TripItemSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  description: z.string().min(1, "Description is required"),
  // Negative values are valid and represent refunds, e.g. a cancelled ticket.
  amount: z.number(),
});

export const TripSectionSchema = z.object({
  id: z.string().uuid(),
  // Free text. The team's own names (Transportation, Food, Rooms, By Safwan) do not
  // map onto the fixed expense category enum, and forcing them to would lose meaning.
  name: z.string().min(1, "Section name is required"),
  items: z.array(TripItemSchema).default([]),
});

export const TripSplitSchema = z.object({
  id: z.string().uuid(),
  party: z.string().min(1, "Party name is required"),
  mode: z.enum(["percent", "amount"]),
  value: z.number().nonnegative(),
  // Marks the share belonging to this business. Exactly one split must set this,
  // and it determines what reaches the dashboard.
  isOwn: z.boolean(),
});

export const TripSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Trip name is required"),
  startDate: z.string(),
  endDate: z.string().nullable(),
  notes: z.string().optional().nullable().or(z.literal("")),
  sections: z.array(TripSectionSchema).default([]),
  splits: z.array(TripSplitSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

Sections and items are embedded in the trip document rather than stored as subcollections.
A trip holds tens of items, far below Firestore's 1 MB document limit, and embedding makes
every edit a single atomic write.

A lump-sum section is a section holding one item. `FOOD TOTAL (8068)` becomes a section
named `Food` with a single item. This needs no "lump sum" mode in the model or the UI.

### Split rules

- A trip with no splits is entirely the business's own cost.
- If any split exists, exactly one must have `isOwn: true`.
- Percent splits must total exactly 100 across all splits.
- In amount mode, only the other parties' amounts are entered. The own share is always the
  remainder: `grand total − sum of other parties' amounts`. Fixing every share as an
  absolute number would invalidate the split on every item added, since the grand total
  moves as the trip is typed in. The one rule to enforce is that the other parties'
  amounts cannot exceed the grand total.
- Percent and amount modes must not be mixed within one trip, which would make the
  remainder above ambiguous.

Validation runs in the server action, and the UI surfaces the failure inline before save.

## Derived totals

A new `lib/trip-calculations.ts` holds pure functions. No total is ever persisted, so
stored data cannot drift from the arithmetic.

```ts
sectionTotal(section: TripSection): number
tripTotal(trip: Trip): number
splitShares(trip: Trip): { party: string; amount: number; isOwn: boolean }[]
ownShare(trip: Trip): number   // full trip total when no splits are defined
```

All results pass through the existing `roundToTwoDecimals` helper in `lib/calculations.ts`.

Rounding: percent shares are computed then rounded, and any residual paisa from rounding
is added to the `isOwn` share so the parts always sum to the grand total exactly.

## Dashboard integration

`app/dashboard/page.tsx` currently aggregates expenses at four points:
`totalExpensesThisMonth`, `monthlyExpensesMap`, `expenseCategoriesMap`, and
`totalExpenses` (which feeds `operatingProfit`).

Each trip contributes **its own share only** — 13,550 for Delhi, not 27,100 — to all four.

- **Month attribution:** the whole own-share lands in the month of the trip's `startDate`.
  Distributing per item by item date would be marginally more accurate, but trips run for
  days and rarely straddle a month boundary, so the added complexity is not worth it.
- **Category attribution:** the own-share is added to the existing `travel` category.
  Section names are free text, and feeding them in directly would scatter the breakdown
  with one-off labels.
- **GST:** trip items carry no tax fields, so `totalExpenseTax` is unaffected.

## Data access

`lib/db.ts` gains `getTrips`, `saveTrip`, and `deleteTrip`, following the caching pattern
already used for expenses: a module-level cache with the shared five-minute TTL, cleared
on write.

## Server actions

In `app/actions.ts`, mirroring the existing expense actions: `createTripAction`,
`updateTripAction`, `deleteTripAction`. Each calls `verifyAuthSessionOrThrow()` first,
validates through `TripSchema`, and calls `revalidatePath`.

Section and item edits go through `updateTripAction` on the whole trip. The trip document
is small, and a single write path keeps the split validation in one place.

## UI

`/expenses` gains two tabs: **Ledger** (the existing `ExpensesList`) and **Trips**.

`ExpensesList.tsx` is already 760 lines, so nothing is added to it. New components:

| Component | Purpose |
|---|---|
| `components/TripsList.tsx` | Trips tab: each trip with dates, grand total, own share |
| `components/TripDetail.tsx` | One trip: sections and items, add/edit/delete inline |
| `components/TripForm.tsx` | Trip name, dates, notes, and split configuration |

Routes: `/expenses` hosts the tabs; `/expenses/trips/[id]` is the trip detail page.

Entry is optimised for a phone, since items get typed during the trip: four fields per
item (date, description, amount, and the section it belongs to), with the date defaulting
to today and focus returning to the description field after each add.

## PDF export

`app/api/trips/[id]/pdf/route.tsx`, following `app/api/invoices/[id]/pdf/route.tsx`, using
`@react-pdf/renderer`. It calls `isAuthenticated()` first, matching the other API routes.

Layout follows the team's own sheet, because that is the shape they already read:

```
LENORE                                   Delhi Trip
                                         12 - 16 March 2026

TRANSPORTATION
  14 Mar  Delhi to Jalandhar                     2,966
  14 Mar  To Chandigarh                            339
  ...
  16 Mar  Train ticket cancellation             -1,230
                                    Subtotal    12,359
FOOD
                                    Subtotal     8,068
ROOMS
  ...
                                    Subtotal     4,920
BY SAFWAN
                                    Subtotal     2,100
                                  ------------------------
                                  GRAND TOTAL    27,100

  SPLIT
    LENORE            50%                        13,550
    WETTA             50%                        13,550
```

Refunds print as negative figures rather than being silently netted off, so the other
party can see what was returned. The company name and logo come from `getCompany()`, as
the invoice PDF does.

## Testing

- **Unit** — `lib/trip-calculations.ts`: subtotals with refunds present, grand total across
  sections, percent and amount splits, rounding residue landing on the own share, a trip
  with no splits, and empty sections.
- **Validation** — split rules: percentages not summing to 100, other parties' amounts
  exceeding the grand total, mixed modes, zero or multiple `isOwn` splits.
- **Integration** — create a trip, add sections and items, confirm the dashboard's expense
  total moves by the own share and not the grand total.
- **Manual** — the Delhi trip entered end to end should reproduce 27,100 and 13,550, and
  its PDF should be shareable with Wetta.

## Risks

- **Double counting by the user.** Nothing stops someone entering a trip cost in the trip
  *and* in the ordinary ledger. Not solved in software; the Trips tab is the one place to
  record trip spend.
- **Split edited after the fact.** Changing the split changes historical dashboard figures,
  since nothing is snapshotted. Acceptable: totals are always derived, never stored.
