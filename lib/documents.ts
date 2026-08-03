import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileTypeFromBuffer } from "file-type";
import { getDatabase } from "@/lib/db";
import { vaultPath } from "@/lib/runtime-paths";

const maxFileSize = 20 * 1024 * 1024;
const allowedMime = new Set([
  "text/csv", "text/plain", "application/pdf",
  "image/jpeg", "image/png", "image/webp", "image/tiff",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function safeFilename(filename: string) {
  const extension = path.extname(filename).slice(0, 12).replace(/[^a-zA-Z0-9.]/g, "");
  const base = path.basename(filename, path.extname(filename)).normalize("NFKC")
    .replace(/[^a-zA-Z0-9 _.-]/g, "").replace(/\s+/g, "-").replace(/\.{2,}/g, ".").slice(0, 90);
  return `${base || "document"}${extension.toLowerCase()}`;
}

function resolveVaultKey(vaultKey: string) {
  const resolved = path.resolve(vaultPath, vaultKey);
  if (!resolved.startsWith(`${path.resolve(vaultPath)}${path.sep}`)) throw new Error("INVALID_VAULT_KEY");
  return resolved;
}

function extractText(filePath: string, mimeType: string) {
  try {
    if (mimeType === "application/pdf") {
      return execFileSync("pdftotext", ["-f", "1", "-l", "10", "-layout", filePath, "-"], { encoding: "utf8", timeout: 15_000, maxBuffer: 2 * 1024 * 1024 }).slice(0, 200_000);
    }
    if (mimeType.startsWith("image/")) {
      return execFileSync("tesseract", [filePath, "stdout", "--psm", "6"], { encoding: "utf8", timeout: 25_000, maxBuffer: 2 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).slice(0, 200_000);
    }
    return "";
  } catch {
    return "";
  }
}

function extractionSummary(text: string) {
  if (!text.trim()) return null;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const date = text.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.]([0-2]?\d|3[01])\b/)?.[0] ?? null;
  const amounts = [...text.matchAll(/(?:USD|\$)\s*([0-9]{1,7}(?:,[0-9]{3})*(?:\.\d{2}))/gi)].map((match) => match[1]);
  return { merchantCandidate: lines[0]?.slice(0, 120) ?? null, dateCandidate: date, totalCandidate: amounts.at(-1) ?? null, textDetected: true };
}

export async function storeDocument(file: File, transactionId?: string | null) {
  if (!file.size || file.size > maxFileSize) throw new Error("Files must be between 1 byte and 20 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(bytes);
  const mimeType = detected?.mime ?? (file.type || "application/octet-stream");
  if (!allowedMime.has(mimeType)) throw new Error("That file type is not supported.");

  const id = crypto.randomUUID();
  const filename = safeFilename(file.name);
  const vaultKey = path.join("uploads", `${id}-${filename}`);
  const destination = resolveVaultKey(vaultKey);
  fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  const temporary = `${destination}.uploading`;
  fs.writeFileSync(temporary, bytes, { mode: 0o600, flag: "wx" });
  fs.renameSync(temporary, destination);

  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const extractedText = extractText(destination, mimeType);
  const extraction = extractionSummary(extractedText);
  const status = extraction ? "review" : "stored";
  const now = new Date().toISOString();
  try {
    getDatabase().prepare(
      `INSERT INTO documents (id, filename, mimeType, size, vaultKey, sha256, status, source, transactionId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'upload', ?, ?)`,
    ).run(id, file.name.slice(0, 255), mimeType, bytes.length, vaultKey, sha256, status, transactionId ?? null, now);
  } catch (error) {
    fs.rmSync(destination, { force: true });
    throw error;
  }
  return { id, filename: file.name.slice(0, 255), mimeType, size: bytes.length, status, source: "upload", createdAt: now, extraction };
}

export function getDocumentFile(id: string) {
  const row = getDatabase().prepare("SELECT filename, mimeType, vaultKey FROM documents WHERE id = ?").get(id) as { filename: string; mimeType: string; vaultKey: string } | undefined;
  if (!row) return null;
  return { ...row, path: resolveVaultKey(row.vaultKey) };
}

export function deleteDocument(id: string) {
  const database = getDatabase();
  const row = database.prepare("SELECT vaultKey FROM documents WHERE id = ?").get(id) as { vaultKey: string } | undefined;
  if (!row) return false;
  const filePath = resolveVaultKey(row.vaultKey);
  if (fs.existsSync(filePath)) fs.rmSync(filePath);
  database.prepare("DELETE FROM documents WHERE id = ?").run(id);
  return true;
}
