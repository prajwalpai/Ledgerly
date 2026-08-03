import { syncDriveInbox } from "../lib/drive-sync";

async function main() {
  const result = await syncDriveInbox();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status === "partial") process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Drive sync failed."}\n`);
  process.exitCode = 1;
});
