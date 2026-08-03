import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { deleteDocument, getDocumentFile } from "@/lib/documents";
import { getDatabase } from "@/lib/db";
import { insertTransactions } from "@/lib/transactions";
import { assertLocalRequest, safeApiError } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request);
    const file = getDocumentFile((await context.params).id);
    if (!file || !fs.existsSync(file.path)) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    const body = fs.readFileSync(file.path);
    const filename = file.filename.replace(/["\r\n]/g, "");
    return new NextResponse(body, { headers: { "Content-Type": file.mimeType, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request);
    if (!deleteDocument((await context.params).id)) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertLocalRequest(request);
    const { id } = await context.params;
    const database = getDatabase();
    const document = database.prepare("SELECT id, transactionId FROM documents WHERE id = ?").get(id) as { id: string; transactionId: string | null } | undefined;
    if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    const body = await request.json();
    if (body?.statementReviewed === true) {
      database.prepare("UPDATE documents SET status = 'stored', extractionJson = NULL WHERE id = ?").run(id);
      return NextResponse.json({ reviewed: true });
    }
    if (document.transactionId) return NextResponse.json({ error: "This document is already linked to a transaction." }, { status: 409 });
    const result = insertTransactions({ ...body, receipt: true, source: "document" });
    if (!result.inserted) return NextResponse.json({ error: result.duplicates ? "That transaction already exists." : result.errors[0] ?? "The transaction could not be created.", result }, { status: 409 });
    const transactionId = (result.rows[0] as { id: string }).id;
    database.prepare("UPDATE documents SET transactionId = ?, status = 'stored', extractionJson = NULL WHERE id = ?").run(transactionId, id);
    return NextResponse.json({ transactionId, result });
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ error: response.status === 500 ? "Check the reviewed fields." : response.message }, { status: response.status === 500 ? 400 : response.status });
  }
}
