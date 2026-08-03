import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { assertLocalRequest, safeApiError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toolReady(tool: string, args: string[]) {
  try {
    execFileSync(tool, args, { stdio: "ignore", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function driveMounted() {
  try {
    const root = path.join(process.env.HOME ?? "", "Library", "CloudStorage");
    return fs.readdirSync(root, { withFileTypes: true }).some((entry) => entry.isDirectory() && entry.name.startsWith("GoogleDrive-"));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    assertLocalRequest(request);
    const database = getDatabase();
    database.prepare("SELECT 1").get();
    return NextResponse.json({
      status: "ready",
      database: true,
      ocr: { tesseract: toolReady("tesseract", ["--version"]), pdftotext: toolReady("pdftotext", ["-v"]), pdftoppm: toolReady("pdftoppm", ["-v"]) },
      googleDriveMounted: driveMounted(),
      schedulerConfigured: false,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ status: "error", error: response.message }, { status: response.status });
  }
}
