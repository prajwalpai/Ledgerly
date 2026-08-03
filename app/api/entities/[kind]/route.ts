import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { assertLocalRequest, safeApiError } from "@/lib/security";

export const runtime = "nodejs";

const cadence = z.enum(["weekly", "biweekly", "monthly", "quarterly", "annual"]);
const schemas = {
  goals: z.object({ name: z.string().trim().min(1).max(120), targetCents: z.number().int().positive(), currentCents: z.number().int().nonnegative().default(0), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), note: z.string().trim().max(500).nullable().optional() }),
  budgets: z.object({ categoryId: z.string().uuid(), monthlyLimitCents: z.number().int().positive(), active: z.boolean().default(true) }),
  subscriptions: z.object({ serviceName: z.string().trim().min(1).max(120), categoryId: z.string().uuid(), amountCents: z.number().int().positive(), cadence, nextRenewalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), accountId: z.string().uuid().nullable().optional(), active: z.boolean().default(true) }),
  recurring: z.object({ name: z.string().trim().min(1).max(120), categoryId: z.string().uuid(), amountCents: z.number().int().positive(), cadence, nextDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), accountId: z.string().uuid().nullable().optional(), active: z.boolean().default(true) }),
  rules: z.object({ whenText: z.string().trim().min(1).max(240), thenText: z.string().trim().min(1).max(240), enabled: z.boolean().default(true) }),
} as const;

type Kind = keyof typeof schemas;
function kindOf(raw: string): Kind | null { return raw in schemas ? raw as Kind : null; }
function definition(table: "categories" | "accounts", id?: string | null) {
  if (!id) return null;
  return getDatabase().prepare(`SELECT id, name FROM ${table} WHERE id = ?`).get(id) as { id: string; name: string } | undefined;
}

function save(kind: Kind, raw: unknown, id?: string) {
  const input = schemas[kind].parse(raw) as Record<string, unknown>;
  const database = getDatabase(); const now = new Date().toISOString(); const entityId = id ?? crypto.randomUUID();
  const category = "categoryId" in input ? definition("categories", String(input.categoryId)) : null;
  const account = "accountId" in input && input.accountId ? definition("accounts", String(input.accountId)) : null;
  if ("categoryId" in input && !category) throw new Error("Choose an existing category.");
  if (input.accountId && !account) throw new Error("Choose an existing account.");

  if (kind === "goals") database.prepare(`INSERT INTO goals (id,name,targetCents,currentCents,dueDate,note,createdAt,updatedAt) VALUES (@id,@name,@targetCents,@currentCents,@dueDate,@note,@now,@now) ON CONFLICT(id) DO UPDATE SET name=@name,targetCents=@targetCents,currentCents=@currentCents,dueDate=@dueDate,note=@note,updatedAt=@now`).run({ id: entityId, now, ...input, dueDate: input.dueDate ?? null, note: input.note ?? null });
  if (kind === "budgets") database.prepare(`INSERT INTO budgets (id,categoryId,categoryLabel,monthlyLimitCents,active,createdAt,updatedAt) VALUES (@id,@categoryId,@categoryLabel,@monthlyLimitCents,@active,@now,@now) ON CONFLICT(id) DO UPDATE SET categoryId=@categoryId,categoryLabel=@categoryLabel,monthlyLimitCents=@monthlyLimitCents,active=@active,updatedAt=@now`).run({ id: entityId, now, ...input, active: input.active ? 1 : 0, categoryLabel: category!.name });
  if (kind === "rules") database.prepare(`INSERT INTO rules (id,whenText,thenText,enabled,createdAt,updatedAt) VALUES (@id,@whenText,@thenText,@enabled,@now,@now) ON CONFLICT(id) DO UPDATE SET whenText=@whenText,thenText=@thenText,enabled=@enabled,updatedAt=@now`).run({ id: entityId, now, ...input, enabled: input.enabled ? 1 : 0 });
  if (kind === "subscriptions") database.prepare(`INSERT INTO subscriptions (id,serviceName,categoryId,categoryLabel,amountCents,cadence,nextRenewalDate,accountId,accountLabel,active,createdAt,updatedAt) VALUES (@id,@serviceName,@categoryId,@categoryLabel,@amountCents,@cadence,@nextRenewalDate,@accountId,@accountLabel,@active,@now,@now) ON CONFLICT(id) DO UPDATE SET serviceName=@serviceName,categoryId=@categoryId,categoryLabel=@categoryLabel,amountCents=@amountCents,cadence=@cadence,nextRenewalDate=@nextRenewalDate,accountId=@accountId,accountLabel=@accountLabel,active=@active,updatedAt=@now`).run({ id: entityId, now, ...input, accountId: account?.id ?? null, accountLabel: account?.name ?? null, categoryLabel: category!.name, active: input.active ? 1 : 0 });
  if (kind === "recurring") database.prepare(`INSERT INTO recurring_entries (id,name,categoryId,categoryLabel,amountCents,cadence,nextDate,accountId,accountLabel,active,createdAt,updatedAt) VALUES (@id,@name,@categoryId,@categoryLabel,@amountCents,@cadence,@nextDate,@accountId,@accountLabel,@active,@now,@now) ON CONFLICT(id) DO UPDATE SET name=@name,categoryId=@categoryId,categoryLabel=@categoryLabel,amountCents=@amountCents,cadence=@cadence,nextDate=@nextDate,accountId=@accountId,accountLabel=@accountLabel,active=@active,updatedAt=@now`).run({ id: entityId, now, ...input, accountId: account?.id ?? null, accountLabel: account?.name ?? null, categoryLabel: category!.name, active: input.active ? 1 : 0 });
  const table = kind === "recurring" ? "recurring_entries" : kind;
  return database.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(entityId);
}

export async function POST(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try { assertLocalRequest(request); const kind = kindOf((await context.params).kind); if (!kind) return NextResponse.json({ error: "Unknown entity type." }, { status: 404 }); return NextResponse.json({ item: save(kind, await request.json()) }, { status: 201 }); }
  catch (error) { const response = safeApiError(error); return NextResponse.json({ error: response.status === 500 && error instanceof Error ? error.message : response.message }, { status: response.status === 500 ? 400 : response.status }); }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try { assertLocalRequest(request); const kind = kindOf((await context.params).kind); if (!kind) return NextResponse.json({ error: "Unknown entity type." }, { status: 404 }); const body = await request.json(); if (typeof body.id !== "string") return NextResponse.json({ error: "Entity ID required." }, { status: 400 }); return NextResponse.json({ item: save(kind, body, body.id) }); }
  catch (error) { const response = safeApiError(error); return NextResponse.json({ error: response.status === 500 && error instanceof Error ? error.message : response.message }, { status: response.status === 500 ? 400 : response.status }); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try { assertLocalRequest(request); const kind = kindOf((await context.params).kind); if (!kind) return NextResponse.json({ error: "Unknown entity type." }, { status: 404 }); const id = request.nextUrl.searchParams.get("id"); if (!id) return NextResponse.json({ error: "Entity ID required." }, { status: 400 }); const table = kind === "recurring" ? "recurring_entries" : kind; const changed = getDatabase().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes; return changed ? NextResponse.json({ deleted: true }) : NextResponse.json({ error: "Entity not found." }, { status: 404 }); }
  catch (error) { const response = safeApiError(error); return NextResponse.json({ error: response.message }, { status: response.status }); }
}
