import crypto from "node:crypto";
import * as XLSX from "xlsx";
import { getDatabase } from "../lib/db";
import { importCsvRows } from "../lib/csv-import";
import { parseStatement } from "../lib/statement-import";

if (!process.env.LEDGERLY_DATA_DIR?.includes("ledgerly-verification-")) {
  throw new Error("Run with an isolated LEDGERLY_DATA_DIR containing ledgerly-verification-.");
}

const database = getDatabase();
const now = new Date().toISOString();
database.prepare("INSERT INTO rules(id,whenText,thenText,enabled,createdAt,updatedAt) VALUES(?,?,?,?,?,?)")
  .run(crypto.randomUUID(), "Merchant contains Test Cafe", "Set category to Dining; add tag Verified", 1, now, now);

const input = {
  rows: [{ Date: "2026-08-01", Description: "Test Cafe 42", Amount: "-125.50" }],
  mapping: { date: "Date", merchant: "Description", amount: "Amount", dateFormat: "iso", amountConvention: "negative-expense" },
};
const first = importCsvRows(input);
const second = importCsvRows(input);
if (first.inserted !== 1 || second.duplicates !== 1) throw new Error("CSV duplicate verification failed.");
const row = database.prepare("SELECT categoryLabel FROM transactions LIMIT 1").get() as { categoryLabel: string };
const tag = database.prepare("SELECT name FROM tags WHERE normalizedName = 'verified'").get() as { name: string } | undefined;
if (row.categoryLabel !== "Dining" || tag?.name !== "Verified") throw new Error("Future-import rule verification failed.");

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ Date: "2026-08-02", Description: "Spreadsheet Shop", Debit: "50.00" }]), "Statement");
const spreadsheet = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
const spreadsheetResult = parseStatement(spreadsheet, ".xlsx");
if (!spreadsheetResult || spreadsheetResult.needsMapping || spreadsheetResult.inserted !== 1) throw new Error("Spreadsheet import verification failed.");

process.stdout.write("Core verification passed: CSV mapping, duplicate detection, rules, tags, and XLSX import.\n");
