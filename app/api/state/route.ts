import { NextRequest, NextResponse } from "next/server";
import { getState } from "@/lib/queries";
import fs from "node:fs";
import crypto from "node:crypto";
import { getDatabase } from "@/lib/db";
import { starterAccounts, starterCategories } from "@/lib/db/schema";
import { vaultPath } from "@/lib/runtime-paths";
import { assertLocalRequest, safeApiError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    assertLocalRequest(request);
    return NextResponse.json(getState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertLocalRequest(request);
    const body = await request.json();
    if (body?.confirmation !== "DELETE ALL LEDGERLY DATA") return NextResponse.json({ error: "The confirmation value is incorrect." }, { status: 400 });
    const database = getDatabase(); const now = new Date().toISOString();
    const preserved = database.prepare("SELECT key,value FROM settings WHERE key IN ('driveInboxPath','driveSchedule','driveTimezone')").all() as Array<{key:string;value:string}>;
    const failures: string[] = [];
    try { fs.rmSync(vaultPath, { recursive: true, force: true }); fs.mkdirSync(vaultPath, { recursive: true, mode: 0o700 }); } catch { failures.push("Some stored document files could not be removed."); }
    database.transaction(() => {
      for (const table of ["transaction_tags","transactions","documents","rules","tags","goals","budgets","subscriptions","recurring_entries","dismissed_patterns","drive_files","categories","accounts","settings"]) database.prepare(`DELETE FROM ${table}`).run();
      const category = database.prepare("INSERT INTO categories(id,name,normalizedName,createdAt) VALUES(?,?,?,?)");
      const account = database.prepare("INSERT INTO accounts(id,name,normalizedName,createdAt) VALUES(?,?,?,?)");
      for(const name of starterCategories) category.run(crypto.randomUUID(),name,name.toLowerCase(),now);
      for(const name of starterAccounts) account.run(crypto.randomUUID(),name,name.toLowerCase(),now);
      const setting=database.prepare("INSERT INTO settings(key,value,updatedAt) VALUES(?,?,?)");
      for(const row of preserved) setting.run(row.key,row.value,now);
      setting.run("selectedPeriod",JSON.stringify("all-time"),now);setting.run("assetsCents","0",now);setting.run("liabilitiesCents","0",now);setting.run("netWorthConfigured","false",now);setting.run("freshStart","true",now);setting.run("driveResetAt",JSON.stringify(now),now);
    })();
    return NextResponse.json({ deleted: true, driveResetAt: now, warnings: failures, complete: failures.length === 0 });
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
