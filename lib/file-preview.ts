export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const BLOCKED_EXT = new Set(["exe","msi","bat","cmd","com","scr","sh","ps1","vbs","jar","apk","dll","app","dmg"]);

export const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

export function validateUpload(file: { name: string; size: number }): string | null {
  if (file.size === 0) return "File is empty";
  if (file.size > MAX_UPLOAD_BYTES) return "File size cannot exceed 4 MB";
  if (BLOCKED_EXT.has(extOf(file.name))) return "This file type isn't allowed";
  return null;
}

export interface PreviewFile { url: string; name: string; mime?: string | null; size?: number | null }
export type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "docx" | "sheet" | "none";

const TEXT_EXT = ["txt","md","json","log","xml","yml","yaml","ini","html","css","js","ts","tsx","py","sql"];

export function getPreviewKind(name: string, mime?: string | null): PreviewKind {
  const ext = extOf(name);
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/") || ["png","jpg","jpeg","gif","webp","avif","bmp","svg"].includes(ext)) return "image";
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (m.startsWith("video/") || ["mp4","webm","mov"].includes(ext)) return "video";
  if (m.startsWith("audio/") || ["mp3","wav","ogg","m4a"].includes(ext)) return "audio";
  if (ext === "docx") return "docx";
  if (["xlsx","xls","csv"].includes(ext)) return "sheet";
  if (m.startsWith("text/") || TEXT_EXT.includes(ext)) return "text";
  return "none"; // .doc, .ppt(x), zip, etc. → download only
}

export const formatBytes = (n?: number | null) => 
    n == null ? "" : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;