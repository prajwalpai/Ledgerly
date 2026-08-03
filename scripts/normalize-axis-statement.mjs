import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/normalize-axis-statement.mjs <input.csv> <output.csv>");
}

const source = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "");
const header = "Tran Date,CHQNO,PARTICULARS,DR,CR,BAL,SOL";
const headerOffset = source.split(/\r?\n/).findIndex((line) => line.trim() === header);

if (headerOffset < 0) throw new Error("Axis Bank transaction header was not found.");

const table = source.split(/\r?\n/).slice(headerOffset).join("\n");
const parsed = Papa.parse(table, { header: true, skipEmptyLines: true });
const rows = parsed.data
  .filter((row) => /^\d{2}-\d{2}-\d{4}$/.test(String(row["Tran Date"] ?? "").trim()))
  .map((row) => ({
    Date: String(row["Tran Date"] ?? "").trim(),
    Description: String(row.PARTICULARS ?? "").trim(),
    Debit: String(row.DR ?? "").replace(/,/g, "").trim(),
    Credit: String(row.CR ?? "").replace(/,/g, "").trim(),
    Balance: String(row.BAL ?? "").replace(/,/g, "").trim(),
  }));

if (!rows.length) throw new Error("No transaction rows were found.");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, Papa.unparse(rows, { newline: "\n" }), { encoding: "utf8", mode: 0o600 });
process.stdout.write(`Wrote ${rows.length} transactions to ${outputPath}\n`);
