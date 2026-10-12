"use client";
import { FileText, FileSpreadsheet, Image as ImageIcon, Film, File as FileIcon } from "lucide-react";
import { formatBytes, getPreviewKind } from "@/lib/file-preview";

export function AttachmentCard({
  name, mime, size, isOwn, onOpen,
}: { name: string; mime?: string | null; size?: number | null; isOwn: boolean; onOpen: () => void }) {
  const kind = getPreviewKind(name, mime);
  const Icon =
    kind === "image" ? ImageIcon : kind === "sheet" ? FileSpreadsheet :
    kind === "video" || kind === "audio" ? Film :
    kind === "pdf" || kind === "docx" || kind === "text" ? FileText : FileIcon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full min-w-[200px] items-center gap-2.5 rounded-xl border px-3 py-2 text-left cursor-pointer ${
        isOwn ? "border-primary-foreground/30 bg-primary-foreground/10" : "border-border bg-background/60"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{name}</p>
        <p className="text-[10px] opacity-70">
          {formatBytes(size)}{kind !== "none" ? " · Tap to preview" : " · Tap to open"}
        </p>
      </div>
    </button>
  );
}