/**
 * Pure Remake business rules shared by the UI and mirrored by the backend
 * (the backend functions are the source of truth; these helpers drive previews
 * and are covered by logic.test.ts).
 */

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Green Coins for a weight at a material's configured rate. */
export function pointsFor(pointsPerKg: number, kg: number): number {
  return Math.round(pointsPerKg * kg);
}

/** Collector scale readings must be above 0 and at most 500 kg. */
export function isValidWeight(kg: number): boolean {
  return Number.isFinite(kg) && kg > 0 && kg <= 500;
}

/** Processor decision from accepted share: 100% accepted, 0% rejected, otherwise partial. */
export function decisionFor(
  acceptedKg: number,
  rejectedKg: number,
): "accepted" | "partial" | "rejected" {
  if (rejectedKg <= 0 && acceptedKg > 0) return "accepted";
  if (acceptedKg <= 0) return "rejected";
  return "partial";
}

/**
 * Settlement for one pickup in a verified batch: the batch's accepted share is applied
 * to the pickup's collected weight, and only that accepted weight earns coins.
 */
export function settlePickup(
  weightKg: number,
  actualKg: number,
  rejectedKg: number,
  pointsPerKg: number,
) {
  const accepted = round1(actualKg - rejectedKg);
  const ratio = actualKg > 0 ? accepted / actualKg : 0;
  const acceptedKg = round1(weightKg * ratio);
  return { acceptedKg, awarded: pointsFor(pointsPerKg, acceptedKg) };
}

/**
 * Collector payout: total accepted kilograms times the GMD-per-kg rate, rounded to
 * the butut (2 decimals). Mirrors admin_payout_balances / _create_collector_payout.
 */
export function collectorPayoutGmd(weightsKg: number[], ratePerKg: number): number {
  const kg = weightsKg.reduce((s, w) => s + w, 0);
  return Math.round(kg * ratePerKg * 100) / 100;
}

/** Partner payout: the GMD value of every voucher redeemed with that partner. */
export function partnerPayoutGmd(voucherValuesGmd: number[]): number {
  return Math.round(voucherValuesGmd.reduce((s, v) => s + v, 0) * 100) / 100;
}

/** Marking a payout paid needs a method; transfers also need the payment reference. */
export function payoutPaymentError(method: string, reference: string): string | null {
  if (!["Mobile money", "Bank transfer", "Cash"].includes(method))
    return "Choose how the payout was paid.";
  if (method !== "Cash" && reference.trim().length < 3)
    return "Enter the payment reference from the transfer.";
  return null;
}

export type RedeemCheck = { ok: true } | { ok: false; error: string };

/** Only AVAILABLE coins can be spent; pending coins never count. */
export function canRedeem(
  available: number,
  cost: number,
  stock: number,
  active = true,
): RedeemCheck {
  if (!active) return { ok: false, error: "This reward is not available." };
  if (stock <= 0) return { ok: false, error: "This reward is out of stock." };
  if (available < cost)
    return { ok: false, error: `You need ${cost - available} more Green Coins.` };
  return { ok: true };
}

/** Straight-line distance in km between two points (haversine). */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Readable message from a backend error. */
export function errorMessage(e: unknown): string {
  if (
    e &&
    typeof e === "object" &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  ) {
    return (e as { message: string }).message;
  }
  return "Something went wrong. Please try again.";
}
