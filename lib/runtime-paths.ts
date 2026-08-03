import os from "node:os";
import path from "node:path";

const configuredRoot = process.env.LEDGERLY_DATA_DIR?.trim();

export const dataRoot = configuredRoot
  ? path.resolve(configuredRoot)
  : path.join(os.homedir(), "Library", "Application Support", "Ledgerly");

export const databasePath = path.join(dataRoot, "ledgerly.sqlite3");
export const vaultPath = path.join(dataRoot, "vault");
export const backupPath = path.join(dataRoot, "backups");
export const logPath = configuredRoot
  ? path.join(dataRoot, "logs")
  : path.join(os.homedir(), "Library", "Logs", "Ledgerly");
