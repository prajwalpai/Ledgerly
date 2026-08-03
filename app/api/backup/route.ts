import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { backupPath } from "@/lib/runtime-paths";
import { assertLocalRequest, safeApiError } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertLocalRequest(request);
    fs.mkdirSync(backupPath, { recursive: true, mode: 0o700 });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `ledgerly-${stamp}.sqlite3`;
    const destination = path.join(backupPath, filename);
    await getDatabase().backup(destination);
    fs.chmodSync(destination, 0o600);
    const manifest = { version: 1, createdAt: new Date().toISOString(), database: filename, includesDocuments: false };
    fs.writeFileSync(path.join(backupPath, `ledgerly-${stamp}.json`), JSON.stringify(manifest, null, 2), { mode: 0o600 });
    return NextResponse.json({ created: true, filename, includesDocuments: false });
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
