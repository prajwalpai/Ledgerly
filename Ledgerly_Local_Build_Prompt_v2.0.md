# LEDGERLY LOCAL MAC BUILD PROMPT — VERSION 2.0

## MASTER PROMPT — START

You are my product engineer. Build and package a complete, private, mobile-friendly personal financial dashboard named **Ledgerly** as a locally deployed macOS web application. Ledgerly runs on my Mac and is opened in a normal browser. It is a generic personal-finance product and is not associated with any business.

Do the work, not merely describe a plan or produce a mockup. Build the application, its local server APIs, SQLite database, private document vault, Google Drive inbox integration, macOS launch configuration, tests, and operating instructions. Do not use ChatGPT Sites, Cloudflare D1, Cloudflare R2, ChatGPT Work automations, or browser local storage as the durable source of truth.

Follow this specification exactly. Do not omit a page, control, persistence behavior, empty state, import path, security measure, installation step, or verification step. Do not seed sample financial data.

## 1. Target environment and deployment contract

1. Target an Apple Silicon Mac running macOS.
2. Build one TypeScript application using a maintained React full-stack framework that supports server routes and a production Node.js server.
3. The production server must bind to `127.0.0.1` only, never `0.0.0.0`, unless I explicitly request LAN access later.
4. Use a configurable local port, defaulting to `4317`. The normal URL is `http://127.0.0.1:4317`.
5. Store structured data in SQLite. Enable foreign keys, WAL mode, busy timeout, transactions, and idempotent versioned migrations.
6. Store original uploaded and Drive-imported bytes in a private local document vault. Store only file metadata and relationships in SQLite.
7. Store runtime data under:
   - database: `~/Library/Application Support/Ledgerly/ledgerly.sqlite3`
   - document vault: `~/Library/Application Support/Ledgerly/vault/`
   - backups: `~/Library/Application Support/Ledgerly/backups/`
   - logs: `~/Library/Logs/Ledgerly/`
8. Create runtime directories with owner-only permissions where practical. Never place financial data in the repository or browser storage.
9. Use macOS `launchd` for application startup and scheduled Drive imports. Do not require Docker or a permanently open terminal.
10. The application must remain usable without an internet connection except for Google Drive for desktop completing its own synchronization.
11. This is a single-user, single-Mac application. Do not add public sign-up, remote authentication, telemetry, analytics, or cloud synchronization.
12. Provide uninstall instructions that distinguish application code, launch agents, and user data. Never delete user data during an ordinary upgrade or uninstall without explicit confirmation.

## 2. Current machine prerequisites and setup

The machine already has Node.js, npm, Git, Homebrew, SQLite, Python, Apple Command Line Tools, `launchctl`, and Google Drive for desktop.

Before implementing OCR/document extraction, install the missing local tools with:

```bash
brew install tesseract poppler
```

Then verify:

```bash
tesseract --version
pdftotext -v
pdftoppm -v
```

Do not install these tools until the build reaches the document-processing phase. Ask for approval immediately before running the Homebrew installation if it has not already been approved in the active session.

Project-level JavaScript dependencies may be installed in the project normally. Pin production dependencies in the lockfile. Do not require global npm packages.

Google Drive for desktop currently exposes a synchronized root under `~/Library/CloudStorage/GoogleDrive-*`. Discover the current root rather than hard-coding an email address. Resolve the selected Drive inbox path during setup and save it in local application configuration.

## 3. Non-negotiable product rules

1. Create exactly one Ledgerly application in this project and update it in place.
2. Keep the production server loopback-only and the data owner-only.
3. SQLite and the private vault are the durable sources of truth.
4. Browser local storage may be used only for disposable UI state, never financial data, settings, imports, or the selected period.
5. The application reads Google Drive only through the local folder synchronized by Google Drive for desktop. It must not embed Google OAuth credentials or call the Drive API.
6. Resolve or create exactly one folder named `Ledgerly Financial Inbox` inside the selected Google Drive `My Drive` location. Reuse an exact match. If multiple matches exist, show them and ask which path to use.
7. Never move, rename, edit, share, trash, or delete source files in Google Drive.
8. Schedule inbox processing once per day at 8:00 AM using a single LaunchAgent. Do not create duplicate agents.
9. `launchd` uses the Mac's configured timezone. Record and display that timezone. If the Mac is asleep at 8:00 AM, macOS may run the job after wake; state this accurately in Settings and documentation.
10. On first launch, every financial dataset is empty. Do not insert demonstration records.
11. Starter category and account names are removable configuration definitions only; they must not create balances or transactions.
12. Every visible control described in this prompt must work. No placeholder controls or unsupported icon glyphs.
13. Use `lucide-react` or another installed vector icon library.
14. Normal text should be approximately 14–16 px, metadata no smaller than 12 px, and primary mobile touch targets at least 44 px high where practical.
15. Never expose financial document contents, account numbers, local filesystem paths, environment values, or secrets in UI errors, logs, notifications, source code, or completion messages.

## 4. Build and setup sequence

Execute in this order:

1. Inspect the workspace and installed prerequisites without changing the system.
2. Initialize the application once and establish the lockfile.
3. Design and create the SQLite schema and migration runner.
4. Build core APIs, pages, responsive UI, and exact empty states.
5. Build CSV and spreadsheet imports.
6. Request approval and install Tesseract and Poppler if still missing.
7. Build local PDF/image OCR and document-review handling.
8. Discover Google Drive roots and resolve the one dedicated inbox.
9. Build the Drive inbox processor and its safe processed-file ledger.
10. Build the production bundle and local launcher.
11. Install or update exactly one app LaunchAgent and one daily sync LaunchAgent.
12. Verify the production app at desktop, tablet, and mobile widths.
13. Run controlled persistence, duplicate, OCR, Drive, and scheduling tests.
14. Remove every temporary record and file, leaving the app in the exact empty-start state.
15. Provide the local URL, data locations, schedule, backup instructions, and any remaining manual action.

## 5. Empty-start contract

The first real session and final delivered state must have:

- `transactions = []`
- `documents = []`
- `goals = []`
- `budgets = []`
- `subscriptions = []`
- `recurring = []`
- `rules = []`
- `tags = []`
- `dismissedPatterns = []`
- `selectedPeriod = "all-time"`
- assets total `0`, liabilities total `0`, and `netWorthConfigured = false`
- Net Worth displayed as **Not set** until totals are explicitly saved
- all charts rendered as polished empty states
- transaction-derived totals displayed as `$0.00`
- no invented activity, payments, trends, insights, or advice

Allowed starter categories:

`Housing, Groceries, Shopping, Dining, Transportation, Utilities, Subscriptions, Insurance, Health, Entertainment, Income, Needs review, Other`

Allowed starter accounts, without balances:

`Main Checking, Everyday Visa, Rewards Card, Cash`

The user can remove any starter definition in Settings. Never create balances automatically.

## 6. SQLite data model

Use parameterized queries and versioned migrations. Structured entities must have canonical tables; do not duplicate authoritative rules or tags inside generic settings JSON.

### 6.1 Core tables

#### `transactions`

- `id` TEXT PRIMARY KEY
- `date` TEXT NOT NULL in ISO `YYYY-MM-DD`
- `merchant` TEXT NOT NULL
- `categoryId` TEXT NULL, foreign key to `categories`
- `categoryLabel` TEXT NOT NULL, preserving historical labels
- `amountCents` INTEGER NOT NULL and greater than zero
- `type` TEXT NOT NULL, `expense` or `income`
- `accountId` TEXT NULL, foreign key to `accounts`
- `accountLabel` TEXT NOT NULL, preserving historical labels
- `receipt` INTEGER NOT NULL DEFAULT `0`
- `source` TEXT NOT NULL: `manual`, `csv`, `document`, or `google-drive`
- `fingerprint` TEXT NOT NULL UNIQUE
- `createdAt` TEXT NOT NULL
- `updatedAt` TEXT NOT NULL

Store money as integer cents. The canonical fingerprint is:

`date + "|" + merchant.trim().toLowerCase() + "|" + amount.toFixed(2) + "|" + account.trim().toLowerCase()`

Keep this fingerprint for compatibility with the product rules even though it intentionally does not include type or source.

#### `categories`

- `id` TEXT PRIMARY KEY
- `name` TEXT NOT NULL
- `normalizedName` TEXT NOT NULL UNIQUE
- `createdAt` TEXT NOT NULL

#### `accounts`

- `id` TEXT PRIMARY KEY
- `name` TEXT NOT NULL
- `normalizedName` TEXT NOT NULL UNIQUE
- `createdAt` TEXT NOT NULL

#### `tags`

- `id` TEXT PRIMARY KEY
- `name` TEXT NOT NULL
- `normalizedName` TEXT NOT NULL UNIQUE
- `createdAt` TEXT NOT NULL

#### `transaction_tags`

- `transactionId` TEXT NOT NULL
- `tagId` TEXT NOT NULL
- composite primary key on both columns
- foreign keys with appropriate cascade behavior

#### `rules`

- `id` TEXT PRIMARY KEY
- `whenText` TEXT NOT NULL
- `thenText` TEXT NOT NULL
- `enabled` INTEGER NOT NULL DEFAULT `1`
- `createdAt` TEXT NOT NULL
- `updatedAt` TEXT NOT NULL

#### `documents`

- `id` TEXT PRIMARY KEY
- `filename` TEXT NOT NULL
- `mimeType` TEXT NOT NULL
- `size` INTEGER NOT NULL
- `vaultKey` TEXT NOT NULL UNIQUE
- `sha256` TEXT NOT NULL
- `status` TEXT NOT NULL: `queued`, `stored`, or `review`
- `source` TEXT NOT NULL: `upload` or `google-drive`
- `driveFileId` TEXT NULL
- `driveModifiedAt` TEXT NULL
- `createdAt` TEXT NOT NULL

Never return `vaultKey` or an absolute local path to the browser.

### 6.2 Product tables

Use canonical tables for `goals`, `budgets`, `subscriptions`, `recurring_entries`, and `dismissed_patterns`. Include UUID, required product fields, active state where applicable, and created/updated timestamps. Store monetary values as integer cents.

Deleting a category or account removes it from future selectors but historical transactions retain their saved label. Deleting a tag requires confirmation before removing transaction relationships.

### 6.3 Integration and settings tables

Use a `settings` key/value table for scalar configuration such as selected period, assets, liabilities, net-worth-configured state, Drive inbox path, schedule metadata, last sync summary, fresh-start state, and database schema metadata.

Use a dedicated `drive_files` table rather than a 5,000-item JSON setting:

- `fileId` TEXT PRIMARY KEY
- `relativePath` TEXT NOT NULL
- `modifiedAt` TEXT NOT NULL
- `size` INTEGER NOT NULL
- `sha256` TEXT NULL
- `status` TEXT NOT NULL
- `processedAt` TEXT NULL
- `lastError` TEXT NULL containing only a sanitized concise error

Mark a Drive file processed only after accepted data and/or original bytes are durably stored. Failed files remain retryable.

## 7. Local file vault and backups

1. Enforce a maximum of 20 MB per file before processing.
2. Write uploads to a temporary file in the Ledgerly data directory, validate, hash, then atomically move them into the vault.
3. Use safe vault keys such as `uploads/<uuid>-<safe-filename>` and `drive-inbox/<safe-file-id>-<safe-filename>`.
4. Reject path traversal, symlinks escaping configured roots, unsupported types, and mismatched unsafe paths.
5. Never serve the vault as a static directory. A protected local download route may stream a file by document ID after resolving it server-side.
6. Individual document deletion must delete the vault object and database row consistently, reporting any partial failure.
7. Create a working backup action that produces a timestamped SQLite backup plus a manifest. Do not duplicate all documents unless the user explicitly selects a full backup.
8. Document how to restore a backup while the app is stopped.

## 8. Server APIs

All writes require server-side validation, same-origin checks, bounded payloads, and readable errors. Use database transactions for multi-table writes.

### 8.1 State and reporting

- `GET /api/state` returns up to 5,000 newest transactions, all configuration definitions, rules, settings, product entities, and up to 100 newest document metadata rows.
- Never return original bytes, vault keys, absolute paths, or sensitive extracted text.
- `GET /api/reports/summary` computes totals and chart aggregates directly in SQLite for the selected period. It must remain correct when more than 5,000 transactions exist.
- `DELETE /api/state` performs the complete wipe described below.

### 8.2 Transactions

Implement `POST`, `PATCH`, and `DELETE` transaction routes. Accept a single record or batch where appropriate. Validate date, merchant/source, positive finite amount, account, type, category, and tags. Normalize tags case-insensitively. Perform duplicate detection before categorization rules, then rely on the unique database constraint for concurrent safety. Return inserted, duplicate, skipped, and review counts.

### 8.3 Preferences and product CRUD

Provide validated APIs for categories, accounts, tags, rules, goals, budgets, subscriptions, recurring entries, ignored patterns, assets/liabilities, selected period, and Drive settings. A partial update must never reset unrelated preferences.

### 8.4 Documents

- `POST /api/documents` accepts one or multiple supported files and stores original bytes before extraction.
- `DELETE /api/documents/:id` removes both the vault file and metadata.
- A document may be `stored` without creating a transaction.
- Uncertain extraction becomes `review`; never create a transaction from invented or materially uncertain values.

### 8.5 Drive sync

- `GET /api/drive-sync` returns configured folder metadata, schedule, timezone, last run, counts, errors, reset cutoff, and current processor status.
- `POST /api/drive-sync` triggers one local sync and returns `complete`, `partial`, or `already-running`.
- A filesystem lock prevents concurrent scheduled and manual runs.
- The scheduled job uses the same internal sync service through a local CLI entry point; it must not depend on a browser being open.

## 9. Complete data wipe

The UI requires the user to type `DELETE`. The client then sends the exact server confirmation `DELETE ALL LEDGERLY DATA`.

On confirmation:

1. Stop or reject concurrent imports.
2. Delete transactions, documents, tags, rules, goals, budgets, subscriptions, recurring entries, dismissed patterns, and their relationships in a database transaction.
3. Delete Ledgerly-managed vault files without touching Google Drive originals.
4. Preserve the configured Drive inbox path and LaunchAgent schedule metadata.
5. Reset the Drive processed-file ledger.
6. Set `driveResetAt` to the current ISO timestamp so files modified at or before the reset are never reimported.
7. Recreate allowed starter categories/accounts and structural empty settings.
8. Set assets and liabilities to zero, `netWorthConfigured = false`, `selectedPeriod = "all-time"`, and `freshStart = true`.
9. Return a clear summary. If file cleanup partially fails, report it without pretending the wipe was fully successful.

## 10. Application shell and visual system

Build a calm, polished financial interface with a light gray background, white cards, subtle borders and shadows, violet accent near `#6558D3`, semantic green/orange/blue states, occasional dark navy summaries, 14–16 px card radii, a desktop sidebar near 238 px, and a sticky desktop top bar near 76 px.

Navigation order:

1. Dashboard
2. Transactions
3. Recurring
4. Subscriptions
5. Budgets
6. Goals
7. Documents
8. Rules
9. Settings

The common top actions are **Drive sync**, **Import**, and **Add entry**. Mobile uses a compact top bar and clearly scrollable bottom navigation reaching all nine tabs.

Dialogs trap focus, close through a visible button and Escape, use labels/ARIA, fit narrow viewports, scroll internally, disable submissions while saving, and show inline results.

## 11. Dashboard and global period

Period options are All time, This month, Last month, Last 3 months, Last 6 months, and This year. Store the allowed value in SQLite, load it before rendering date-sensitive totals, share it between Dashboard and Transactions, and revert visibly if saving fails.

Summary cards:

1. Net Worth = assets minus liabilities; show **Not set** before explicit configuration.
2. Income = selected-period income.
3. Spending = selected-period expenses.
4. Savings rate = `((income - spending) / income) * 100`, or `0%` when income is zero.

Never invent comparisons. Show a labeled calculation or `No trend yet` when history is insufficient.

Dashboard content includes a real cash-flow chart with up to seven monthly points, spending-by-category chart with accessible legend, five newest matching transactions, factual Ledgerly insight, and confirmed upcoming recurring items. Every section has an honest empty state.

## 12. Transactions and manual entry

Provide search by merchant/category/tag, account and category filters, shared period selector, responsive table/list, signed amount formatting, receipt indicator, inline category editing, removable tag pills, and a tag-only `+` modal.

The Add entry dialog includes Expense/Income, blank amount, blank merchant/source, editable date defaulting to today, managed category/account selectors, simple tag creation, receipt checkbox, and conditional file picker. Never prefill fake financial values. Save transaction and optional receipt consistently, then refresh affected summaries.

## 13. Imports and document processing

### 13.1 CSV and spreadsheets

Preview detected columns, recognize common headers, require mapping when ambiguous, normalize dates, honor actual debit/credit conventions, store positive magnitude, preserve supported categories, use `Needs review` otherwise, and show inserted/duplicate/skipped/review counts. Never create placeholder rows.

### 13.2 PDFs and images

1. Store and hash the original first.
2. For text PDFs, extract with Poppler's `pdftotext`.
3. For scanned PDFs, render only required pages with `pdftoppm`, then OCR with Tesseract.
4. OCR supported receipt/invoice images with Tesseract.
5. Bound page count, pixel dimensions, subprocess runtime, and output size.
6. Invoke tools without shell interpolation and never pass untrusted filenames as executable arguments without safe handling.
7. Extract merchant/payee, date, total, and type only when grounded in source text.
8. Use explicit confidence checks. If required fields conflict or remain uncertain, mark the document `review` and create no transaction.
9. Store only the minimum extraction metadata needed for review; do not write full OCR output to logs.

OCR is assistance, not proof. The review UI must show proposed fields and require confirmation before creating a transaction from uncertain extraction.

## 14. Duplicate handling

Centralize duplicate detection for manual, CSV, spreadsheet, document, and Drive paths. Use a pre-check plus SQLite's unique fingerprint constraint. Applying a rule must never change whether the candidate is a duplicate. Keep document metadata where appropriate and report duplicate transaction outcomes clearly.

## 15. Recurring and subscription detection

Normalize merchants by lowercasing, trimming, removing punctuation, removing terminal `#` plus digits, removing long digit references, and collapsing whitespace. Preserve the original display value.

Require at least two unique dates. Classify intervals only as weekly 5–9 days, biweekly 12–17, monthly 24–40, quarterly 75–110, or annual 330–400.

Define deterministic calculations:

- dominant cadence is the window containing more than half of consecutive intervals; ties or no majority are rejected
- amount variation is `(max amount - min amount) / average amount`
- interval jitter is the maximum absolute difference between matching intervals and their median
- subscription candidates allow at most 20% amount variation
- other recurring candidates allow at most 35%
- hint-free suggestions require at least three monthly/quarterly/annual occurrences and at most 3% variation
- dismissed key is a stable hash of normalized merchant plus cadence plus candidate kind

Subscription hints include a `subscription` category/tag or normalized merchant containing:

`netflix, spotify, hulu, disney, youtube, icloud, dropbox, adobe, microsoft, amazon prime, patreon, membership, studio, gym, openai, chatgpt, canva, notion, zoom, slack, github`

Recurring-bill hints include normalized merchant/category/tag text containing:

`mortgage, rent, loan, insurance, utility, utilities, electric, water, internet, phone, mobile, daycare, tuition, lease, car payment, auto payment, hoa, property tax`

Do not auto-suggest ordinary weekly shopping or groceries solely because they repeat. High confidence requires at least three occurrences, at most 12% variation, and at most five days of interval jitter; otherwise a valid candidate is Likely.

Calculate next dates calendar-aware and monthly equivalents using weekly `amount * 52 / 12`, biweekly `amount * 26 / 12`, monthly `amount`, quarterly `amount / 3`, and annual `amount / 12`.

Detection only suggests. **Keep** creates a confirmed record; **Ignore** persists the dismissed key; Settings restores ignored suggestions.

## 16. Product pages

### Recurring

Show active-detection status, suggestions, combined monthly/annual commitments without double counting, next expected payment, confirmed list, Add action, and edit/manage controls. A record contains name, category, amount, cadence, next date, optional account, and active status.

### Subscriptions

Show suggestions, monthly/annual totals, next renewal, confirmed list, Add action, and edit/manage controls. A record contains service, group/category, amount, cadence, renewal date, optional account, and active status.

### Budgets

Start empty. Provide Create and Adjust flows. Each budget has category, monthly limit, and active state. Calculate real monthly spending, remaining amount, progress, percentage, over-budget state, and budget-health summary.

### Goals

Start empty. Provide working add/edit/delete flows. A goal has name, target, current saved amount, optional due date, and note. Show remaining amount and progress.

### Documents

Provide Upload documents, Google Drive inbox, and secure vault sections. Show folder name, safe link/open action, last sync, schedule status, result counts, document name/type/size/source/status/date, and delete/review actions. Do not expose raw vault paths.

### Rules and tags

Rules show `When … then …`, enabled toggle, edit, and delete. Start with no rules. Apply enabled rules only to future imports after duplicate detection. Tags show usage counts; creation asks only for a name. Historical tag removal requires confirmation.

### Settings

Include net-worth setup, independent category/tag/account management, recurring detection explanation, restore ignored suggestions, Drive folder and sync status, schedule/timezone, database/vault location summaries without revealing full paths unnecessarily, backup/restore controls, application health, and danger zone.

## 17. Google Drive inbox processor

1. Discover mounted roots under `~/Library/CloudStorage/GoogleDrive-*`.
2. Resolve the actual `My Drive` directory and the exact `Ledgerly Financial Inbox` folder without assuming a fixed localized path.
3. Inspect direct child files only. Ignore directories, temporary files, hidden files, Google-native placeholder files that cannot be read locally, and files at or before `driveResetAt`.
4. Derive a stable file identity from filesystem metadata and content hash. Do not depend only on filename.
5. Wait until a file's size and modification time are stable before reading it.
6. Process only new or materially modified files absent from the processed ledger.
7. Store original accepted bytes in the vault, then parse through the same import pipeline used by manual uploads.
8. Use account `Drive import` only when no grounded account exists, add the `Drive import` tag, and set source `google-drive`.
9. Mark a source file processed only after durable success. Leave failures retryable and record a sanitized error.
10. Never alter the source file.
11. Display a Finder open action for the folder rather than exposing a cloud URL that may not exist for a local path.

## 18. macOS startup and scheduling

Create two idempotently installed user LaunchAgents:

1. `com.ledgerly.app` starts the production server at login, keeps it running, uses the exact installed application path, binds to `127.0.0.1`, and writes sanitized rotating logs.
2. `com.ledgerly.drive-sync` runs the Drive sync CLI using `StartCalendarInterval` with Hour `8` and Minute `0` in the Mac's local timezone.

Before installing:

- generate the plist files from explicit absolute paths
- validate them with `plutil`
- show the exact targets and request approval
- unload/update an existing Ledgerly agent rather than creating duplicates
- never overwrite an unrelated agent

Provide working install, status, restart, and uninstall scripts. The UI must show whether the server and sync agents are installed and the last job result. Scheduled sync must work without a browser tab being open.

## 19. Local security and reliability

- Bind only to loopback and reject unexpected Host and Origin headers.
- Add a restrictive Content Security Policy and standard security headers.
- Protect state-changing requests against cross-site request forgery.
- Use parameterized SQLite queries, database transactions, UUIDs, and strict validation.
- Escape all user-supplied text and never render raw HTML from imports or OCR.
- Apply upload, row-count, page-count, OCR-runtime, and request-size limits.
- Redact sensitive values from logs and rotate logs to bounded sizes.
- Use atomic filesystem writes and handle disk-full, locked-database, missing-Drive, and interrupted-import states honestly.
- Keep prior successful records when one batch item fails and return partial results.
- Provide `GET /api/health` with non-sensitive database, vault, OCR-tool, Drive-mount, and scheduler readiness.
- Do not claim encryption beyond macOS/FileVault and filesystem protections actually present.

## 20. Responsive behavior

Test at approximately 1440 px desktop, 768 px tablet, and 390 px mobile. Cards reflow four-to-two-to-one; charts resize; transaction rows stack or scroll within a contained table; inline controls remain tappable; dialogs fit and scroll; all nine mobile tabs remain reachable; and there is no page-level horizontal overflow, clipping, tiny critical text, or inaccessible control.

## 21. Required functional verification

Verify against the production local server:

1. First load contains no sample financial data, Net Worth says `Not set`, and period is All time.
2. Add, refresh, and delete a temporary transaction; verify SQLite persistence.
3. Add/remove a tag independently and test inline category/tag persistence.
4. Import a controlled CSV twice and verify duplicate reporting.
5. Test a text PDF and a small OCR image without retaining sensitive content.
6. Verify uploaded bytes and metadata, then delete both through the UI.
7. Verify assets minus liabilities and restore Net Worth to not configured.
8. Create/edit/delete temporary budget, goal, subscription, recurring item, rule, category, and account.
9. Test Drive import with one tiny non-sensitive file, verify the source file remains unchanged, then remove the temporary Ledgerly copy and record.
10. Verify manual Drive sync and concurrency locking.
11. Validate both LaunchAgents, confirm there is exactly one of each, and verify the recorded 8:00 AM local schedule.
12. Test wipe confirmation and `driveResetAt` without allowing old Drive files to repopulate the app.
13. Test all actions, navigation, modals, filters, periods, links, and settings.
14. Verify desktop, tablet, and mobile layouts.
15. Restart the production server and Mac-style LaunchAgent process; confirm state persists.
16. Test backup creation and inspect the backup manifest.
17. Leave the delivered period set to All time.

After testing, remove every temporary transaction, tag, rule, budget, goal, recurring entry, subscription, document, asset/liability value, OCR artifact, and test vault file. Leave the Drive inbox folder and both LaunchAgents configured. Do not delete unrelated Drive content.

## 22. Completion response

Provide a concise handoff containing:

- the local URL
- confirmation that the server is loopback-only
- confirmation that no sample financial data remains
- SQLite and local vault summary
- Drive inbox Finder location/action
- exact LaunchAgent schedule and timezone
- next expected run, noting sleep/wake behavior
- backup and restore summary
- short duplicate-detection explanation
- short recurring/subscription-detection explanation
- OCR readiness and tested formats
- confirmation that every page and control was tested at desktop and mobile widths
- any one-time action still required

Do not call the project complete if a visible control is a placeholder, data is browser-only, the production server cannot restart automatically, the Drive inbox or schedule is missing, OCR readiness is misrepresented, or temporary financial records remain.

## MASTER PROMPT — END
