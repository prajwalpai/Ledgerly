import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { normalizeName } from "@/lib/transactions";
import { assertLocalRequest, safeApiError } from "@/lib/security";

export const runtime = "nodejs";

const kinds = { categories: "categories", accounts: "accounts", tags: "tags" } as const;
const inputSchema = z.object({ name: z.string().trim().min(1).max(80) });

function tableFor(kind: string) {
  if (!(kind in kinds)) return null;
  return kinds[kind as keyof typeof kinds];
}

export async function POST(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try {
    assertLocalRequest(request);
    const table = tableFor((await context.params).kind);
    if (!table) return NextResponse.json({ error: "Unknown definition type." }, { status: 404 });
    const { name } = inputSchema.parse(await request.json());
    const normalized = normalizeName(name);
    const database = getDatabase();
    const existing = database.prepare(`SELECT id, name FROM ${table} WHERE normalizedName = ?`).get(normalized);
    if (existing) return NextResponse.json({ error: "That name already exists." }, { status: 409 });
    const item = { id: crypto.randomUUID(), name: name.replace(/\s+/g, " ") };
    database.prepare(`INSERT INTO ${table} (id, name, normalizedName, createdAt) VALUES (?, ?, ?, ?)`)
      .run(item.id, item.name, normalized, new Date().toISOString());
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ error: response.status === 500 ? "Enter a valid name." : response.message }, { status: response.status === 500 ? 400 : response.status });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try {
    assertLocalRequest(request);
    const table = tableFor((await context.params).kind);
    if (!table) return NextResponse.json({ error: "Unknown definition type." }, { status: 404 });
    const id = request.nextUrl.searchParams.get("id");
    const stripHistorical = request.nextUrl.searchParams.get("stripHistorical") === "true";
    if (!id) return NextResponse.json({ error: "A definition ID is required." }, { status: 400 });
    const database = getDatabase();
    const found = database.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
    if (!found) return NextResponse.json({ error: "Definition not found." }, { status: 404 });

    if (table === "tags") {
      const usage = database.prepare("SELECT COUNT(*) AS count FROM transaction_tags WHERE tagId = ?").get(id) as { count: number };
      if (usage.count > 0 && !stripHistorical) {
        return NextResponse.json({ error: "This tag is used by historical transactions.", usageCount: usage.count, confirmationRequired: true }, { status: 409 });
      }
    }
    database.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const response = safeApiError(error);
    return NextResponse.json({ error: response.message }, { status: response.status });
  }
}
