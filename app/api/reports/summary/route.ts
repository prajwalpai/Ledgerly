import { NextRequest, NextResponse } from "next/server";
import { getDashboardSummary, getSelectedPeriod, type Period } from "@/lib/queries";
import { assertLocalRequest, safeApiError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const periods = new Set<Period>([
  "all-time", "this-month", "last-month", "last-3-months", "last-6-months", "this-year",
]);

export async function GET(request: NextRequest) {
  try {
    assertLocalRequest(request);
    const requested = request.nextUrl.searchParams.get("period") as Period | null;
    const period = requested && periods.has(requested) ? requested : getSelectedPeriod();
    return NextResponse.json(getDashboardSummary(period), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
