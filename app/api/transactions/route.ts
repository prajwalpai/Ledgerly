import { NextRequest, NextResponse } from "next/server";
import { insertTransactions } from "@/lib/transactions";
import { assertLocalRequest, safeApiError } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertLocalRequest(request);
    const body = await request.json();
    return NextResponse.json(insertTransactions(body), { status: 201 });
  } catch (error) {
    const response = safeApiError(error);
    const isInputError = error instanceof Error && response.status === 500;
    return NextResponse.json(
      { error: isInputError ? error.message : response.message },
      { status: isInputError ? 400 : response.status },
    );
  }
}
