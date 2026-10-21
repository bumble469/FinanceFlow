"use client";

import { useMemo, useState } from "react";
import { CardPrimitive } from "../lib/card-primitive";
import { EmptyState } from "../lib/empty-state";
import { StatusPill, type PillTone } from "../lib/status-pill";
import { FileText, Download, Printer, Eye, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv, downloadFile } from "@/lib/csv";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReportConfig {
  id: string;
  title: string;
  description: string;
  frequency: string;
  category: "finance" | "tasks" | "operations";
}

const AVAILABLE_REPORTS: ReportConfig[] = [
  {
    id: "financial-statement",
    title: "Executive Financial Statement",
    description: "Complete balance sheet, department budget vs actual expenditures, and income streams breakdown.",
    frequency: "Monthly / Realtime",
    category: "finance",
  },
  {
    id: "task-milestone-digest",
    title: "Milestone & Delivery Status Report",
    description: "Task completion velocity, blocked tickets summary, and milestone delivery forecasting.",
    frequency: "Weekly",
    category: "tasks",
  },
  {
    id: "resource-cost-audit",
    title: "Resource & Payroll Cost Audit",
    description: "Team allocation by department, monthly payroll rollups, and overridden cost shares.",
    frequency: "Monthly",
    category: "finance",
  },
  {
    id: "equipment-manifest",
    title: "Hardware & Equipment Manifest",
    description: "Complete inventory of owned, rented, and borrowed gear with outstanding security deposits.",
    frequency: "On Demand",
    category: "operations",
  },
  {
    id: "attendance-commerce",
    title: "Event Attendance & Box Office Digest",
    description: "Ticket tier sales velocity, attendee check-in rates, and commercial stall net margins.",
    frequency: "Post-Event / Realtime",
    category: "operations",
  },
];

/** Tonal treatment for each report category badge. */
const CATEGORY_TONES: Record<ReportConfig["category"], PillTone> = {
  finance: "success",
  tasks: "primary",
  operations: "warning",
};

/** A report's table shape as returned by /api/plan/[id]/analytics/reports */
interface ReportTable {
  headers: string[];
  rows: (string | number)[][];
  summary?: { label: string; value: string | number }[];
  boxOffice?: { headers: string[]; rows: (string | number)[][] };
  ticketSales?: { name: string; sold: number; revenue: number }[];
  checkIn?: { totalAttendees: number; checkedIn: number; notCheckedIn: number; checkInRate: number };
}

interface ReportsData {
  currency?: string;
  planName?: string;
  planType?: string;
  financeEnabled?: boolean;
  reports?: Record<string, ReportTable>;
}

export function ReportsTab({ data }: { data: Record<string, unknown> }) {
  const d = data as ReportsData;
  const currency = d.currency || "USD";
  const reports = d.reports ?? {};

  const [exporting, setExporting] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReportConfig | null>(null);

  const availableReports = useMemo(
    () => AVAILABLE_REPORTS.filter((r) => reports[r.id]),
    [reports]
  );

  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleExportCSV = (report: ReportConfig) => {
    const table = reports[report.id];
    if (!table) return;
    setExporting(report.id);
    try {
      const csv = toCsv(table.headers, table.rows);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(`${slug(report.title)}-${stamp}.csv`, csv);
    } catch (err) {
      console.error("[Reports] CSV export failed:", err);
    } finally {
      setTimeout(() => setExporting(null), 600);
    }
  };

  const handlePrint = (report: ReportConfig) => {
    const table = reports[report.id];
    if (!table || typeof window === "undefined") return;

    // Build a standalone printable document rather than printing the whole
    // dashboard shell (sidebar, tab bar, filters).
    const rowsHtml = table.rows
      .map(
        (row) =>
          `<tr>${row.map((c) => `<td>${escapeHtml(String(c))}</td>`).join("")}</tr>`
      )
      .join("");
    const summaryHtml = (table.summary ?? [])
      .map(
        (s) =>
          `<tr><th>${escapeHtml(s.label)}</th><td>${escapeHtml(String(s.value))}</td></tr>`
      )
      .join("");

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      // Popup blocked — fall back to the in-app preview.
      setPreview(report);
      return;
    }

    win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 32px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; margin-bottom: 24px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  thead th { background: #eee; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>${escapeHtml(report.title)}</h1>
<div class="meta">${escapeHtml(d.planName ?? "Plan")} &middot; generated ${new Date().toLocaleString("en-IN")}</div>
${summaryHtml ? `<table><tbody>${summaryHtml}</tbody></table>` : ""}
<table><thead><tr>${table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
<tbody>${rowsHtml}</tbody></table>
<script>window.onload = function(){ window.print(); };<\/script>
</body></html>`);
    win.document.close();
  };

  const previewTable = preview ? reports[preview.id] : null;

  return (
    <div className="space-y-4">
      <CardPrimitive
        title="Plan Reports & Exports"
        subtitle="Generate formatted statements, audits, and compliance records"
      >
        {availableReports.length === 0 ? (
          <EmptyState
            icon={<FileBarChart className="size-5" />}
            title="No report data available"
            description="Statements, audits, and compliance records will appear here once this plan has activity to report on."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {availableReports.map((report) => {
              const table = reports[report.id];
              const rowCount = table?.rows?.length ?? 0;
              return (
                <div
                  key={report.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="h-4 w-4" />
                        </span>
                        <h4 className="font-semibold text-foreground text-sm truncate">{report.title}</h4>
                      </div>
                      <StatusPill tone={CATEGORY_TONES[report.category]} className="shrink-0">
                        {report.category}
                      </StatusPill>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-10">
                      {report.description}
                    </p>
                    <p className="text-[11px] text-muted-foreground pl-10">
                      {rowCount} row{rowCount === 1 ? "" : "s"} &middot; {report.frequency}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 pl-10 text-xs">
                    <span className="text-muted-foreground">{report.frequency}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => setPreview(report)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => handlePrint(report)}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        disabled={exporting === report.id || rowCount === 0}
                        onClick={() => handleExportCSV(report)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        {exporting === report.id ? "Exporting..." : "Export"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardPrimitive>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
            <DialogDescription>
              {previewTable?.rows.length ?? 0} rows &middot; generated{" "}
              {new Date().toLocaleString("en-IN")}
            </DialogDescription>
          </DialogHeader>

          {previewTable && (
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/50">
                  <tr className="border-b border-border text-left text-muted-foreground">
                    {previewTable.headers.map((h) => (
                      <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewTable.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 whitespace-nowrap text-foreground">
                          {j === 0 ? cell : formatCell(String(cell), j, previewTable.headers[j])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2">
            {preview && (
              <Button variant="outline" size="sm" onClick={() => handlePrint(preview)}>
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
            )}
            {preview && (
              <Button size="sm" onClick={() => handleExportCSV(preview)}>
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Formats money-ish cells for the preview table. */
function formatCell(value: string, index: number, header: string): string {
  const n = Number(value);
  if (Number.isFinite(n) && /budget|spend|expense|income|cost|net|revenue|price/i.test(header)) {
    return n.toLocaleString("en-IN");
  }
  return value;
}
