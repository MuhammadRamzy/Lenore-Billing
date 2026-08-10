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
    // Only the other parties carry fixed amounts; our share absorbs the rest, so adding
    // an item to the trip increases what we bear rather than what we bill others.
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
