import "server-only";

import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { insertTransactions, normalizeName } from "@/lib/transactions";

const mappingSchema = z.object({
  date: z.string().min(1),
  merchant: z.string().min(1),
  amount: z.string().optional(),
  debit: z.string().optional(),
  credit: z.string().optional(),
  category: z.string().optional(),
  account: z.string().optional(),
  dateFormat: z.enum(["iso", "mdy", "dmy"]),
  amountConvention: z.enum(["negative-expense", "positive-expense"]).default("negative-expense"),
}).refine((value) => value.amount || value.debit || value.credit, "Map an amount column or debit/credit columns.");

const requestSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
  mapping: mappingSchema,
  fallbackAccount: z.string().trim().min(1).max(80).default("Imported account"),
  source: z.enum(["csv", "google-drive"]).default("csv"),
  defaultTags: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
});

function cell(row: Record<string, unknown>, key?: string) {
  if (!key) return "";
  const value = row[key];
  return value == null ? "" : String(value).trim();
}

function amountValue(raw: string) {
  if (!raw) return null;
  const negativeParentheses = /^\(.*\)$/.test(raw.trim());
  const cleaned = raw.replace(/[,$£€₹\s()]/g, "");
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return negativeParentheses ? -Math.abs(value) : value;
}

function normalizeDate(raw: string, format: "iso" | "mdy" | "dmy") {
  const match = raw.trim().match(/^(\d{1,4})[\-/.](\d{1,2})[\-/.](\d{1,4})/);
  if (!match) return null;
  let year: number; let month: number; let day: number;
  if (format === "iso") [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if (format === "mdy") [month, day, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function importCsvRows(raw: unknown) {
  const input = requestSchema.parse(raw);
  const database = getDatabase();
  const categories = new Map((database.prepare("SELECT name, normalizedName FROM categories").all() as Array<{ name: string; normalizedName: string }>).map((row) => [row.normalizedName, row.name]));
  const accounts = new Map((database.prepare("SELECT name, normalizedName FROM accounts").all() as Array<{ name: string; normalizedName: string }>).map((row) => [row.normalizedName, row.name]));
  const candidates = [];
  let skipped = 0;

  for (const row of input.rows) {
    const date = normalizeDate(cell(row, input.mapping.date), input.mapping.dateFormat);
    const merchant = cell(row, input.mapping.merchant);
    let type: "expense" | "income" | null = null;
    let amount: number | null = null;
    const debit = amountValue(cell(row, input.mapping.debit));
    const credit = amountValue(cell(row, input.mapping.credit));
    if (debit != null && debit !== 0) { type = "expense"; amount = Math.abs(debit); }
    else if (credit != null && credit !== 0) { type = "income"; amount = Math.abs(credit); }
    else {
      const signed = amountValue(cell(row, input.mapping.amount));
      if (signed != null && signed !== 0) {
        const positiveIsExpense = input.mapping.amountConvention === "positive-expense";
        type = (signed > 0) === positiveIsExpense ? "expense" : "income";
        amount = Math.abs(signed);
      }
    }
    if (!date || !merchant || !type || !amount) { skipped += 1; continue; }
    const rawCategory = cell(row, input.mapping.category);
    const category = categories.get(normalizeName(rawCategory)) ?? "Needs review";
    const rawAccount = cell(row, input.mapping.account);
    const account = accounts.get(normalizeName(rawAccount)) ?? (rawAccount || input.fallbackAccount);
    candidates.push({ date, merchant, amount, type, category, account, tags: input.defaultTags, receipt: false, source: input.source });
  }
  if (!candidates.length) return { inserted: 0, duplicates: 0, skipped, needsReview: 0, rows: [], errors: ["No valid transaction rows were found."] };
  const result = insertTransactions(candidates);
  return { ...result, skipped: result.skipped + skipped };
}
