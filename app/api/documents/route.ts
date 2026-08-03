import { NextRequest, NextResponse } from "next/server";
import { storeDocument } from "@/lib/documents";
import { assertLocalRequest, safeApiError } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertLocalRequest(request);
    const form = await request.formData();
    const files = form.getAll("files").filter((value): value is File => value instanceof File);
    if (!files.length || files.length > 20) return NextResponse.json({ error: "Choose between 1 and 20 files." }, { status: 400 });
    const transactionId = typeof form.get("transactionId") === "string" ? String(form.get("transactionId")) : null;
    const documents = [];
    const errors: Array<{ filename: string; error: string }> = [];
    for (const file of files) {
      try { documents.push(await storeDocument(file, transactionId)); }
      catch (error) { errors.push({ filename: file.name, error: error instanceof Error ? error.message : "Upload failed." }); }
    }
    return NextResponse.json({ documents, errors, status: errors.length ? "partial" : "complete" }, { status: documents.length ? 201 : 400 });
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
