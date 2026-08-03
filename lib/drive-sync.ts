import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { getDatabase } from "@/lib/db";
import { dataRoot } from "@/lib/runtime-paths";
import { storeDocument } from "@/lib/documents";
import { parseStatement } from "@/lib/statement-import";

export type DriveSyncResult = {
  status: "complete" | "partial" | "already-running";
  stored: number;
  imported: number;
  duplicates: number;
  review: number;
  skipped: number;
  errors: string[];
  completedAt: string;
};

export function discoverDriveInbox() {
  if (process.env.LEDGERLY_DRIVE_INBOX) return path.resolve(process.env.LEDGERLY_DRIVE_INBOX);
  const cloud = path.join(os.homedir(), "Library", "CloudStorage");
  if (!fs.existsSync(cloud)) throw new Error("Google Drive for desktop is not mounted.");
  const matches: string[] = [];
  for (const root of fs.readdirSync(cloud, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name.startsWith("GoogleDrive-"))) {
    for (const driveName of ["My Drive", "MyDrive"]) {
      const candidate = path.join(cloud, root.name, driveName, "Ledgerly Financial Inbox");
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) matches.push(candidate);
    }
  }
  if (matches.length !== 1) throw new Error(matches.length ? "Multiple Ledgerly inboxes found." : "Ledgerly inbox is not synchronized yet.");
  return matches[0];
}

function readStableFile(filePath: string) {
  const handle = fs.openSync(filePath, "r");
  try {
    const before = fs.fstatSync(handle);
    const bytes = Buffer.alloc(before.size);
    const read = fs.readSync(handle, bytes, 0, before.size, 0);
    const after = fs.fstatSync(handle);
    if (read !== before.size || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      throw new Error("File is still synchronizing.");
    }
    return { bytes, stat: after };
  } finally {
    fs.closeSync(handle);
  }
}

function saveSetting(key: string, value: unknown) {
  const now = new Date().toISOString();
  getDatabase().prepare(`INSERT INTO settings(key,value,updatedAt) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updatedAt=excluded.updatedAt`)
    .run(key, JSON.stringify(value), now);
}

export function getDriveSyncMetadata() {
  const row = getDatabase().prepare("SELECT value FROM settings WHERE key = 'driveLastSync'").get() as { value: string } | undefined;
  if (!row) return null;
  try { return JSON.parse(row.value) as DriveSyncResult; } catch { return null; }
}

export async function syncDriveInbox(): Promise<DriveSyncResult> {
  const inbox = discoverDriveInbox();
  const lock = path.join(dataRoot, "drive-sync.lock");
  fs.mkdirSync(dataRoot, { recursive: true, mode: 0o700 });
  let lockHandle: number | undefined;
  const emptyResult = (): DriveSyncResult => ({
    status: "complete", stored: 0, imported: 0, duplicates: 0, review: 0,
    skipped: 0, errors: [], completedAt: new Date().toISOString(),
  });
  try {
    lockHandle = fs.openSync(lock, "wx", 0o600);
  } catch {
    return { ...emptyResult(), status: "already-running" };
  }
  const result = emptyResult();
  const database = getDatabase();
  try {
    const resetRow = database.prepare("SELECT value FROM settings WHERE key='driveResetAt'").get() as { value: string } | undefined;
    const resetAt = resetRow ? String(JSON.parse(resetRow.value)) : "";
    for (const entry of fs.readdirSync(inbox, { withFileTypes: true })) {
      if (!entry.isFile() || entry.name.startsWith(".") || entry.name.startsWith("~$") || entry.name.endsWith(".gdoc") || entry.name.endsWith(".gsheet")) continue;
      const fullPath = path.join(inbox, entry.name);
      try {
        const { bytes, stat } = readStableFile(fullPath);
        const modifiedAt = new Date(stat.mtimeMs).toISOString();
        if (!stat.size || stat.size > 20 * 1024 * 1024 || modifiedAt <= resetAt) { result.skipped += 1; continue; }
        const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
        const fileId = crypto.createHash("sha256").update(`${stat.dev}:${stat.ino}:${sha256}`).digest("hex");
        const prior = database.prepare("SELECT modifiedAt,status,sha256 FROM drive_files WHERE fileId=?").get(fileId) as { modifiedAt: string; status: string; sha256: string } | undefined;
        if (prior && prior.modifiedAt === modifiedAt && prior.sha256 === sha256 && ["stored", "review"].includes(prior.status)) { result.skipped += 1; continue; }

        const extension = path.extname(entry.name).toLowerCase();
        const mime = extension === ".txt" ? "text/plain" : extension === ".csv" ? "text/csv" : extension === ".xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : extension === ".xls" ? "application/vnd.ms-excel" : "";
        const file = new File([bytes], entry.name, { type: mime });
        const document = await storeDocument(file, null, { source: "google-drive", driveFileId: fileId, driveModifiedAt: modifiedAt });
        const statement = parseStatement(bytes, extension);
        let status = document.status;
        if (statement?.needsMapping) {
          status = "review";
          database.prepare("UPDATE documents SET status = 'review' WHERE id = ?").run(document.id);
          result.review += 1;
        } else if (statement) {
          result.imported += statement.inserted ?? 0;
          result.duplicates += statement.duplicates ?? 0;
          result.review += statement.needsReview ?? 0;
        } else if (document.status === "review") {
          result.review += 1;
        }
        database.prepare(`INSERT INTO drive_files(fileId,relativePath,modifiedAt,size,sha256,status,processedAt,lastError)
          VALUES(?,?,?,?,?,?,?,NULL) ON CONFLICT(fileId) DO UPDATE SET modifiedAt=excluded.modifiedAt,size=excluded.size,
          sha256=excluded.sha256,status=excluded.status,processedAt=excluded.processedAt,lastError=NULL`)
          .run(fileId, entry.name, modifiedAt, stat.size, sha256, status, new Date().toISOString());
        result.stored += 1;
      } catch (error) {
        result.status = "partial";
        result.errors.push(`${entry.name.slice(0, 80)}: ${error instanceof Error && error.message === "File is still synchronizing." ? error.message : "could not be imported"}`);
      }
    }
    result.completedAt = new Date().toISOString();
    saveSetting("driveInboxPath", inbox);
    saveSetting("driveLastSync", result);
    return result;
  } finally {
    if (lockHandle !== undefined) fs.closeSync(lockHandle);
    fs.rmSync(lock, { force: true });
  }
}
