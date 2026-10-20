import { getCurrencySymbol } from "@/lib/currency";

export function daysLeftText(target: number | null | undefined, now: Date = new Date()): string {
  if (target == null || Number.isNaN(target)) return "";
  const diffMs = target * 86_400_000 - now.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "0 days left";
  return `${Math.abs(days)} day${days !== 1 ? "s" : ""} left`;
}

/**
 * Formats a money amount for display.
 *
 * `getCurrencySymbol` returns null for any currency code outside the app's
 * supported set, so we fall back to a neutral code prefix rather than calling
 * `toLocaleString({ style: "currency" })`, which throws a RangeError on an
 * invalid ISO code.
 */
export function formatCurrency(value: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const amount = value.toLocaleString("en-IN");
  if (!symbol) return `${currency} ${amount}`;
  return `${symbol}${amount}`;
}
