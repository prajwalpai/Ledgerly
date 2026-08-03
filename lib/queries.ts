import "server-only";

import { getDatabase } from "@/lib/db";
import { detectRecurringPatterns } from "@/lib/recurring-detection";

export type Period =
  | "all-time"
  | "this-month"
  | "last-month"
  | "last-3-months"
  | "last-6-months"
  | "this-year";

const validPeriods = new Set<Period>([
  "all-time", "this-month", "last-month", "last-3-months", "last-6-months", "this-year",
]);

function decodeSetting(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function getSettings() {
  const rows = getDatabase().prepare("SELECT key, value FROM settings").all() as Array<{
    key: string;
    value: string;
  }>;
  return Object.fromEntries(rows.map((row) => [row.key, decodeSetting(row.value)]));
}

export function getSelectedPeriod(): Period {
  const raw = getSettings().selectedPeriod;
  return typeof raw === "string" && validPeriods.has(raw as Period)
    ? (raw as Period)
    : "all-time";
}

function localDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function periodRange(period: Period, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = localDate(year, month, now.getDate());

  if (period === "all-time") return { start: null, end: today };
  if (period === "this-month") return { start: localDate(year, month, 1), end: today };
  if (period === "last-month") {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return {
      start: localDate(start.getFullYear(), start.getMonth(), 1),
      end: localDate(end.getFullYear(), end.getMonth(), end.getDate()),
    };
  }
  if (period === "this-year") return { start: localDate(year, 0, 1), end: today };
  const months = period === "last-3-months" ? 3 : 6;
  const start = new Date(year, month - months + 1, 1);
  return { start: localDate(start.getFullYear(), start.getMonth(), 1), end: today };
}

export function getDashboardSummary(period = getSelectedPeriod()) {
  const database = getDatabase();
  const range = periodRange(period);
  const clauses = ["date <= ?"];
  const params: string[] = [range.end];
  if (range.start) {
    clauses.push("date >= ?");
    params.push(range.start);
  }
  const where = clauses.join(" AND ");

  const totals = database.prepare(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amountCents ELSE 0 END), 0) AS incomeCents,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amountCents ELSE 0 END), 0) AS spendingCents,
      COUNT(*) AS transactionCount,
      COALESCE(SUM(CASE WHEN categoryLabel = 'Needs review' THEN 1 ELSE 0 END), 0) AS needsReviewCount
    FROM transactions WHERE ${where}`,
  ).get(...params) as {
    incomeCents: number;
    spendingCents: number;
    transactionCount: number;
    needsReviewCount: number;
  };

  const recent = database.prepare(
    `SELECT id, date, merchant, categoryLabel, accountLabel, amountCents, type, receipt
     FROM transactions WHERE ${where}
     ORDER BY date DESC, createdAt DESC LIMIT 5`,
  ).all(...params);
  const monthly = database.prepare(`SELECT substr(date,1,7) month,SUM(CASE WHEN type='income' THEN amountCents ELSE 0 END) incomeCents,SUM(CASE WHEN type='expense' THEN amountCents ELSE 0 END) spendingCents FROM transactions WHERE ${where} GROUP BY substr(date,1,7) ORDER BY month DESC LIMIT 7`).all(...params).reverse();
  const categories = database.prepare(`SELECT categoryLabel,SUM(amountCents) amountCents FROM transactions WHERE type='expense' AND ${where} GROUP BY categoryLabel ORDER BY amountCents DESC`).all(...params);
  const upcoming = database.prepare(`SELECT serviceName name,nextRenewalDate nextDate,amountCents,'subscription' kind FROM subscriptions WHERE active=1 AND nextRenewalDate>=date('now','localtime') UNION ALL SELECT name,nextDate,amountCents,'recurring' kind FROM recurring_entries WHERE active=1 AND nextDate>=date('now','localtime') ORDER BY nextDate LIMIT 5`).all();

  const settings = getSettings();
  const income = Number(totals.incomeCents);
  const spending = Number(totals.spendingCents);

  return {
    period,
    range,
    ...totals,
    savingsRate: income === 0 ? 0 : ((income - spending) / income) * 100,
    assetsCents: Number(settings.assetsCents ?? 0),
    liabilitiesCents: Number(settings.liabilitiesCents ?? 0),
    netWorthConfigured: settings.netWorthConfigured === true,
    recent,
    monthly,
    categories,
    upcoming,
  };
}

export function getState() {
  const database = getDatabase();
  return {
    transactions: database.prepare(
      `SELECT t.id, t.date, t.merchant, t.categoryId, t.categoryLabel, t.amountCents,
        t.type, t.accountId, t.accountLabel, t.receipt, t.source, t.createdAt, t.updatedAt,
        COALESCE(json_group_array(json_object('id', tag.id, 'name', tag.name))
          FILTER (WHERE tag.id IS NOT NULL), '[]') AS tags
       FROM transactions t
       LEFT JOIN transaction_tags tt ON tt.transactionId = t.id
       LEFT JOIN tags tag ON tag.id = tt.tagId
       GROUP BY t.id ORDER BY t.date DESC, t.createdAt DESC LIMIT 5000`,
    ).all(),
    categories: database.prepare("SELECT id, name FROM categories ORDER BY name COLLATE NOCASE").all(),
    accounts: database.prepare("SELECT id, name FROM accounts ORDER BY name COLLATE NOCASE").all(),
    tags: database.prepare(
      `SELECT tag.id, tag.name, COUNT(tt.transactionId) AS usageCount
       FROM tags tag LEFT JOIN transaction_tags tt ON tt.tagId = tag.id
       GROUP BY tag.id ORDER BY tag.name COLLATE NOCASE`,
    ).all(),
    rules: database.prepare("SELECT * FROM rules ORDER BY createdAt DESC").all(),
    goals: database.prepare("SELECT * FROM goals ORDER BY createdAt DESC").all(),
    budgets: database.prepare(`SELECT b.*,COALESCE(SUM(CASE WHEN t.type='expense' AND strftime('%Y-%m',t.date)=strftime('%Y-%m','now','localtime') THEN t.amountCents ELSE 0 END),0) spentCents FROM budgets b LEFT JOIN transactions t ON t.categoryLabel=b.categoryLabel GROUP BY b.id ORDER BY b.createdAt DESC`).all(),
    subscriptions: database.prepare("SELECT * FROM subscriptions ORDER BY nextRenewalDate").all(),
    recurring: database.prepare("SELECT * FROM recurring_entries ORDER BY nextDate").all(),
    documents: database.prepare(
      "SELECT id, filename, mimeType, size, status, source, driveModifiedAt, transactionId, extractionJson, createdAt FROM documents ORDER BY createdAt DESC LIMIT 100",
    ).all(),
    settings: getSettings(),
    detectionSuggestions: detectRecurringPatterns(),
    ignoredSuggestionCount: (database.prepare("SELECT COUNT(*) count FROM dismissed_patterns").get() as {count:number}).count,
  };
}
