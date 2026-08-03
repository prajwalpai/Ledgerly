import "server-only";

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { importCsvRows } from "@/lib/csv-import";

type Row = Record<string, unknown>;

function normalizedHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function choose(headers: string[], names: string[]) {
  return headers.find((header) => names.includes(normalizedHeader(header))) ?? "";
}

function inferDateFormat(rows: Row[], dateHeader: string) {
  for (const row of rows.slice(0, 25)) {
    const value = String(row[dateHeader] ?? "").trim();
    const match = value.match(/^(\d{1,4})[\-/.](\d{1,2})[\-/.](\d{1,4})/);
    if (!match) continue;
    if (match[1].length === 4) return "iso" as const;
    if (Number(match[1]) > 12) return "dmy" as const;
    if (Number(match[2]) > 12) return "mdy" as const;
  }
  return null;
}

export function parseStatement(bytes: Buffer, extension: string) {
  let rows: Row[] = [];
  if (extension === ".csv") {
    const parsed = Papa.parse<Row>(bytes.toString("utf8"), { header: true, skipEmptyLines: true });
    if (parsed.errors.length && !parsed.data.length) throw new Error("The CSV could not be parsed.");
    rows = parsed.data;
  } else if ([".xls", ".xlsx"].includes(extension)) {
    const workbook = XLSX.read(bytes, { type: "buffer", cellDates: false });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error("The spreadsheet has no worksheets.");
    rows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[firstSheet], { defval: "" });
  } else {
    return null;
  }
  if (!rows.length || rows.length > 5000) throw new Error("The statement must contain between 1 and 5,000 rows.");
  const headers = Object.keys(rows[0]);
  const date = choose(headers, ["date", "transactiondate", "posteddate", "valuedate"]);
  const merchant = choose(headers, ["description", "merchant", "payee", "details", "memo", "narration", "particulars"]);
  const amount = choose(headers, ["amount", "transactionamount"]);
  const debit = choose(headers, ["debit", "withdrawal", "charge", "debitamount"]);
  const credit = choose(headers, ["credit", "deposit", "creditamount"]);
  const dateFormat = date ? inferDateFormat(rows, date) : null;
  if (!date || !merchant || (!amount && !debit && !credit) || !dateFormat) return { needsMapping: true as const, rowCount: rows.length };
  const result = importCsvRows({
    rows,
    mapping: {
      date, merchant, amount: amount || undefined, debit: debit || undefined, credit: credit || undefined,
      category: choose(headers, ["category"]) || undefined,
      account: choose(headers, ["account", "accountname"]) || undefined,
      dateFormat,
      amountConvention: "negative-expense",
    },
    fallbackAccount: "Drive import",
    source: "google-drive",
    defaultTags: ["Drive import"],
  });
  return { needsMapping: false as const, rowCount: rows.length, ...result };
}
