"use client";
import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { formatBytes, getPreviewKind, type PreviewFile } from "@/lib/file-preview";

const MAX_ROWS = 500, MAX_COLS = 30, MAX_TEXT = 500_000;

type Loaded =
  | { kind: "image" | "pdf" | "video" | "audio" | "none" }
  | { kind: "text"; text: string }
  | { kind: "docx"; html: string }
  | { kind: "sheet"; sheets: { name: string; rows: string[][] }[] };

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">{children}</div>
);

export function FilePreviewDialog({
  file,
  onOpenChange,
}: {
  file: PreviewFile | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let url: string | null = null;
    setObjectUrl(null); setData(null); setError(null); setActiveSheet(0);

    (async () => {
      try {
        const res = await authClient.request(file.url, { method: "GET", responseType: "blob" });
        const blob: Blob = res.data;
        url = URL.createObjectURL(blob);
        const kind = getPreviewKind(file.name, file.mime);
        let loaded: Loaded;

        if (kind === "text") {
          loaded = { kind, text: await blob.slice(0, MAX_TEXT).text() };
        } else if (kind === "docx") {
          const mammoth = await import("mammoth");
          const DOMPurify = (await import("dompurify")).default;
          const { value } = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
          loaded = { kind, html: DOMPurify.sanitize(value) };
        } else if (kind === "sheet") {
          const XLSX = await import("xlsx");
          const wb = XLSX.read(await blob.arrayBuffer(), { type: "array" });
          loaded = {
            kind,
            sheets: wb.SheetNames.map((name) => ({
              name,
              rows: (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "" }) as string[][])
                .slice(0, MAX_ROWS)
                .map((r) => r.slice(0, MAX_COLS)),
            })),
          };
        } else {
          loaded = { kind };
        }

        if (cancelled) { URL.revokeObjectURL(url); return; }
        setObjectUrl(url);
        setData(loaded);
      } catch {
        if (!cancelled) setError("Couldn't load this file.");
      }
    })();

    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [file]);

  return (
    <Dialog open={!!file} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[95vw] flex-col gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="flex-row items-center justify-between gap-3 border-b px-4 py-3 pr-12">
          <div className="min-w-0">
            <DialogTitle className="truncate text-sm">{file?.name}</DialogTitle>
            <DialogDescription className="text-xs">{formatBytes(file?.size)}</DialogDescription>
          </div>
          {objectUrl && file && (
            <Button asChild size="sm" variant="outline" className="cursor-pointer hover:text-gray-600">
              <a href={objectUrl} download={file.name}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download
              </a>
            </Button>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto bg-muted/30">
          {error ? (
            <Centered>{error}</Centered>
          ) : !data || !objectUrl || !file ? (
            <Centered><Loader2 className="h-5 w-5 animate-spin text-primary" /></Centered>
          ) : data.kind === "image" ? (
            <div className="flex h-full items-center justify-center p-4">
              <img src={objectUrl} alt={file.name} className="max-h-full max-w-full object-contain" />
            </div>
          ) : data.kind === "pdf" ? (
            <iframe src={objectUrl} title={file.name} className="h-full w-full border-0" />
          ) : data.kind === "video" ? (
            <div className="flex h-full items-center justify-center p-4">
              <video src={objectUrl} controls className="max-h-full max-w-full" />
            </div>
          ) : data.kind === "audio" ? (
            <div className="flex h-full items-center justify-center p-6"><audio src={objectUrl} controls /></div>
          ) : data.kind === "text" ? (
            <pre className="whitespace-pre-wrap break-words p-4 text-xs">{data.text}</pre>
          ) : data.kind === "docx" ? (
            <div
              className="mx-auto max-w-3xl bg-background p-6 text-sm [&_p]:mb-3 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_table]:border-collapse [&_img]:max-w-full"
              dangerouslySetInnerHTML={{ __html: data.html }}
            />
          ) : data.kind === "sheet" ? (
            <div className="flex h-full flex-col">
              {data.sheets.length > 1 && (
                <div className="flex gap-1 overflow-x-auto border-b bg-background px-2 py-1">
                  {data.sheets.map((s, i) => (
                    <button
                      key={s.name}
                      onClick={() => setActiveSheet(i)}
                      className={cn("rounded px-2 py-1 text-xs", i === activeSheet ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-auto bg-background">
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {data.sheets[activeSheet]?.rows.map((row, r) => (
                      <tr key={r} className={r === 0 ? "bg-muted font-medium" : ""}>
                        {row.map((c, i) => (
                          <td key={i} className="whitespace-nowrap border px-2 py-1">{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <Centered>No preview for this file type. Use Download to open it.</Centered>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}