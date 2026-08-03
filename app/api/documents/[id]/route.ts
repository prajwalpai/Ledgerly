import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { deleteDocument, getDocumentFile } from "@/lib/documents";
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
