import { NextRequest, NextResponse } from "next/server";
import { deleteTransaction, patchTransaction } from "@/lib/transactions";
import { assertLocalRequest, safeApiError } from "@/lib/security";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request);
    const { id } = await context.params;
    const row = patchTransaction(id, await request.json());
    if (!row) return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    return NextResponse.json({ transaction: row });
  } catch (error) {
    const response = safeApiError(error);
    const isInputError = error instanceof Error && response.status === 500;
    return NextResponse.json({ error: isInputError ? error.message : response.message }, { status: isInputError ? 400 : response.status });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request);
    const { id } = await context.params;
    if (!deleteTransaction(id)) return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
