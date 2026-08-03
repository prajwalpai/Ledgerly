import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { assertLocalRequest, safeApiError } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  selectedPeriod: z.enum(["all-time", "this-month", "last-month", "last-3-months", "last-6-months", "this-year"]).optional(),
  assetsCents: z.number().int().nonnegative().optional(),
  liabilitiesCents: z.number().int().nonnegative().optional(),
  netWorthConfigured: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "No preference was provided.");

export async function PUT(request: NextRequest) {
  try {
    assertLocalRequest(request);
    const input = schema.parse(await request.json());
    const database = getDatabase();
    const now = new Date().toISOString();
    const save = database.prepare(
      `INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    );
    database.transaction(() => {
      for (const [key, value] of Object.entries(input)) save.run(key, JSON.stringify(value), now);
    })();
    return NextResponse.json({ saved: input });
  } catch (error) {
    const response = safeApiError(error);
    const isInputError = error instanceof Error && response.status === 500;
    return NextResponse.json({ error: isInputError ? "Check the preference values and try again." : response.message }, { status: isInputError ? 400 : response.status });
  }
}
