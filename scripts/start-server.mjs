import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function rotate(filename, maxBytes = 2 * 1024 * 1024, copies = 3) {
  const file = path.join(os.homedir(), "Library", "Logs", "Ledgerly", filename);
  try {
    if (!fs.existsSync(file) || fs.statSync(file).size <= maxBytes) return;
    for (let index = copies - 1; index >= 1; index -= 1) {
      const source = `${file}.${index}`; const destination = `${file}.${index + 1}`;
      if (fs.existsSync(source)) fs.renameSync(source, destination);
    }
    fs.renameSync(file, `${file}.1`);
  } catch { /* logging must never prevent app startup */ }
}

rotate("app.log");
rotate("app-error.log");
await import("./server.js");
