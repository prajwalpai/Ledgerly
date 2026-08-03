import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function rotate(filename, maxBytes = 1024 * 1024, copies = 3) {
  const file = path.join(os.homedir(), "Library", "Logs", "Ledgerly", filename);
  try {
    if (!fs.existsSync(file) || fs.statSync(file).size <= maxBytes) return;
    for (let index = copies - 1; index >= 1; index -= 1) {
      const source = `${file}.${index}`; const destination = `${file}.${index + 1}`;
      if (fs.existsSync(source)) fs.renameSync(source, destination);
    }
    fs.renameSync(file, `${file}.1`);
  } catch { /* logging must never prevent sync */ }
}

rotate("drive-sync.log");
rotate("drive-sync-error.log");
const response = await fetch("http://127.0.0.1:4317/api/drive-sync", { method: "POST" });
const body = await response.text();
if (!response.ok) throw new Error(`Drive sync failed with HTTP ${response.status}.`);
process.stdout.write(`${body}\n`);
