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
