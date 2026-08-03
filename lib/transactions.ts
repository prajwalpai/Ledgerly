import "server-only";

import crypto from "node:crypto";
import { z } from "zod";
import { getDatabase } from "@/lib/db";

const sourceSchema = z.enum(["manual", "csv", "document", "google-drive"]);

export const transactionInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  merchant: z.string().trim().min(1).max(180),
  amount: z.number().finite().positive().max(100_000_000),
  type: z.enum(["expense", "income"]),
  categoryId: z.string().uuid().optional().nullable(),
  category: z.string().trim().min(1).max(80).optional(),
  accountId: z.string().uuid().optional().nullable(),
  account: z.string().trim().min(1).max(80).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  receipt: z.boolean().default(false),
  source: sourceSchema.default("manual"),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export function transactionFingerprint(input: {
  date: string;
  merchant: string;
  amount: number;
  account: string;
}) {
  return `${input.date}|${normalizeName(input.merchant)}|${input.amount.toFixed(2)}|${normalizeName(input.account)}`;
}

function lookupDefinition(table: "categories" | "accounts", id?: string | null) {
  if (!id) return null;
  return getDatabase().prepare(`SELECT id, name FROM ${table} WHERE id = ?`).get(id) as
    | { id: string; name: string }
    | undefined;
}

function normalizedTags(tags: string[]) {
  const unique = new Map<string, string>();
  for (const tag of tags) {
    const name = tag.trim().replace(/\s+/g, " ");
    if (name) unique.set(normalizeName(name), name);
  }
  return [...unique.entries()].map(([normalizedName, name]) => ({ normalizedName, name }));
}

function ruleMatchText(value: string) {
  return value
    .replace(/^when\s+/i, "")
    .replace(/^(?:merchant|description|payee)\s+(?:contains|is|equals)\s+/i, "")
    .trim();
}

function applyImportRules(input: TransactionInput) {
  if (input.source === "manual") return input;
  const database = getDatabase();
  const rules = database.prepare("SELECT whenText, thenText FROM rules WHERE enabled = 1 ORDER BY createdAt")
    .all() as Array<{ whenText: string; thenText: string }>;
  let category = input.category;
  const tags = [...input.tags];
  const merchant = normalizeName(input.merchant);

  for (const rule of rules) {
    const needle = normalizeName(ruleMatchText(rule.whenText));
    if (!needle || !merchant.includes(needle)) continue;
    const categoryMatch = rule.thenText.match(/(?:set\s+)?category(?:\s+to|\s+is|:)?\s*[“”"']?([^,;]+?)[“”"']?(?=\s*(?:[,;]|$))/i);
    if (categoryMatch) {
      const requested = normalizeName(categoryMatch[1]);
      const found = database.prepare("SELECT name FROM categories WHERE normalizedName = ?").get(requested) as { name: string } | undefined;
      if (found) category = found.name;
    }
    for (const match of rule.thenText.matchAll(/(?:add\s+)?tag(?:\s+to|\s+is|:)?\s*[“”"']?([^,;]+?)[“”"']?(?=\s*(?:[,;]|$))/gi)) {
      const tag = match[1].trim();
      if (tag) tags.push(tag);
    }
  }
  return { ...input, category, tags };
}

export function insertTransactions(raw: unknown) {
  const candidateBatch = Array.isArray(raw) ? raw : [raw];
  if (candidateBatch.length === 0 || candidateBatch.length > 1000) {
    throw new Error("Transactions must contain between 1 and 1,000 entries.");
  }

  const database = getDatabase();
  const result = { inserted: 0, duplicates: 0, skipped: 0, needsReview: 0, rows: [] as unknown[], errors: [] as string[] };

  const run = database.transaction(() => {
    for (let index = 0; index < candidateBatch.length; index += 1) {
      const parsed = transactionInputSchema.safeParse(candidateBatch[index]);
      if (!parsed.success) {
        result.skipped += 1;
        result.errors.push(`Row ${index + 1} has invalid or missing fields.`);
        continue;
      }

      const originalInput = parsed.data;
      const originalAccount = lookupDefinition("accounts", originalInput.accountId);
      const originalAccountLabel = originalAccount?.name ?? originalInput.account ?? "Imported account";
      const fingerprint = transactionFingerprint({ ...originalInput, account: originalAccountLabel });

      // Duplicate identity is decided before rules, so a rule can never alter it.
      if (database.prepare("SELECT 1 FROM transactions WHERE fingerprint = ?").get(fingerprint)) {
        result.duplicates += 1;
        continue;
      }

      const input = applyImportRules(originalInput);
      const category = lookupDefinition("categories", input.categoryId);
      const account = lookupDefinition("accounts", input.accountId);
      const categoryLabel = category?.name ?? input.category ?? "Needs review";
      const accountLabel = account?.name ?? input.account ?? "Imported account";

      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      try {
        database.prepare(
          `INSERT INTO transactions
           (id, date, merchant, categoryId, categoryLabel, amountCents, type, accountId,
            accountLabel, receipt, source, fingerprint, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id, input.date, input.merchant, category?.id ?? null, categoryLabel,
          Math.round(input.amount * 100), input.type, account?.id ?? null, accountLabel,
          input.receipt ? 1 : 0, input.source, fingerprint, now, now,
        );

        for (const tag of normalizedTags(input.tags)) {
          const existing = database.prepare("SELECT id FROM tags WHERE normalizedName = ?").get(tag.normalizedName) as { id: string } | undefined;
          const tagId = existing?.id ?? crypto.randomUUID();
          if (!existing) {
            database.prepare("INSERT INTO tags (id, name, normalizedName, createdAt) VALUES (?, ?, ?, ?)")
              .run(tagId, tag.name, tag.normalizedName, now);
          }
          database.prepare("INSERT OR IGNORE INTO transaction_tags (transactionId, tagId) VALUES (?, ?)").run(id, tagId);
        }

        const row = database.prepare("SELECT * FROM transactions WHERE id = ?").get(id);
        result.rows.push(row);
        result.inserted += 1;
        if (categoryLabel === "Needs review") result.needsReview += 1;
      } catch (error) {
        if (error instanceof Error && error.message.includes("UNIQUE constraint failed: transactions.fingerprint")) {
          result.duplicates += 1;
        } else {
          throw error;
        }
      }
    }
  });

  run();
  return result;
}

export const transactionPatchSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
}).refine((value) => value.categoryId !== undefined || value.tags !== undefined, {
  message: "Provide a category or tags update.",
});

export function patchTransaction(id: string, raw: unknown) {
  const input = transactionPatchSchema.parse(raw);
  const database = getDatabase();
  const existing = database.prepare("SELECT id FROM transactions WHERE id = ?").get(id);
  if (!existing) return null;

  database.transaction(() => {
    if (input.categoryId !== undefined) {
      const category = lookupDefinition("categories", input.categoryId);
      if (!category) throw new Error("Choose an existing category.");
      database.prepare("UPDATE transactions SET categoryId = ?, categoryLabel = ?, updatedAt = ? WHERE id = ?")
        .run(category.id, category.name, new Date().toISOString(), id);
    }
    if (input.tags !== undefined) {
      database.prepare("DELETE FROM transaction_tags WHERE transactionId = ?").run(id);
      const now = new Date().toISOString();
      for (const tag of normalizedTags(input.tags)) {
        const found = database.prepare("SELECT id FROM tags WHERE normalizedName = ?").get(tag.normalizedName) as { id: string } | undefined;
        const tagId = found?.id ?? crypto.randomUUID();
        if (!found) database.prepare("INSERT INTO tags (id, name, normalizedName, createdAt) VALUES (?, ?, ?, ?)").run(tagId, tag.name, tag.normalizedName, now);
        database.prepare("INSERT INTO transaction_tags (transactionId, tagId) VALUES (?, ?)").run(id, tagId);
      }
      database.prepare("UPDATE transactions SET updatedAt = ? WHERE id = ?").run(now, id);
    }
  })();

  return database.prepare("SELECT * FROM transactions WHERE id = ?").get(id);
}

export function deleteTransaction(id: string) {
  return getDatabase().prepare("DELETE FROM transactions WHERE id = ?").run(id).changes > 0;
}
