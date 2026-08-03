# Ledgerly local macOS deployment

Ledgerly is a private web application that runs only on the Mac where it is installed. Its production URL is `http://127.0.0.1:4317`.

## Prerequisites

- Apple Silicon Mac with macOS
- Administrator access for Homebrew installations
- Git
- Homebrew
- Node.js 22 or newer and npm
- Google Drive for desktop
- Tesseract and Poppler

Install the command-line prerequisites:

```bash
xcode-select --install
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node git tesseract poppler
```

Install Google Drive for desktop, sign in, and confirm that `My Drive` appears under `~/Library/CloudStorage/GoogleDrive-*`.

## Clone and install

```bash
mkdir -p ~/Documents/Github-Personal
cd ~/Documents/Github-Personal
git clone https://github.com/prajwalpai/Ledgerly.git
cd Ledgerly
npm install
```

Verify the tools and source:

```bash
node --version
tesseract --version
pdftotext -v
npm run typecheck
npm run lint
npm run build
```

## Configure the Drive inbox

Create exactly one folder named `Ledgerly Financial Inbox` directly inside Google Drive `My Drive`. Wait until it appears locally under the Google Drive mount. Ledgerly reads direct child files only and never changes Drive originals.

## Test locally

```bash
npm run dev
```

Open `http://127.0.0.1:4317`. Stop the development server with Control-C before installing production.

## Install production and scheduling

After `npm run build`, run the portable installer. It resolves the current home directory and Node path, copies the standalone application, validates both property lists, and safely reloads an existing Ledgerly agent instead of creating duplicates:

```bash
chmod +x scripts/*.sh
./scripts/install-launch-agents.sh
```

Verify `http://127.0.0.1:4317/api/health`. The Drive job runs daily at 8:00 AM in the Mac's local timezone. If the Mac is asleep, macOS may run it after wake.

## Data, backups, and logs

- Database: `~/Library/Application Support/Ledgerly/ledgerly.sqlite3`
- Vault: `~/Library/Application Support/Ledgerly/vault/`
- Backups: `~/Library/Application Support/Ledgerly/backups/`
- Logs: `~/Library/Logs/Ledgerly/`

Create backups from Settings. To restore, unload the app agent, copy the chosen backup over `ledgerly.sqlite3`, then load/kickstart the agent. Keep the replaced database until the restored app has been verified.

## Update

Pull changes, install locked dependencies, rebuild, and run the idempotent installer again:

```bash
git pull --ff-only
npm install
npm run typecheck && npm run lint && npm run build
./scripts/install-launch-agents.sh
```

## Uninstall

Run `scripts/uninstall-launch-agents.sh`, then remove the two Ledgerly plist files. This intentionally preserves the database, vault, and backups. Delete `~/Library/Application Support/Ledgerly` separately only when permanent data removal is explicitly intended.
