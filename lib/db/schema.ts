export const schemaVersion = 2;

export const migrationV1 = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    appliedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    normalizedName TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    normalizedName TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    normalizedName TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL CHECK(date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
    merchant TEXT NOT NULL,
    categoryId TEXT REFERENCES categories(id) ON DELETE SET NULL,
    categoryLabel TEXT NOT NULL,
    amountCents INTEGER NOT NULL CHECK(amountCents > 0),
    type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
    accountId TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    accountLabel TEXT NOT NULL,
    receipt INTEGER NOT NULL DEFAULT 0 CHECK(receipt IN (0, 1)),
    source TEXT NOT NULL CHECK(source IN ('manual', 'csv', 'document', 'google-drive')),
    fingerprint TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(date DESC)`,
  `CREATE INDEX IF NOT EXISTS transactions_type_date_idx ON transactions(type, date DESC)`,
  `CREATE TABLE IF NOT EXISTS transaction_tags (
    transactionId TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    tagId TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY(transactionId, tagId)
  )`,
  `CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    whenText TEXT NOT NULL,
    thenText TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mimeType TEXT NOT NULL,
    size INTEGER NOT NULL CHECK(size >= 0 AND size <= 20971520),
    vaultKey TEXT NOT NULL UNIQUE,
    sha256 TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('queued', 'stored', 'review')),
    source TEXT NOT NULL CHECK(source IN ('upload', 'google-drive')),
    driveFileId TEXT,
    driveModifiedAt TEXT,
    transactionId TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    extractionJson TEXT,
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    targetCents INTEGER NOT NULL CHECK(targetCents > 0),
    currentCents INTEGER NOT NULL DEFAULT 0 CHECK(currentCents >= 0),
    dueDate TEXT,
    note TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    categoryId TEXT REFERENCES categories(id) ON DELETE SET NULL,
    categoryLabel TEXT NOT NULL,
    monthlyLimitCents INTEGER NOT NULL CHECK(monthlyLimitCents > 0),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    serviceName TEXT NOT NULL,
    categoryId TEXT REFERENCES categories(id) ON DELETE SET NULL,
    categoryLabel TEXT NOT NULL,
    amountCents INTEGER NOT NULL CHECK(amountCents > 0),
    cadence TEXT NOT NULL CHECK(cadence IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual')),
    nextRenewalDate TEXT NOT NULL,
    accountId TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    accountLabel TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS recurring_entries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    categoryId TEXT REFERENCES categories(id) ON DELETE SET NULL,
    categoryLabel TEXT NOT NULL,
    amountCents INTEGER NOT NULL CHECK(amountCents > 0),
    cadence TEXT NOT NULL CHECK(cadence IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual')),
    nextDate TEXT NOT NULL,
    accountId TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    accountLabel TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS dismissed_patterns (
    patternKey TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS drive_files (
    fileId TEXT PRIMARY KEY,
    relativePath TEXT NOT NULL,
    modifiedAt TEXT NOT NULL,
    size INTEGER NOT NULL CHECK(size >= 0),
    sha256 TEXT,
    status TEXT NOT NULL CHECK(status IN ('processing', 'stored', 'review', 'failed', 'skipped')),
    processedAt TEXT,
    lastError TEXT
  )`,
];

export const starterCategories = [
  "Housing", "Groceries", "Shopping", "Dining", "Transportation",
  "Utilities", "Subscriptions", "Insurance", "Health", "Entertainment",
  "Income", "Needs review", "Other",
];

export const starterAccounts = [
  "Main Checking", "Everyday Visa", "Rewards Card", "Cash",
];
