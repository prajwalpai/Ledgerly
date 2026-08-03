import fs from "node:fs";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { databasePath, dataRoot, vaultPath, backupPath, logPath } from "@/lib/runtime-paths";
import { migrationV1, schemaVersion, starterAccounts, starterCategories } from "@/lib/db/schema";

type LedgerlyDatabase = Database.Database;

const globalForDatabase = globalThis as typeof globalThis & {
  ledgerlyDatabase?: LedgerlyDatabase;
};

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function ensureRuntimeDirectories() {
  for (const directory of [dataRoot, vaultPath, backupPath, logPath]) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    try {
      fs.chmodSync(directory, 0o700);
    } catch {
      // Existing macOS ACLs may prevent chmod; access remains limited by the user profile.
    }
  }
}

function initialize(database: LedgerlyDatabase) {
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");

  const migrate = database.transaction(() => {
    for (const statement of migrationV1) database.prepare(statement).run();

    const applied = database
      .prepare("SELECT version FROM schema_migrations WHERE version = ?")
      .get(schemaVersion);

    if (!applied) {
      database
        .prepare("INSERT INTO schema_migrations (version, appliedAt) VALUES (?, ?)")
        .run(schemaVersion, new Date().toISOString());
    }

    const now = new Date().toISOString();
    const insertCategory = database.prepare(
      "INSERT OR IGNORE INTO categories (id, name, normalizedName, createdAt) VALUES (?, ?, ?, ?)",
    );
    const insertAccount = database.prepare(
      "INSERT OR IGNORE INTO accounts (id, name, normalizedName, createdAt) VALUES (?, ?, ?, ?)",
    );
    for (const name of starterCategories) {
      insertCategory.run(crypto.randomUUID(), name, normalizeName(name), now);
    }
    for (const name of starterAccounts) {
      insertAccount.run(crypto.randomUUID(), name, normalizeName(name), now);
    }

    const insertSetting = database.prepare(
      "INSERT OR IGNORE INTO settings (key, value, updatedAt) VALUES (?, ?, ?)",
    );
    insertSetting.run("selectedPeriod", JSON.stringify("all-time"), now);
    insertSetting.run("assetsCents", JSON.stringify(0), now);
    insertSetting.run("liabilitiesCents", JSON.stringify(0), now);
    insertSetting.run("netWorthConfigured", JSON.stringify(false), now);
    insertSetting.run("freshStart", JSON.stringify(true), now);
  });

  migrate();
}

export function getDatabase() {
  if (globalForDatabase.ledgerlyDatabase) return globalForDatabase.ledgerlyDatabase;

  ensureRuntimeDirectories();
  const database = new Database(databasePath, { timeout: 5000 });
  initialize(database);
  globalForDatabase.ledgerlyDatabase = database;
  return database;
}

export function closeDatabaseForTests() {
  globalForDatabase.ledgerlyDatabase?.close();
  delete globalForDatabase.ledgerlyDatabase;
}
