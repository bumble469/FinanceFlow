// Helpers for task due date + time.
// The DB column is a full DateTime. Legacy rows were saved from a date-only input,
// so they sit at exactly 00:00 UTC — we treat those as "no time set".

const pad = (n: number) => String(n).padStart(2, "0");

const isDateOnly = (iso: string) => /T00:00:00(\.000)?Z$/.test(iso);

/** ISO string from the API -> value for <input type="datetime-local"> (local time). */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  if (isDateOnly(iso)) return `${iso.slice(0, 10)}T00:00`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value -> ISO (UTC) string to send to the API. */
export function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Label for lists: "21 Nov, 5:30 pm", or just "21 Nov" for old date-only tasks. */
export function formatDue(iso: string): string {
  const d = new Date(iso);
  if (isDateOnly(iso)) {
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  }
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
