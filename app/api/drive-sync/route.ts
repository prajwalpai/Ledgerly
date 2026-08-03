import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { discoverDriveInbox, getDriveSyncMetadata, syncDriveInbox } from "@/lib/drive-sync";
import { assertLocalRequest, safeApiError } from "@/lib/security";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);

export async function GET(request: NextRequest) {
  try {
    assertLocalRequest(request);
    discoverDriveInbox();
    return NextResponse.json({ configured: true, folderName: "Ledgerly Financial Inbox", available: true, lastSync: getDriveSyncMetadata() });
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ configured: false, error: error instanceof Error ? error.message : response.message }, { status: 404 });
  }
}

export async function POST(request: NextRequest) {
  try {
    assertLocalRequest(request);
    const action = new URL(request.url).searchParams.get("action");
    if (action === "open") {
      await execFileAsync("/usr/bin/open", [discoverDriveInbox()], { timeout: 5000 });
      return NextResponse.json({ opened: true });
    }
    return NextResponse.json(await syncDriveInbox());
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : response.message }, { status: response.status });
  }
}
