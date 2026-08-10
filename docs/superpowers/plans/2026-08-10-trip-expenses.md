# Trip Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the team record a business trip as one record containing named sections of small line items, split the total between parties, and export it as a shareable PDF.

**Architecture:** Trips live in their own Firestore `trips` collection, entirely separate from `expenses`, so existing expense figures cannot double-count. Sections and items are embedded in the trip document. No total is ever persisted — all totals derive from pure functions in `lib/trip-calculations.ts`. The dashboard counts only the business's own split share.

**Tech Stack:** Next.js 16.3 (App Router, Server Actions), TypeScript, Zod 4, Firebase Admin SDK (Firestore), `@react-pdf/renderer`, Tailwind 4, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-10-trip-expenses-design.md`. Read it before Task 2.
- This is Next.js 16. Read `node_modules/next/dist/docs/` before using an unfamiliar API. Per `AGENTS.md`, conventions differ from older versions.
- Every server action calls `await verifyAuthSessionOrThrow()` as its first statement.
- Every API route calls `await isAuthenticated()` and returns 401 when false.
- Never mutate inputs. Build new objects and arrays (project rule).
- Money passes through `roundToTwoDecimals` from `lib/calculations.ts`.
- Item amounts may be negative — that is how refunds are represented. Never clamp to zero.
- Files stay focused; prefer a new component over growing `components/ExpensesList.tsx` (already 760 lines).
- Run `npx tsc --noEmit` before every commit.

---

### Task 1: Vitest setup

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts)
- Test: `lib/__tests__/setup.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs Vitest once and exits; `@/` resolves to the project root in tests.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths
```

- [ ] **Step 2: Write the config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add the test scripts**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a test proving path aliases resolve**

Create `lib/__tests__/setup.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { roundToTwoDecimals } from "@/lib/calculations";

describe("test setup", () => {
  it("resolves the @/ path alias", () => {
    expect(roundToTwoDecimals(1.005)).toBeTypeOf("number");
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json package-lock.json lib/__tests__/setup.test.ts
git commit -m "test: add vitest with path alias resolution"
```

---

### Task 2: Trip schemas

**Files:**
- Modify: `lib/types.ts` (append after `ExpenseSchema`, before `StockLogSchema`)
- Test: `lib/__tests__/trip-schema.test.ts`

**Interfaces:**
- Consumes: `z` from `zod`, already imported in `lib/types.ts`.
- Produces: `TripItemSchema`, `TripSectionSchema`, `TripSplitSchema`, `TripSchema`, and types `TripItem`, `TripSection`, `TripSplit`, `Trip`.

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/trip-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TripSchema, TripItemSchema } from "@/lib/types";

const baseTrip = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Delhi Trip",
  startDate: "2026-03-12",
  endDate: "2026-03-16",
  sections: [],
  splits: [],
  createdAt: "2026-03-12T00:00:00.000Z",
  updatedAt: "2026-03-12T00:00:00.000Z",
};

describe("TripSchema", () => {
  it("accepts a minimal trip", () => {
    expect(TripSchema.parse(baseTrip).name).toBe("Delhi Trip");
  });

  it("defaults sections and splits to empty arrays", () => {
    const { sections, splits, ...withoutArrays } = baseTrip;
    const parsed = TripSchema.parse(withoutArrays);
    expect(parsed.sections).toEqual([]);
    expect(parsed.splits).toEqual([]);
  });

  it("rejects an empty trip name", () => {
    expect(() => TripSchema.parse({ ...baseTrip, name: "" })).toThrow();
  });

  it("allows a null end date for an open trip", () => {
    expect(TripSchema.parse({ ...baseTrip, endDate: null }).endDate).toBeNull();
  });
});

describe("TripItemSchema", () => {
  const item = {
    id: "22222222-2222-4222-8222-222222222222",
    date: "2026-03-14",
    description: "Taxi to site",
    amount: 850,
  };

  it("accepts a positive amount", () => {
    expect(TripItemSchema.parse(item).amount).toBe(850);
  });

  it("accepts a negative amount for a refund", () => {
    expect(TripItemSchema.parse({ ...item, amount: -1230 }).amount).toBe(-1230);
  });

  it("rejects an empty description", () => {
    expect(() => TripItemSchema.parse({ ...item, description: "" })).toThrow();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test`
Expected: FAIL — `TripSchema` is not exported from `lib/types.ts`.

- [ ] **Step 3: Add the schemas**

In `lib/types.ts`, insert after `ExpenseSchema` and before `StockLogSchema`:

```ts
export const TripItemSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  description: z.string().min(1, "Description is required"),
  // Negative amounts are valid and represent refunds, such as a cancelled ticket.
  amount: z.number(),
});

export const TripSectionSchema = z.object({
  id: z.string().uuid(),
  // Free text: the team's own names (Transportation, Food, Rooms, By Safwan) do not
  // map onto the fixed expense category enum.
  name: z.string().min(1, "Section name is required"),
  items: z.array(TripItemSchema).default([]),
});

export const TripSplitSchema = z.object({
  id: z.string().uuid(),
  party: z.string().min(1, "Party name is required"),
  mode: z.enum(["percent", "amount"]),
  value: z.number().nonnegative(),
  // Marks the share belonging to this business; determines what reaches the dashboard.
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

Then add to the type exports at the bottom of the file, alongside `export type Expense = ...`:

```ts
export type TripItem = z.infer<typeof TripItemSchema>;
export type TripSection = z.infer<typeof TripSectionSchema>;
export type TripSplit = z.infer<typeof TripSplitSchema>;
export type Trip = z.infer<typeof TripSchema>;
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/types.ts lib/__tests__/trip-schema.test.ts
git commit -m "feat: add trip, section, item and split schemas"
```

---

### Task 3: Trip calculations and split validation

This is the task that carries the real risk. Test it hard.

**Files:**
- Create: `lib/trip-calculations.ts`
- Test: `lib/__tests__/trip-calculations.test.ts`

**Interfaces:**
- Consumes: `Trip`, `TripSection`, `TripSplit` from `lib/types`; `roundToTwoDecimals` from `lib/calculations`.
- Produces:
  - `sectionTotal(section: TripSection): number`
  - `tripTotal(trip: Trip): number`
  - `splitShares(trip: Trip): SplitShare[]` where `SplitShare = { party: string; amount: number; isOwn: boolean }`
  - `ownShare(trip: Trip): number`
  - `validateSplits(trip: Trip): string | null` — `null` means valid, otherwise a user-facing message.

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/trip-calculations.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  sectionTotal,
  tripTotal,
  splitShares,
  ownShare,
  validateSplits,
} from "@/lib/trip-calculations";
import type { Trip, TripSection, TripSplit } from "@/lib/types";

let counter = 0;
const uid = () => `${++counter}`.padStart(8, "0") + "-0000-4000-8000-000000000000";

function item(description: string, amount: number) {
  return { id: uid(), date: "2026-03-14", description, amount };
}

function section(name: string, amounts: number[]): TripSection {
  return { id: uid(), name, items: amounts.map((a, i) => item(`${name} ${i}`, a)) };
}

function trip(sections: TripSection[], splits: TripSplit[] = []): Trip {
  return {
    id: uid(),
    name: "Delhi Trip",
    startDate: "2026-03-12",
    endDate: "2026-03-16",
    notes: "",
    sections,
    splits,
    createdAt: "2026-03-12T00:00:00.000Z",
    updatedAt: "2026-03-12T00:00:00.000Z",
  };
}

describe("sectionTotal", () => {
  it("sums the items", () => {
    expect(sectionTotal(section("Rooms", [3600, 1200, 120]))).toBe(4920);
  });

  it("subtracts refund lines", () => {
    // The real Delhi transport section: 13,589 of spend less a 1,230 cancellation.
    const transport = section("Transportation", [2966, 339, 7816, 600, 600, 500, 868, -1230]);
    expect(sectionTotal(transport)).toBe(12359);
  });

  it("is zero for a section with no items", () => {
    expect(sectionTotal(section("Empty", []))).toBe(0);
  });
});

describe("tripTotal", () => {
  it("sums every section", () => {
    const t = trip([
      section("Transportation", [2966, 339, 7816, 600, 600, 500, 868, -1230]),
      section("Food", [8068]),
      section("Rooms", [3600, 1200, 120]),
      section("By Safwan", [2100]),
    ]);
    expect(tripTotal(t)).toBe(27100);
  });

  it("is zero for a trip with no sections", () => {
    expect(tripTotal(trip([]))).toBe(0);
  });
});

describe("splitShares", () => {
  it("treats a trip with no splits as entirely our own", () => {
    const shares = splitShares(trip([section("Food", [1000])]));
    expect(shares).toEqual([{ party: "Own", amount: 1000, isOwn: true }]);
  });

  it("splits the Delhi trip 50/50", () => {
    const t = trip(
      [section("All", [27100])],
      [
        { id: uid(), party: "LENORE", mode: "percent", value: 50, isOwn: true },
        { id: uid(), party: "WETTA", mode: "percent", value: 50, isOwn: false },
      ]
    );
    expect(splitShares(t)).toEqual([
      { party: "LENORE", amount: 13550, isOwn: true },
      { party: "WETTA", amount: 13550, isOwn: false },
    ]);
  });

  it("gives the rounding residue to our own share so parts sum to the total", () => {
    // 100 / 3 does not divide cleanly.
    const t = trip(
      [section("All", [100])],
      [
        { id: uid(), party: "US", mode: "percent", value: 33.33, isOwn: true },
        { id: uid(), party: "A", mode: "percent", value: 33.33, isOwn: false },
        { id: uid(), party: "B", mode: "percent", value: 33.34, isOwn: false },
      ]
    );
    const shares = splitShares(t);
    const sum = shares.reduce((acc, s) => acc + s.amount, 0);
    expect(Number(sum.toFixed(2))).toBe(100);
  });

  it("makes our share the remainder in amount mode", () => {
    const t = trip(
      [section("All", [27100])],
      [
        { id: uid(), party: "LENORE", mode: "amount", value: 0, isOwn: true },
        { id: uid(), party: "WETTA", mode: "amount", value: 10000, isOwn: false },
      ]
    );
    expect(splitShares(t)).toEqual([
      { party: "LENORE", amount: 17100, isOwn: true },
      { party: "WETTA", amount: 10000, isOwn: false },
    ]);
  });

  it("grows our own share when an item is added in amount mode", () => {
    const splits: TripSplit[] = [
      { id: uid(), party: "LENORE", mode: "amount", value: 0, isOwn: true },
      { id: uid(), party: "WETTA", mode: "amount", value: 10000, isOwn: false },
    ];
    const before = ownShare(trip([section("All", [27100])], splits));
    const after = ownShare(trip([section("All", [27100, 500])], splits));
    expect(after - before).toBe(500);
  });
});

describe("ownShare", () => {
  it("returns the full total when no split is defined", () => {
    expect(ownShare(trip([section("Food", [8068])]))).toBe(8068);
  });

  it("returns only our half of a 50/50 trip", () => {
    const t = trip(
      [section("All", [27100])],
      [
        { id: uid(), party: "LENORE", mode: "percent", value: 50, isOwn: true },
        { id: uid(), party: "WETTA", mode: "percent", value: 50, isOwn: false },
      ]
    );
    expect(ownShare(t)).toBe(13550);
  });
});

describe("validateSplits", () => {
  const t = (splits: TripSplit[]) => trip([section("All", [1000])], splits);

  it("accepts a trip with no splits", () => {
    expect(validateSplits(t([]))).toBeNull();
  });

  it("rejects percentages that do not total 100", () => {
    expect(
      validateSplits(
        t([
          { id: uid(), party: "A", mode: "percent", value: 40, isOwn: true },
          { id: uid(), party: "B", mode: "percent", value: 40, isOwn: false },
        ])
      )
    ).toMatch(/100/);
  });

  it("rejects a trip with no own share", () => {
    expect(
      validateSplits(
        t([
          { id: uid(), party: "A", mode: "percent", value: 50, isOwn: false },
          { id: uid(), party: "B", mode: "percent", value: 50, isOwn: false },
        ])
      )
    ).toMatch(/own/i);
  });

  it("rejects a trip with two own shares", () => {
    expect(
      validateSplits(
        t([
          { id: uid(), party: "A", mode: "percent", value: 50, isOwn: true },
          { id: uid(), party: "B", mode: "percent", value: 50, isOwn: true },
        ])
      )
    ).toMatch(/own/i);
  });

  it("rejects mixed percent and amount modes", () => {
    expect(
      validateSplits(
        t([
          { id: uid(), party: "A", mode: "percent", value: 50, isOwn: true },
          { id: uid(), party: "B", mode: "amount", value: 500, isOwn: false },
        ])
      )
    ).toMatch(/mix/i);
  });

  it("rejects other parties' amounts exceeding the trip total", () => {
    expect(
      validateSplits(
        t([
          { id: uid(), party: "A", mode: "amount", value: 0, isOwn: true },
          { id: uid(), party: "B", mode: "amount", value: 5000, isOwn: false },
        ])
      )
    ).toMatch(/exceed/i);
  });

  it("accepts a valid 50/50 percent split", () => {
    expect(
      validateSplits(
        t([
          { id: uid(), party: "LENORE", mode: "percent", value: 50, isOwn: true },
          { id: uid(), party: "WETTA", mode: "percent", value: 50, isOwn: false },
        ])
      )
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/trip-calculations`.

- [ ] **Step 3: Implement**

Create `lib/trip-calculations.ts`:

```ts
import { roundToTwoDecimals } from "./calculations";
import type { Trip, TripSection } from "./types";

export type SplitShare = {
  party: string;
  amount: number;
  isOwn: boolean;
};

// Percent comparisons tolerate floating point drift from values like 33.33.
const EPSILON = 0.005;

export function sectionTotal(section: TripSection): number {
  const total = section.items.reduce((sum, item) => sum + item.amount, 0);
  return roundToTwoDecimals(total);
}

export function tripTotal(trip: Trip): number {
  const total = trip.sections.reduce((sum, section) => sum + sectionTotal(section), 0);
  return roundToTwoDecimals(total);
}

export function splitShares(trip: Trip): SplitShare[] {
  const total = tripTotal(trip);

  if (trip.splits.length === 0) {
    return [{ party: "Own", amount: total, isOwn: true }];
  }

  if (trip.splits[0].mode === "amount") {
    // Only the other parties carry fixed amounts; our share absorbs the rest so that
    // adding an item to the trip increases what we bear, not what we bill others.
    const othersTotal = roundToTwoDecimals(
      trip.splits.filter((s) => !s.isOwn).reduce((sum, s) => sum + s.value, 0)
    );
    return trip.splits.map((s) => ({
      party: s.party,
      amount: s.isOwn ? roundToTwoDecimals(total - othersTotal) : roundToTwoDecimals(s.value),
      isOwn: s.isOwn,
    }));
  }

  const rawShares = trip.splits.map((s) => ({
    party: s.party,
    amount: roundToTwoDecimals((total * s.value) / 100),
    isOwn: s.isOwn,
  }));

  // Rounding each share independently can leave the parts a paisa short of the whole.
  // Absorb the difference into our own share so the printed figures always reconcile.
  const distributed = rawShares.reduce((sum, s) => sum + s.amount, 0);
  const residue = roundToTwoDecimals(total - distributed);
  if (residue === 0) return rawShares;

  return rawShares.map((s) =>
    s.isOwn ? { ...s, amount: roundToTwoDecimals(s.amount + residue) } : s
  );
}

export function ownShare(trip: Trip): number {
  const own = splitShares(trip).find((s) => s.isOwn);
  return own ? own.amount : tripTotal(trip);
}

export function validateSplits(trip: Trip): string | null {
  const { splits } = trip;
  if (splits.length === 0) return null;

  const ownCount = splits.filter((s) => s.isOwn).length;
  if (ownCount !== 1) {
    return "Exactly one party must be marked as your own share.";
  }

  const modes = new Set(splits.map((s) => s.mode));
  if (modes.size > 1) {
    return "A trip cannot mix percentage and fixed amount splits.";
  }

  if (splits[0].mode === "percent") {
    const sum = splits.reduce((acc, s) => acc + s.value, 0);
    if (Math.abs(sum - 100) > EPSILON) {
      return `Split percentages must total 100%. They currently total ${roundToTwoDecimals(sum)}%.`;
    }
    return null;
  }

  const othersTotal = splits.filter((s) => !s.isOwn).reduce((acc, s) => acc + s.value, 0);
  const total = tripTotal(trip);
  if (othersTotal > total + EPSILON) {
    return `Other parties' amounts (${roundToTwoDecimals(othersTotal)}) exceed the trip total (${total}).`;
  }
  return null;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS, all cases.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add lib/trip-calculations.ts lib/__tests__/trip-calculations.test.ts
git commit -m "feat: add trip totals, split shares and split validation"
```

---

### Task 4: Firestore access for trips

**Files:**
- Modify: `lib/db.ts` (append at end of file)

**Interfaces:**
- Consumes: `db` from `./firebase`; `Trip` from `./types`.
- Produces: `getTrips(): Promise<Trip[]>`, `saveTrip(trip: Trip): Promise<void>`, `deleteTrip(id: string): Promise<void>`.

- [ ] **Step 1: Add the functions**

Append to `lib/db.ts`, following the caching pattern already used by expenses:

```ts
// Trips DB Operations
let cachedTrips: Trip[] | null = null;
let lastTripsFetch = 0;

export async function getTrips(): Promise<Trip[]> {
  if (cachedTrips && isCacheValid(lastTripsFetch)) {
    return cachedTrips;
  }

  try {
    const querySnapshot = await db.collection("trips").get();
    const list: Trip[] = [];
    querySnapshot.forEach((doc) => {
      list.push(doc.data() as Trip);
    });

    const sorted = list.sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    cachedTrips = sorted;
    lastTripsFetch = Date.now();
    return sorted;
  } catch (error) {
    console.error("Error reading trips from Firestore:", error);
    return cachedTrips || [];
  }
}

export async function saveTrip(trip: Trip): Promise<void> {
  await db.collection("trips").doc(trip.id).set(trip);
  cachedTrips = null;
  lastTripsFetch = 0;
}

export async function deleteTrip(id: string): Promise<void> {
  await db.collection("trips").doc(id).delete();
  cachedTrips = null;
  lastTripsFetch = 0;
}
```

Add `Trip` to the existing type import at the top of `lib/db.ts`:

```ts
import { Company, Customer, Product, Invoice, Counters, Purchase, Expense, StockLog, Trip } from "./types";
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add trip read and write operations"
```

---

### Task 5: Trip server actions

**Files:**
- Modify: `app/actions.ts`

**Interfaces:**
- Consumes: `getTrips`, `saveTrip`, `deleteTrip` from `@/lib/db`; `TripSchema`, `Trip` from `@/lib/types`; `validateSplits` from `@/lib/trip-calculations`; `verifyAuthSessionOrThrow` (already defined in this file).
- Produces: `createTripAction(data)`, `updateTripAction(trip: Trip)`, `deleteTripAction(id: string)`. Each returns `{ success: true; trip?: Trip }` or `{ success: false; error: string }`.

- [ ] **Step 1: Extend the imports**

Add `getTrips`, `saveTrip`, `deleteTrip` to the existing `@/lib/db` import block, add `TripSchema` and `Trip` to the `@/lib/types` import block, and add a new import:

```ts
import { validateSplits } from "@/lib/trip-calculations";
```

- [ ] **Step 2: Add the actions**

Append to `app/actions.ts`:

```ts
// --- Trip Actions ---
export async function createTripAction(
  data: Omit<Trip, "id" | "createdAt" | "updatedAt">
) {
  await verifyAuthSessionOrThrow();
  const now = new Date().toISOString();

  const trip: Trip = { ...data, id: uuidv4(), createdAt: now, updatedAt: now };

  const validated = TripSchema.parse(trip);
  const splitError = validateSplits(validated);
  if (splitError) {
    return { success: false as const, error: splitError };
  }

  await saveTrip(validated);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { success: true as const, trip: validated };
}

export async function updateTripAction(trip: Trip) {
  await verifyAuthSessionOrThrow();

  const validated = TripSchema.parse({ ...trip, updatedAt: new Date().toISOString() });
  const splitError = validateSplits(validated);
  if (splitError) {
    return { success: false as const, error: splitError };
  }

  await saveTrip(validated);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { success: true as const, trip: validated };
}

export async function deleteTripAction(id: string) {
  await verifyAuthSessionOrThrow();
  await deleteTrip(id);
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { success: true as const };
}
```

- [ ] **Step 3: Confirm every action is still guarded**

Run:

```bash
awk '
/^export async function/ { if (n!="") printf "%-38s %s\n", n, (g?"AUTH OK":">>> NO AUTH <<<"); n=$4; sub(/\(.*/,"",n); g=0; next }
/verifyAuthSessionOrThrow\(\)/ { if (n!="") g=1 }
END { if (n!="") printf "%-38s %s\n", n, (g?"AUTH OK":">>> NO AUTH <<<") }' app/actions.ts
```

Expected: the three new trip actions report `AUTH OK`. Only `loginAction` and `logoutAction` may report `NO AUTH`.

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add app/actions.ts
git commit -m "feat: add create, update and delete trip actions"
```

---

### Task 6: Expenses tabs and trips list

**Files:**
- Create: `components/TripsList.tsx`
- Create: `components/ExpensesTabs.tsx`
- Modify: `app/expenses/page.tsx`

**Interfaces:**
- Consumes: `Trip` from `@/lib/types`; `tripTotal`, `ownShare` from `@/lib/trip-calculations`; `deleteTripAction` from `@/app/actions`.
- Produces: `<TripsList trips={Trip[]} />`, `<ExpensesTabs expenses={Expense[]} trips={Trip[]} />`.

- [ ] **Step 1: Build the trips list**

Create `components/TripsList.tsx`. It is a client component. It renders one card per trip showing name, date range, grand total, and own share when a split exists; a "New trip" button linking to `/expenses/trips/new`; each card links to `/expenses/trips/[id]`; and a delete button that calls `deleteTripAction` behind a `window.confirm`. When `trips` is empty, render an empty state reading "No trips yet. Create one to group travel costs together." Match the Tailwind card styling already used in `components/ExpensesList.tsx`.

- [ ] **Step 2: Build the tab shell**

Create `components/ExpensesTabs.tsx`, a client component holding `useState<"ledger" | "trips">("ledger")`, rendering two tab buttons and, below them, either `<ExpensesList initialExpenses={expenses} />` or `<TripsList trips={trips} />`. Reuse the tab styling from `components/DashboardTabs.tsx` so it matches the rest of the app.

- [ ] **Step 3: Wire the page**

Replace `app/expenses/page.tsx` with:

```tsx
import React from "react";
import { getExpenses, getTrips } from "@/lib/db";
import ExpensesTabs from "@/components/ExpensesTabs";

export const revalidate = 0;

export default async function ExpensesPage() {
  const [expenses, trips] = await Promise.all([getExpenses(), getTrips()]);

  return <ExpensesTabs expenses={expenses} trips={trips} />;
}
```

- [ ] **Step 4: Verify in the browser**

Run `npm run dev`, log in, open `/expenses`. Both tabs render; the Ledger tab still shows existing expenses unchanged; the Trips tab shows the empty state.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add components/TripsList.tsx components/ExpensesTabs.tsx app/expenses/page.tsx
git commit -m "feat: add trips tab alongside the expense ledger"
```

---

### Task 7: Trip form — details and splits

**Files:**
- Create: `components/TripForm.tsx`
- Create: `app/expenses/trips/new/page.tsx`

**Interfaces:**
- Consumes: `createTripAction`, `updateTripAction`; `validateSplits` for live feedback; `Trip`, `TripSplit`.
- Produces: `<TripForm trip={Trip | null} />` — creates when `trip` is null, otherwise edits.

- [ ] **Step 1: Build the form**

Create `components/TripForm.tsx`, a client component with fields for name, start date, end date (optional), and notes. Below those, a splits editor: a list of rows, each with party name, mode selector (`percent` / `amount`), value, and a radio marking which row is our own share; plus add and remove row buttons. Changing the mode on any row changes it on all rows, since mixed modes are invalid.

Show the result of `validateSplits` live beneath the editor as a red message, and disable submit while it is non-null. On submit call `createTripAction` or `updateTripAction`, and on `{ success: false }` show the returned `error`. On success, `router.push` to the trip detail page.

Use `crypto.randomUUID()` for new split row ids.

- [ ] **Step 2: Add the create page**

Create `app/expenses/trips/new/page.tsx`:

```tsx
import React from "react";
import TripForm from "@/components/TripForm";

export default function NewTripPage() {
  return <TripForm trip={null} />;
}
```

- [ ] **Step 3: Verify in the browser**

Create a trip named "Delhi Trip" with a 50/50 LENORE/WETTA split. Confirm that setting both parties to 40% blocks submission with the "must total 100%" message, and that marking neither as own blocks it too.

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add components/TripForm.tsx app/expenses/trips/new/page.tsx
git commit -m "feat: add trip creation form with split configuration"
```

---

### Task 8: Trip detail — sections and items

**Files:**
- Create: `components/TripDetail.tsx`
- Create: `app/expenses/trips/[id]/page.tsx`

**Interfaces:**
- Consumes: `updateTripAction`; `sectionTotal`, `tripTotal`, `splitShares`; `Trip`, `TripSection`, `TripItem`.
- Produces: `<TripDetail trip={Trip} />`.

- [ ] **Step 1: Build the detail view**

Create `components/TripDetail.tsx`, a client component holding the trip in `useState`. It renders the trip header (name, dates, edit link), then each section as a block with its name, its items, and its subtotal from `sectionTotal`. Below the sections: the grand total from `tripTotal`, then each party's share from `splitShares`. Finally a "Download PDF" link to `/api/trips/[id]/pdf`.

Controls: add a section (name prompt), rename a section, delete a section (confirm first), and per section an inline add-item row of exactly four inputs — date, description, amount, and an add button. The date defaults to today. After adding an item, clear the description and amount and return focus to the description input, so a run of items can be typed without touching the mouse.

Amounts accept negative numbers; label the field "Amount (use a minus sign for a refund)".

Every mutation builds a new trip object — never mutate state in place — then calls `updateTripAction` and replaces local state from the returned trip.

- [ ] **Step 2: Add the detail page**

Create `app/expenses/trips/[id]/page.tsx`:

```tsx
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
```

- [ ] **Step 3: Reproduce the Delhi trip**

Enter the real trip: Transportation (2966, 339, 7816, 600, 600, 500, 868, and −1230 for the cancellation), Food (8068), Rooms (3600, 1200, 120), By Safwan (2100).

Expected: Transportation subtotal 12,359; Rooms 4,920; grand total 27,100; LENORE 13,550; WETTA 13,550.

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add components/TripDetail.tsx "app/expenses/trips/[id]/page.tsx"
git commit -m "feat: add trip detail view with sections and line items"
```

---

### Task 9: Trip PDF export

**Files:**
- Create: `app/api/trips/[id]/pdf/route.tsx`

**Interfaces:**
- Consumes: `getTrips`, `getCompany` from `@/lib/db`; `isAuthenticated` from `@/lib/api-auth`; `sectionTotal`, `tripTotal`, `splitShares`.
- Produces: `GET /api/trips/[id]/pdf` returning `application/pdf`.

- [ ] **Step 1: Build the route**

Create `app/api/trips/[id]/pdf/route.tsx`, modelled on `app/api/invoices/[id]/pdf/route.tsx`. Read that file first and follow its `@react-pdf/renderer` setup, style definitions, and buffer response.

Structure:

```tsx
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
    // ...render, then return the buffer as application/pdf
  } catch (error) {
    console.error("Trip PDF generation failed:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
```

The document shows the company name and the trip name with its date range; then each section as a heading, its items as date / description / amount rows, and a subtotal; then the grand total; then a split block listing each party with its percentage or amount and its share.

Refund lines print as negative figures rather than being netted away, so the receiving party can see what came back.

Set the download filename from the trip name, for example `Delhi-Trip-expenses.pdf`, slugifying spaces to hyphens.

- [ ] **Step 2: Verify unauthenticated access is refused**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/trips/<trip-id>/pdf
```

Expected: `307` (redirected by the proxy). Any `200` here is a bug — stop and fix.

- [ ] **Step 3: Verify the PDF**

Open the Download PDF link on the Delhi trip while logged in. Confirm subtotals 12,359 / 8,068 / 4,920 / 2,100, grand total 27,100, both shares 13,550, and the −1,230 refund visible as a negative line.

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add "app/api/trips/[id]/pdf/route.tsx"
git commit -m "feat: add shareable trip expense PDF"
```

---

### Task 10: Dashboard integration

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getTrips` from `@/lib/db`; `ownShare` from `@/lib/trip-calculations`.
- Produces: no new exports.

- [ ] **Step 1: Load trips**

In `app/dashboard/page.tsx`, add `getTrips` to the `@/lib/db` import, `ownShare` from `@/lib/trip-calculations`, and fetch alongside the existing loads:

```tsx
const trips = await getTrips();
```

- [ ] **Step 2: Fold each trip's own share into the expense aggregates**

After the existing `for (const exp of expenses) { ... }` loop, add:

```tsx
// Trips contribute only our own split share — 13,550 of a 27,100 trip, not the whole
// figure. Trips live outside the expenses collection, so nothing here double-counts.
// The share lands in the month the trip started: trips run for days and rarely
// straddle a month boundary, so per-item attribution is not worth the complexity.
for (const trip of trips) {
  const share = ownShare(trip);
  if (share === 0) continue;

  const tripDate = new Date(trip.startDate);
  if (tripDate.getMonth() === currentMonth && tripDate.getFullYear() === currentYear) {
    totalExpensesThisMonth += share;
  }

  const monthKey = trip.startDate.substring(0, 7);
  monthlyExpensesMap[monthKey] = (monthlyExpensesMap[monthKey] || 0) + share;

  // Section names are free text, so trips roll up under the existing travel category
  // rather than scattering the breakdown with one-off labels.
  expenseCategoriesMap["travel"] = (expenseCategoriesMap["travel"] || 0) + share;
}
```

- [ ] **Step 3: Include trips in the profitability total**

Change the `totalExpenses` line so operating profit accounts for trips:

```tsx
const totalExpenses =
  expenses.reduce((acc, curr) => acc + curr.amount, 0) +
  trips.reduce((acc, curr) => acc + ownShare(curr), 0);
```

- [ ] **Step 4: Verify the numbers move by the share, not the total**

Note the dashboard's total expenses figure. Add the Delhi trip with its 50/50 split. Reload.

Expected: the figure increases by exactly 13,550, and `travel` in the category breakdown increases by 13,550. An increase of 27,100 means the split is not being applied — stop and fix.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add app/dashboard/page.tsx
git commit -m "feat: count each trip's own split share in dashboard expenses"
```

---

### Task 11: Seed the real Delhi trip

This records an actual settled trip, not test data. Reproduce the agreed figures exactly.

**Files:**
- Create: `scripts/seed-delhi-trip.ts`

**Interfaces:**
- Consumes: `saveTrip` from `../lib/db`; `TripSchema` from `../lib/types`.
- Produces: one document in the `trips` collection.

**Background — why an adjustment line:**

The team's sheet does not reconcile with its own line items:

- The seven transport items sum to **13,689**, but the sheet writes **13,589** (100 short).
  After the 1,230 cancellation that is 12,459, not the 12,359 written.
- The sheet then rounds its 25,347 subtotal down to a flat **25,000** before adding
  Safwan's 2,100, which is what produces the settled **27,100** and the 13,550 halves.

Entering the true line items alone yields 27,547 and halves of 13,773.50, which is not what
was settled with Wetta. So the real items are entered verbatim and the round-down is
recorded as one explicit negative line: **−447**, in a section named `Adjustment`. That
keeps every real cost truthful and still lands on the agreed 27,100.

- [ ] **Step 1: Write the seed script**

Create `scripts/seed-delhi-trip.ts`, following the env-loading pattern of
`scripts/migrate.ts` (`loadEnvConfig` first, then a dynamic import of `../lib/db`).

Sections and items:

| Section | Item | Amount |
|---|---|---|
| Transportation | Delhi to Jalandhar | 2966 |
| Transportation | To Chandigarh | 339 |
| Transportation | To Calicut | 7816 |
| Transportation | Metro | 600 |
| Transportation | Scooter rent | 600 |
| Transportation | Diesel | 500 |
| Transportation | Auto and misc | 868 |
| Transportation | Train ticket cancellation refund | −1230 |
| Food | Food total | 8068 |
| Rooms | Delhi | 3600 |
| Rooms | Jalandhar | 1200 |
| Rooms | Rest room | 120 |
| Adjustment | Round-off agreed at settlement | −447 |
| By Safwan | Expenses paid by Safwan | 2100 |

Trip fields: name `Delhi Trip`, `startDate` `2026-03-12`, `endDate` `2026-03-16`, notes
recording that it was compiled by Siraj and settled at a rounded 27,100. Splits:
`LENORE` percent 50 `isOwn: true`, and `WETTA` percent 50 `isOwn: false`. Generate ids with
`crypto.randomUUID()` and set `createdAt`/`updatedAt` to the current ISO timestamp.

Validate with `TripSchema.parse` before calling `saveTrip`, and print the resulting
grand total and both shares so the run is self-checking.

- [ ] **Step 2: Run it**

```bash
npx tsx scripts/seed-delhi-trip.ts
```

If `tsx` is unavailable, install it as a dev dependency first: `npm install -D tsx`.

Expected output: grand total `27100`, LENORE `13550`, WETTA `13550`.
Any other figure means an item was mistyped — fix before continuing.

- [ ] **Step 3: Confirm in the app**

Open `/expenses`, Trips tab, and the Delhi Trip. Confirm subtotals of 12,459
(Transportation), 8,068 (Food), 4,920 (Rooms), −447 (Adjustment), 2,100 (By Safwan), a
grand total of 27,100, and both shares at 13,550. Download the PDF and confirm it is
presentable to Wetta.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-delhi-trip.ts
git commit -m "chore: seed the settled Delhi trip expense record"
```

---

### Task 12: Full verification

**Files:** none — verification only.

- [ ] **Step 1: Whole test suite**

Run: `npm test`
Expected: every test passes.

- [ ] **Step 2: Production build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Confirm the auth boundary still holds**

With the dev server running and no session cookie:

```bash
for p in /expenses /expenses/trips/new /api/trips/x/pdf; do
  echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000$p)"
done
```

Expected: `307` for all three.

- [ ] **Step 4: End-to-end pass**

Log in, create the Delhi trip, enter all four sections, download the PDF, and confirm the dashboard moved by 13,550. Delete the trip and confirm the dashboard returns to its previous figure.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "test: verify trip expenses end to end"
```
