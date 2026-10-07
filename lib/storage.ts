import { put, del, list } from "@vercel/blob";
import { writeFile, mkdir, unlink, rm } from "fs/promises";
import path from "path";

const DRIVER = process.env.STORAGE_DRIVER === "blob" ? "blob" : "local";
export const MAX_FILE_SIZE = 4 * 1024 * 1024;

const LOCAL_PREFIX = "/uploads/";
const BLOB_PREFIX = "/api/files/";
const LOCAL_ROOT = path.join(process.cwd(), "public", "uploads");

export async function saveFile(
  pathname: string,
  file: File
): Promise<{ url: string }> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size cannot exceed 4 MB");
  }

  if (DRIVER === "blob") {
    const blob = await put(pathname, file, {
      access: "private",
      addRandomSuffix: false,
      contentType: file.type || undefined,
    });

    return { url: `${BLOB_PREFIX}${blob.pathname}` };
  }

  const fullPath = path.join(LOCAL_ROOT, pathname);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, Buffer.from(await file.arrayBuffer()));

  return { url: `${LOCAL_PREFIX}${pathname}` };
}

export async function deleteFile(url: string | null | undefined) {
  if (!url) return;
  try {
    if (url.startsWith(BLOB_PREFIX)) {
      await del(url.slice(BLOB_PREFIX.length));
    } else if (url.startsWith(LOCAL_PREFIX)) {
      await unlink(path.join(LOCAL_ROOT, url.slice(LOCAL_PREFIX.length)));
    }
  } catch {
    console.warn(`[storage] could not delete ${url}`);
  }
}

export async function deletePlanFiles(planId: string) {
  try {
    if (DRIVER === "blob") {
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: `${planId}/`, cursor });
        if (page.blobs.length) await del(page.blobs.map((b) => b.url));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
    } else {
      await rm(path.join(LOCAL_ROOT, planId), { recursive: true, force: true });
    }
  } catch {
    console.warn(`[storage] could not clean up files for plan ${planId}`);
  }
}