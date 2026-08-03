import { getDatabase } from "../lib/db";

const database = getDatabase();
const result = database.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
const version = database.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as { version: number };

if (result.integrity_check !== "ok") throw new Error("SQLite integrity check failed.");
process.stdout.write(`Ledgerly database is healthy (schema v${version.version}).\n`);
