import { NextRequest, NextResponse } from "next/server";
import { getState } from "@/lib/queries";
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
