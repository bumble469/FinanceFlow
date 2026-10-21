export type CsvValue = string | number | boolean | null | undefined;

export function escapeCsvField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Builds a CSV string from a header row and body rows. */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  // CRLF line endings per RFC 4180 — Excel opens these cleanly.
  return lines.join("\r\n");
}

/**
 * Triggers a browser download of the given text as a file.
 * No-ops on the server.
 */
export function downloadFile(filename: string, content: string, mime = "text/csv;charset=utf-8"): void {
  if (typeof window === "undefined") return;

  // BOM so Excel detects UTF-8 and renders ₹ / é correctly.
  const blob = new Blob(["﻿", content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
