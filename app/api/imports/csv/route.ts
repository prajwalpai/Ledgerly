import { NextRequest, NextResponse } from "next/server";
import { importCsvRows } from "@/lib/csv-import";
import { assertLocalRequest, safeApiError } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertLocalRequest(request);
    return NextResponse.json(importCsvRows(await request.json()));
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ error: response.status === 500 ? "Check the CSV mapping and rows." : response.message }, { status: response.status === 500 ? 400 : response.status });
  }
}
