"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileText, Download, Plus, StickyNote, BarChart3, File,
  Trash2, Calendar, BookOpen, TrendingUp, CheckSquare,
  Layers, FileDown, Loader2, Upload, Image, Video, Code,
  FilesIcon, Eye, X, FileArchive, Maximize2, Minimize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFinancialStore } from "@/lib/store";
import { getPermissions } from "@/lib/permissions";
import { authClient } from "@/lib/auth-client";
import { getCurrencySymbol } from "@/lib/currency";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useEditLock } from "@/hooks/use-edit-lock";
import { EditingPresenceIndicator } from "@/components/shared/editing-presence-indicator";

// ─── types ────────────────────────────────────────────────────────────────────

type Tab = "documents" | "reports";
type ReportPeriod = "daily" | "weekly" | "monthly";
type ReportType = "financial" | "activity" | "full";
type FileCategory = "all" | "notes" | "pdfs" | "images" | "videos" | "documents" | "code";

interface Doc {
  id: string;
  type: "document" | "note";
  title: string;
  content?: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: string;
  uploadedAt: string;
  uploadedBy: string;
}

// ─── file helpers ─────────────────────────────────────────────────────────────

const EXT_IMAGES = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
const EXT_VIDEOS = ["mp4", "webm", "mov", "avi"];
const EXT_CODE = ["js", "ts", "jsx", "tsx", "py", "json", "md", "css", "html", "htm", "java", "cpp", "c", "cs", "php", "rb", "go", "yaml", "yml", "sh", "sql"];
const EXT_DOCS = ["docx", "doc", "xlsx", "xls", "csv", "pptx", "ppt"];

function getExt(fileName?: string) {
  return fileName?.split(".").pop()?.toLowerCase() || "";
}

function getCategory(doc: Doc): Exclude<FileCategory, "all"> {
  if (doc.type === "note") return "notes";
  const ext = getExt(doc.fileName);
  if (EXT_IMAGES.includes(ext)) return "images";
  if (EXT_VIDEOS.includes(ext)) return "videos";
  if (ext === "pdf") return "pdfs";
  if (EXT_CODE.includes(ext)) return "code";
  return "documents";
}

// which extensions can be previewed in the browser
function getPreviewType(doc: Doc): "image" | "video" | "pdf" | "iframe" | "text" | "none" {
  if (doc.type === "note") return "text";
  const ext = getExt(doc.fileName);
  if (EXT_IMAGES.includes(ext)) return "image";
  if (EXT_VIDEOS.includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (["html", "htm"].includes(ext)) return "iframe";
  if (EXT_CODE.includes(ext) || ext === "csv") return "text";
  return "none"; // docx, xlsx, pptx — binary, download only
}

function getCategoryIcon(cat: FileCategory) {
  switch (cat) {
    case "notes": return StickyNote;
    case "pdfs": return FileText;
    case "images": return Image;
    case "videos": return Video;
    case "code": return Code;
    case "documents": return FileArchive;
    default: return FilesIcon;
  }
}

function getDocIcon(doc: Doc) {
  const cat = getCategory(doc);
  return getCategoryIcon(cat);
}

function getDocColor(doc: Doc) {
  const cat = getCategory(doc);
  switch (cat) {
    case "notes": return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
    case "pdfs": return "bg-red-500/10 text-red-600 dark:text-red-400";
    case "images": return "bg-green-500/10 text-green-600 dark:text-green-400";
    case "videos": return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
    case "code": return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    default: return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
  }
}

// ─── config ───────────────────────────────────────────────────────────────────

const FOLDER_CONFIG: { key: FileCategory; label: string }[] = [
  { key: "all", label: "All files" },
  { key: "notes", label: "Notes" },
  { key: "pdfs", label: "PDFs" },
  { key: "images", label: "Images" },
  { key: "videos", label: "Videos" },
  { key: "documents", label: "Documents" },
  { key: "code", label: "Code & Data" },
];

const REPORT_TYPE_CONFIG: Record<ReportType, { label: string; icon: typeof TrendingUp; description: string }> = {
  financial: { label: "Financial Report", icon: TrendingUp, description: "Income, expenses, P&L, budget utilization" },
  activity: { label: "Activity Report", icon: CheckSquare, description: "Tasks completed, milestones hit, team activity" },
  full: { label: "Full Report", icon: Layers, description: "Complete overview — finances, work done, team, milestones" },
};

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
};

function fmt(value: number, currency: string) {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${value.toLocaleString("en-IN")}`;
}

// ─── PreviewDialog ────────────────────────────────────────────────────────────
// Renders appropriate content based on the file type.
// Images → <img>, Videos → <video>, PDFs → <iframe>, Code/text → fetched <pre>,
// Notes → plain text, docx/xlsx → download prompt only.

function PreviewDialog({ doc, open, onClose }: { doc: Doc | null; open: boolean; onClose: () => void }) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Reset fullscreen when dialog closes
  useEffect(() => {
    if (!open) setFullscreen(false);
  }, [open]);

  useEffect(() => {
    if (!open || !doc) { setTextContent(null); return; }
    const pt = getPreviewType(doc);

    // for notes, content is already in doc.content
    if (pt === "text" && doc.type === "note") {
      setTextContent(doc.content || "(empty note)");
      return;
    }

    // for code/csv files, fetch the raw text
    if (pt === "text" && doc.fileUrl) {
      setLoading(true);
      fetch(doc.fileUrl)
        .then((r) => r.text())
        .then(setTextContent)
        .catch(() => setTextContent("Could not load file content."))
        .finally(() => setLoading(false));
    }
  }, [open, doc]);

  if (!doc) return null;
  const pt = getPreviewType(doc);
  const DocIcon = getDocIcon(doc);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "overflow-hidden flex flex-col p-0 transition-all duration-300",
          fullscreen
            ? "!fixed !inset-0 !translate-x-0 !translate-y-0 !top-0 !left-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none"
            : pt === "image" || pt === "video" || pt === "pdf" || pt === "iframe"
              ? "w-[95vw] sm:w-[90vw] md:w-[85vw] lg:max-w-6xl h-[85vh] sm:h-[90vh] md:h-[92vh] max-w-[95vw]"
              : "w-[95vw] sm:w-[85vw] md:w-[80vw] lg:max-w-5xl h-[80vh] sm:h-[85vh] max-w-[95vw]"
        )}
      >
        <DialogHeader className="shrink-0 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 truncate pr-4">
              <DocIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm sm:text-base">{doc.title}</span>
            </DialogTitle>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 cursor-pointer"
                onClick={() => setFullscreen((v) => !v)}
                title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {fullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </Button>

              {doc.fileUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-xs cursor-pointer"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = doc.fileUrl!;
                    a.download = doc.fileName || doc.title;
                    a.click();
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              )}

              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 cursor-pointer opacity-70 hover:opacity-100"
                onClick={onClose}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {doc.fileName && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {doc.fileName} · {doc.fileSize} · uploaded by {doc.uploadedBy}
            </p>
          )}
        </DialogHeader>

        {/* preview body */}
        <div className="flex-1 overflow-auto min-h-0 mt-2 mx-3 mb-3 sm:mx-4 sm:mb-4 rounded-lg border border-border bg-muted/30">
          {pt === "image" && (
            <div className="flex items-center justify-center p-4 min-h-[200px] sm:min-h-[300px] h-full">
              <img src={doc.fileUrl} alt={doc.title} className={cn("max-w-full object-contain rounded", fullscreen ? "max-h-[calc(100vh-120px)]" : "max-h-[78vh]")} />
            </div>
          )}

          {pt === "video" && (
            <video controls className={cn("w-full rounded", fullscreen ? "max-h-[calc(100vh-120px)]" : "max-h-[78vh]")} src={doc.fileUrl}>
              Your browser does not support video.
            </video>
          )}

          {pt === "pdf" && (
            <iframe
              src={doc.fileUrl}
              className={cn("w-full rounded", fullscreen ? "h-[calc(100vh-120px)]" : "h-[55vh] sm:h-[60vh] md:h-[70vh]")}
              title={doc.title}
            />
          )}

          {pt === "iframe" && (
            <iframe
              src={doc.fileUrl}
              className={cn("w-full rounded", fullscreen ? "h-[calc(100vh-120px)]" : "h-[55vh] sm:h-[60vh] md:h-[70vh]")}
              sandbox="allow-scripts allow-same-origin"
              title={doc.title}
            />
          )}

          {pt === "text" && (
            loading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : (
              <pre className={cn("p-4 text-xs font-mono text-foreground whitespace-pre-wrap break-words leading-relaxed overflow-auto", fullscreen ? "max-h-[calc(100vh-120px)]" : "max-h-[78vh]")}>
                {textContent}
              </pre>
            )
          )}

          {pt === "none" && (
            <div className="flex flex-col items-center justify-center gap-3 p-8 sm:p-12 text-center">
              <DocIcon className="h-10 w-10 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-foreground">Preview not available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This file type can&apos;t be previewed in the browser. Download it to open locally.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 cursor-pointer"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = doc.fileUrl!;
                  a.download = doc.fileName || doc.title;
                  a.click();
                }}
              >
                <Download className="h-4 w-4" />
                Download file
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── DocCard ──────────────────────────────────────────────────────────────────

function DocCard({
  doc,
  canDelete,
  onPreview,
  onEditNote,
  onDelete,
}: {
  doc: Doc;
  canDelete: boolean;
  onPreview: (d: Doc) => void;
  onEditNote: (d: Doc) => void;
  onDelete: (id: string) => void;
}) {
  const DocIcon = getDocIcon(doc);
  const colorClass = getDocColor(doc);
  const isNote = doc.type === "note";
  const pt = getPreviewType(doc);

  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 flex gap-3 hover:border-foreground/20 hover:shadow-sm transition-all">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", colorClass.split(" ").slice(0, 1).join(" "))}>
        <DocIcon className={cn("h-4 w-4", colorClass.split(" ").slice(1).join(" "))} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm text-foreground truncate">{doc.title}</p>
        {isNote ? (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{doc.content || "—"}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">
            {doc.fileName} · {doc.fileSize}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1.5">
          {new Date(doc.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          {" · "}{doc.uploadedBy}
        </p>
      </div>

      <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {/* preview — always shown if previewable */}
        {pt !== "none" && (
          <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer" onClick={() => onPreview(doc)} title="Preview">
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* download — files only */}
        {!isNote && doc.fileUrl && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 cursor-pointer"
            title="Download"
            onClick={() => {
              const a = document.createElement("a");
              a.href = doc.fileUrl!;
              a.download = doc.fileName || doc.title;
              a.click();
            }}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* edit — notes only */}
        {isNote && (
          <Button size="icon" variant="ghost" className="h-7 w-7 cursor-pointer" onClick={() => onEditNote(doc)} title="Edit note">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* delete */}
        {canDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer"
            onClick={() => onDelete(doc.id)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── ReportPreview ────────────────────────────────────────────────────────────

function ReportPreview({ period, type }: { period: ReportPeriod; type: ReportType }) {
  const { income, expenses, tasks, milestones, currency, teamMembers, budget } = useFinancialStore();
  const cfg = REPORT_TYPE_CONFIG[type];
  const Icon = cfg.icon;
  const now = new Date();

  function inPeriod(dateStr: string) {
    const d = new Date(dateStr);
    if (period === "daily") return d.toDateString() === now.toDateString();
    if (period === "weekly") {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }

  const filteredIncome = income.filter(
    (i) => i.receivedAt && inPeriod(i.receivedAt)
  );

  const filteredExpenses = expenses.filter(
    (e) => e.occurredAt && inPeriod(e.occurredAt)
  );
  const totalIncome = filteredIncome.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const netPL = totalIncome - totalExpenses;
  const budgetUsedPct = budget > 0 ? Math.round((expenses.reduce((s, e) => s + e.amount, 0) / budget) * 100) : 0;
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const achievedMilestones = milestones.filter((m) => m.status === "ACHIEVED").length;

  const financialData = [
    { label: "Total Income", value: fmt(totalIncome, currency), positive: true as boolean | null },
    { label: "Total Expenses", value: fmt(totalExpenses, currency), positive: false as boolean | null },
    { label: "Net P&L", value: (netPL >= 0 ? "+" : "") + fmt(netPL, currency), positive: netPL >= 0 as boolean | null },
    { label: "Budget Used", value: `${budgetUsedPct}%`, positive: null },
  ];

  const activityData = [
    { label: "Tasks Completed", value: doneTasks.toString() },
    { label: "Tasks In Progress", value: inProgressTasks.toString() },
    { label: "Milestones Achieved", value: achievedMilestones.toString() },
    { label: "Team Members", value: teamMembers.length.toString() },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">{cfg.label}</p>
            <p className="text-xs text-muted-foreground">{PERIOD_LABELS[period]}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs cursor-pointer">
          <FileDown className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {period === "daily" && now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {period === "weekly" && "Week of " + now.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            {period === "monthly" && now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </span>
        </div>

        {(type === "financial" || type === "full") && (
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Financials</p>
            <div className="grid grid-cols-2 gap-2">
              {financialData.map((item) => (
                <div key={item.label} className="rounded-lg bg-muted/40 px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className={cn("text-sm font-semibold mt-0.5 font-mono",
                    item.positive === true ? "text-green-600 dark:text-green-400"
                      : item.positive === false ? "text-destructive"
                        : "text-foreground")}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(type === "activity" || type === "full") && (
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Activity</p>
            <div className="grid grid-cols-2 gap-2">
              {activityData.map((item) => (
                <div key={item.label} className="rounded-lg bg-muted/40 px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-semibold mt-0.5 text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {type === "full" && milestones.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Milestones</p>
            <div className="space-y-1.5">
              {milestones.slice(0, 4).map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-xs">
                  <div className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                    m.status === "ACHIEVED" ? "bg-green-500"
                      : m.status === "IN_PROGRESS" ? "bg-yellow-500"
                        : m.status === "MISSED" ? "bg-destructive"
                          : "bg-muted-foreground")} />
                  <span className="text-foreground">{m.title}</span>
                  <span className="ml-auto text-muted-foreground capitalize">{m.status.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
          Generated on {now.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · Live data from your plan
        </p>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function ReportsSection({ planId }: { planId: string }) {
  // ── store + permissions ──────────────────────────────────────────────────
  const { currentPlanMeta, income, expenses, tasks, milestones, currency, teamMembers, budget } = useFinancialStore();
  const permissions = getPermissions(currentPlanMeta);

  // ── tabs ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("documents");

  // ── docs state ───────────────────────────────────────────────────────────
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<FileCategory>("all");
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // ── preview ──────────────────────────────────────────────────────────────
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // ── note dialog ──────────────────────────────────────────────────────────
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Doc | null>(null);
  const [noteForm, setNoteForm] = useState({ title: "", content: "" });
  const [noteSaving, setNoteSaving] = useState(false);
  const { locked: noteLocked, lockedByName: noteLockedByName, otherEditors: noteEditors } = useEditLock(
    "note",
    editingNote?.id ?? null,
    noteOpen && !!editingNote
  );

  // ── upload ────────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── reports ──────────────────────────────────────────────────────────────
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("weekly");
  const [reportType, setReportType] = useState<ReportType>("full");

  // ── fetch docs on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!planId) return;
    authClient
      .request(`/api/plan/${planId}/documents`, { method: "GET" })
      .then((res) => { if (res.data.success) setDocs(res.data.data); })
      .catch(console.error)
      .finally(() => setDocsLoading(false));
  }, [planId]);

  // ── folder counts ─────────────────────────────────────────────────────────
  const folderCounts = FOLDER_CONFIG.reduce((acc, f) => {
    acc[f.key] = f.key === "all" ? docs.length : docs.filter((d) => getCategory(d) === f.key).length;
    return acc;
  }, {} as Record<FileCategory, number>);

  const filteredDocs = activeFolder === "all"
    ? docs
    : docs.filter((d) => getCategory(d) === activeFolder);

  // ── delete ────────────────────────────────────────────────────────────────
  function requestDelete(id: string) {
    setDeleteDocId(id);
    setConfirmDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteDocId) return;
    const id = deleteDocId;
    try {
      await authClient.request(`/api/plan/${planId}/documents/${id}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleteDocId(null);
    }
  }

  // ── note submit ───────────────────────────────────────────────────────────
  async function handleNoteSubmit() {
    if (!noteForm.title.trim() || noteLocked) return;
    setNoteSaving(true);
    try {
      if (editingNote) {
        const res = await authClient.request(`/api/plan/${planId}/documents/${editingNote.id}`, {
          method: "PATCH",
          data: { title: noteForm.title, content: noteForm.content },
        });
        setDocs((prev) => prev.map((d) => (d.id === editingNote.id ? res.data.data : d)));
      } else {
        const res = await authClient.request(`/api/plan/${planId}/documents`, {
          method: "POST",
          data: { title: noteForm.title, content: noteForm.content },
        });
        setDocs((prev) => [res.data.data, ...prev]);
      }
      setNoteOpen(false);
      setEditingNote(null);
      setNoteForm({ title: "", content: "" });
    } catch (err) {
      console.error("Note save failed:", err);
    } finally {
      setNoteSaving(false);
    }
  }

  // ── file upload via XHR (supports progress events) ────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name.replace(/\.[^.]+$/, "")); // title = filename without extension

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 201) {
        const body = JSON.parse(xhr.responseText);
        setDocs((prev) => [body.data, ...prev]);
        setUploadProgress(null);
      } else {
        const body = JSON.parse(xhr.responseText);
        setUploadError(body.error || "Upload failed");
        setUploadProgress(null);
      }
      // reset input so same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    xhr.onerror = () => {
      setUploadError("Network error — please try again");
      setUploadProgress(null);
    };

    xhr.open("POST", `/api/plan/${planId}/documents`);
    // cookies are sent automatically (same-origin)
    xhr.send(formData);
  }

  const tabs = [
    { key: "documents" as Tab, label: "Documents & Notes", icon: BookOpen },
    { key: "reports" as Tab, label: "Generated Reports", icon: BarChart3 },
  ];

  return (
    <div className="space-y-5">
      {/* page header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage documents, notes, and generate reports for your plan
        </p>
      </div>

      {/* tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── DOCUMENTS TAB ── */}
      {activeTab === "documents" && (
        <div className="flex gap-5">

          {/* ── Folder sidebar ── */}
          <div className="w-44 shrink-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-2">
              Folders
            </p>
            {FOLDER_CONFIG.map((folder) => {
              const FolderIcon = getCategoryIcon(folder.key);
              const count = folderCounts[folder.key] ?? 0;
              return (
                <button
                  key={folder.key}
                  onClick={() => setActiveFolder(folder.key)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all text-left cursor-pointer",
                    activeFolder === folder.key
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate text-xs font-medium">{folder.label}</span>
                  </div>
                  {count > 0 && (
                    <span className={cn(
                      "text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded-full",
                      activeFolder === folder.key ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Right content area ── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* toolbar */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">
                {FOLDER_CONFIG.find((f) => f.key === activeFolder)?.label}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  ({folderCounts[activeFolder] ?? 0})
                </span>
              </p>

              {/* actions — gated by permissions */}
              {permissions.canAddReport && (
                <div className="flex items-center gap-2">
                  {/* hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.mp4,.webm,.mov,.txt,.pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.html,.htm,.js,.ts,.jsx,.tsx,.py,.json,.md,.css,.java,.cpp,.c,.cs,.php,.rb,.go,.yaml,.yml,.sh,.sql"
                    onChange={handleFileSelect}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs cursor-pointer hover:text-gray-600"
                    disabled={uploadProgress !== null}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload file
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs cursor-pointer hover:text-gray-600"
                    onClick={() => {
                      setEditingNote(null);
                      setNoteForm({ title: "", content: "" });
                      setNoteOpen(true);
                    }}
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                    Add note
                  </Button>
                </div>
              )}
            </div>

            {/* upload progress bar */}
            {uploadProgress !== null && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-1.5" />
              </div>
            )}

            {/* upload error */}
            {uploadError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                <p className="text-xs text-destructive flex-1">{uploadError}</p>
                <button className="cursor-pointer" onClick={() => setUploadError(null)}>
                  <X className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            )}

            {/* doc grid */}
            {docsLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <File className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    No {activeFolder === "all" ? "files" : FOLDER_CONFIG.find((f) => f.key === activeFolder)?.label?.toLowerCase()} yet
                  </p>
                  {permissions.canAddReport && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload a file or add a note to get started
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {filteredDocs.map((doc) => (
                  <DocCard
                    key={doc.id}
                    doc={doc}
                    canDelete={permissions.canDeleteReport}
                    onPreview={(d) => { setPreviewDoc(d); setPreviewOpen(true); }}
                    onEditNote={(d) => { setEditingNote(d); setNoteForm({ title: d.title, content: d.content ?? "" }); setNoteOpen(true); }}
                    onDelete={requestDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── REPORTS TAB ── */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-muted/30">
              <p className="text-sm font-medium text-foreground">Configure report</p>
              <p className="text-xs text-muted-foreground mt-0.5">Choose period and type to preview live data</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Period</Label>
                  <div className="flex gap-1.5">
                    {(["daily", "weekly", "monthly"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setReportPeriod(p)}
                        className={cn(
                          "flex-1 rounded-lg border py-2 text-xs font-medium transition-all cursor-pointer",
                          reportPeriod === p
                            ? "bg-foreground text-background border-foreground"
                            : "border-border text-muted-foreground bg-background hover:bg-muted"
                        )}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Report type</Label>
                  <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(REPORT_TYPE_CONFIG) as [ReportType, typeof REPORT_TYPE_CONFIG[ReportType]][]).map(([key, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              {cfg.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">{REPORT_TYPE_CONFIG[reportType].description}</p>
                </div>
              </div>
            </div>
          </div>
          <ReportPreview period={reportPeriod} type={reportType} />
        </div>
      )}

      {/* ── Preview dialog ── */}
      <PreviewDialog
        doc={previewDoc}
        open={previewOpen}
        onClose={() => { setPreviewOpen(false); setPreviewDoc(null); }}
      />

      {/* ── Note dialog ── */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{editingNote ? "Edit note" : "Add note"}</DialogTitle>
              <EditingPresenceIndicator editors={noteEditors} />
            </div>
          </DialogHeader>

          {noteLocked && (
            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
              Currently being edited by {noteLockedByName}.
            </div>
          )}
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                placeholder="Note title"
                value={noteForm.title}
                onChange={(e) => setNoteForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <Textarea
                placeholder="Write your note here..."
                value={noteForm.content}
                onChange={(e) => setNoteForm((f) => ({ ...f, content: e.target.value }))}
                rows={5}
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" className="cursor-pointer" onClick={() => { setNoteOpen(false); setEditingNote(null); }} disabled={noteSaving}>
                Cancel
              </Button>
              <Button className="cursor-pointer" onClick={handleNoteSubmit} disabled={noteSaving || noteLocked}>
                {noteSaving ? "Saving..." : editingNote ? "Update note" : "Add note"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        type={docs.find((d) => d.id === deleteDocId)?.type === "note" ? "note" : "document"}
        setOpen={setConfirmDeleteOpen}
        onConfirm={confirmDelete}
      />
    </div>
  );
}