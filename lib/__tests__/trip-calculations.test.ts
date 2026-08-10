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
    // The real Delhi transport section: line items less a 1,230 cancellation.
    const transport = section("Transportation", [2966, 339, 7816, 600, 600, 500, 868, -1230]);
    expect(sectionTotal(transport)).toBe(12459);
  });

  it("is zero for a section with no items", () => {
    expect(sectionTotal(section("Empty", []))).toBe(0);
  });
});

describe("tripTotal", () => {
  it("sums every section, including a negative adjustment", () => {
    const t = trip([
      section("Transportation", [2966, 339, 7816, 600, 600, 500, 868, -1230]),
      section("Food", [8068]),
      section("Rooms", [3600, 1200, 120]),
      section("Adjustment", [-447]),
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
