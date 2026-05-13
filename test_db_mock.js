/**
 * db.js — Node.js database layer for InvoiceHub
 * Mirrors db_utils.py using better-sqlite3 (synchronous API).
 *
 * All public functions are safe to call from the Electron main process.
 */

import Database from 'better-sqlite3'
import path from 'path'
const app = { isPackaged: false, getPath: () => '.', getAppPath: () => '.' };
import fs from 'fs'

// ── Path resolution ──────────────────────────────────────────────────────────

function getDbPath() {
  if (!app.isPackaged) {
    // Dev: reuse the existing Python project's database.
    // app.getAppPath() in electron-vite can be inside the `out` folder.
    // It is safer to use process.cwd() when running dev, which is the project root (invoice-electron).
    const devPath = path.join(process.cwd(), '..', 'invoice.db');
    console.log("Database path:", devPath);
    return devPath;
  }
  return path.join(app.getPath('userData'), 'invoice.db')
}

// ── Singleton connection ──────────────────────────────────────────────────────

let _db = null

export function getDb() {
  if (!_db) {
    const dbPath = getDbPath()
    console.log('[db] Opening:', dbPath)
    _db = new Database(dbPath)
    _db.pragma('journal_mode = WAL')
    ensureTables()
    
    // DEBUG: Check if we are reading the right DB
    try {
      const countResult = _db.prepare("SELECT COUNT(*) as cnt FROM invoices").get();
      console.log(`[db DEBUG] Total invoices in database: ${countResult.cnt}`);
    } catch (err) {
      console.error("[db DEBUG] Error counting invoices:", err);
    }
  }
  return _db
}

// ── Table creation (mirrors ensure_tables + ensure_statement_tables) ─────────

const LAYOUT_DEFAULTS = [
  ['company_name_font', 20],
  ['company_name_y',    40],
  ['company_addr_y',    54],
  ['title_gap',         25],
  ['billing_gap',       20],
  ['attn_gap',          18],
  ['table_gap',         18],
  ['summary_y',        150],
  ['notes_y',            8],
  ['signature_y',       45]
]

function ensureTables() {
  const db = _db  // called only from getDb(), _db is already set

  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      invoice_no TEXT PRIMARY KEY,
      customer   TEXT,
      date       TEXT,
      total      REAL,
      address    TEXT,
      attn       TEXT,
      tel        TEXT,
      acc_code   TEXT,
      terms      TEXT,
      ref1       TEXT,
      ref2       TEXT,
      ref3       TEXT,
      ref4       TEXT,
      status     TEXT DEFAULT 'Pending'
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no  TEXT,
      description TEXT,
      po_no       TEXT DEFAULT '',
      qty         REAL,
      uom         TEXT,
      uprice      REAL,
      subtotal    REAL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      acc_code TEXT UNIQUE,
      name     TEXT UNIQUE,
      address  TEXT,
      tel      TEXT,
      attn     TEXT
    );

    CREATE TABLE IF NOT EXISTS company_profile (
      id        INTEGER PRIMARY KEY,
      name      TEXT,
      reg_no    TEXT,
      address   TEXT,
      tel       TEXT,
      email     TEXT,
      bank_info TEXT
    );

    CREATE TABLE IF NOT EXISTS quotations (
      quotation_no TEXT PRIMARY KEY,
      customer     TEXT,
      date         TEXT,
      total        REAL,
      address      TEXT,
      attn         TEXT,
      tel          TEXT,
      acc_code     TEXT,
      terms        TEXT,
      ref1         TEXT,
      ref2         TEXT,
      status       TEXT DEFAULT 'Draft'
    );

    CREATE TABLE IF NOT EXISTS quotation_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_no TEXT,
      description  TEXT,
      qty          REAL,
      uom          TEXT,
      uprice       REAL,
      subtotal     REAL
    );

    CREATE TABLE IF NOT EXISTS layout_settings (
      key_name TEXT PRIMARY KEY,
      y_value  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      date           TEXT,
      customer       TEXT,
      acc_code       TEXT,
      amount         REAL,
      ref            TEXT,
      notes          TEXT,
      payment_no     TEXT DEFAULT '',
      payment_method TEXT DEFAULT 'Cash'
    );
  `)

  // Idempotent column migrations
  const migrations = [
    ['invoice_items', 'po_no',         "TEXT DEFAULT ''"],
    ['invoices',      'status',        "TEXT DEFAULT 'Pending'"],
    ['quotations',    'status',        "TEXT DEFAULT 'Draft'"],
    ['payments',      'payment_no',    "TEXT DEFAULT ''"],
    ['payments',      'payment_method',"TEXT DEFAULT 'Cash'"]
  ]
  for (const [table, col, typedef] of migrations) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${typedef}`)
    } catch {
      // column already exists — expected
    }
  }

  // Seed layout defaults (INSERT OR IGNORE — never overwrites)
  const seedStmt = db.prepare(
    'INSERT OR IGNORE INTO layout_settings (key_name, y_value) VALUES (?, ?)'
  )
  for (const [key, val] of LAYOUT_DEFAULTS) {
    seedStmt.run(key, val)
  }

  // Reset old absolute migration values for notes_y / signature_y
  db.prepare("UPDATE layout_settings SET y_value=?  WHERE key_name=? AND y_value=125")
    .run(8,  'notes_y')
  db.prepare("UPDATE layout_settings SET y_value=? WHERE key_name=? AND y_value=125")
    .run(45, 'signature_y')

  console.log('[db] Tables ensured')
}

// ── Layout settings ───────────────────────────────────────────────────────────

export function getLayoutSettings() {
  const defaults = Object.fromEntries(LAYOUT_DEFAULTS)
  try {
    const rows = getDb().prepare('SELECT key_name, y_value FROM layout_settings').all()
    for (const { key_name, y_value } of rows) {
      defaults[key_name] = y_value
    }
  } catch { /* use defaults */ }
  return defaults
}

export function saveLayoutSettings(settings) {
  const stmt = getDb().prepare(
    `INSERT INTO layout_settings (key_name, y_value) VALUES (?, ?)
     ON CONFLICT(key_name) DO UPDATE SET y_value = excluded.y_value`
  )
  for (const [key, val] of Object.entries(settings)) {
    stmt.run(key, Number(val))
  }
}

// ── Payment number ────────────────────────────────────────────────────────────

export function getNextPaymentNo() {
  try {
    const row = getDb()
      .prepare("SELECT payment_no FROM payments WHERE payment_no != '' ORDER BY id DESC LIMIT 1")
      .get()
    if (row?.payment_no) {
      const num = parseInt(row.payment_no.split('-').pop(), 10) + 1
      return `OR-${String(num).padStart(4, '0')}`
    }
  } catch { /* fall through */ }
  return 'OR-1001'
}

// ── App settings / export paths ──────────────────────────────────────────────

function getSetting(key) {
  try {
    const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key)
    return row?.value ?? ''
  } catch {
    return ''
  }
}

function makeExportDir(p) {
  fs.mkdirSync(p, { recursive: true })
  return p
}

export function getInvoiceExportPath() {
  const p = getSetting('invoice_export_path')
  return makeExportDir(p || path.join(process.cwd(), 'Exports', 'Invoices'))
}

export function getQuotationExportPath() {
  const p = getSetting('quotation_export_path')
  return makeExportDir(p || path.join(process.cwd(), 'Exports', 'Quotations'))
}

export function getStatementExportPath() {
  const p = getSetting('statement_export_path')
  return makeExportDir(p || path.join(process.cwd(), 'Exports', 'Statements'))
}

export function saveExportPaths(invoicePath, quotationPath, statementPath) {
  const stmt = getDb().prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  )
  stmt.run('invoice_export_path',   invoicePath)
  stmt.run('quotation_export_path', quotationPath)
  stmt.run('statement_export_path', statementPath)
}

// ── Dashboard stats (mirrors _DashboardFrame._get_stats) ─────────────────────

export function getDashboardStats() {
  const db = getDb()
  const [totalCnt, totalRev] = db
    .prepare('SELECT COUNT(*), COALESCE(SUM(total),0) FROM invoices')
    .raw().get()

  const [pending,  pendingCnt] = db.prepare(
    "SELECT COALESCE(SUM(total),0), COUNT(*) FROM invoices WHERE status='Pending'"
  ).raw().get()

  const [overdue,  overdueCnt] = db.prepare(
    "SELECT COALESCE(SUM(total),0), COUNT(*) FROM invoices WHERE status='Overdue'"
  ).raw().get()

  const [revenue] = db.prepare(
    "SELECT COALESCE(SUM(total),0) FROM invoices WHERE status='Paid'"
  ).raw().get()

  let totalPaid = 0
  try {
    const [p] = db.prepare('SELECT COALESCE(SUM(amount),0) FROM payments').raw().get()
    totalPaid = Number(p)
  } catch { /* payments table may not exist yet */ }

  return { revenue, pending, pendingCnt, overdue, overdueCnt, totalCnt, totalRev, totalPaid }
}

// ── Recent invoices (mirrors _DashboardFrame._get_recent) ────────────────────

export function getRecentInvoices(limit = 8) {
  return getDb()
    .prepare(
      'SELECT invoice_no, customer, date, total, status FROM invoices ORDER BY rowid DESC LIMIT ?'
    )
    .all(limit)
}

// ── Invoice CRUD ──────────────────────────────────────────────────────────────

export function listInvoices() {
  return getDb()
    .prepare(
      `SELECT invoice_no, customer, date, total, status, acc_code, address, attn, tel,
              terms, ref1, ref2, ref3, ref4
       FROM invoices ORDER BY rowid DESC`
    )
    .all()
}

export function getInvoice(invoice_no) {
  const db = getDb()
  const header = db
    .prepare('SELECT * FROM invoices WHERE invoice_no = ?')
    .get(invoice_no)
  if (!header) return null
  const items = db
    .prepare('SELECT * FROM invoice_items WHERE invoice_no = ? ORDER BY id')
    .all(invoice_no)
  return { ...header, items }
}

export function saveInvoice(header, items) {
  const db = getDb()
  const upsert = db.prepare(`
    INSERT INTO invoices
      (invoice_no, customer, date, total, address, attn, tel, acc_code,
       terms, ref1, ref2, ref3, ref4, status)
    VALUES (@invoice_no, @customer, @date, @total, @address, @attn, @tel,
            @acc_code, @terms, @ref1, @ref2, @ref3, @ref4, @status)
    ON CONFLICT(invoice_no) DO UPDATE SET
      customer   = excluded.customer,
      date       = excluded.date,
      total      = excluded.total,
      address    = excluded.address,
      attn       = excluded.attn,
      tel        = excluded.tel,
      acc_code   = excluded.acc_code,
      terms      = excluded.terms,
      ref1       = excluded.ref1,
      ref2       = excluded.ref2,
      ref3       = excluded.ref3,
      ref4       = excluded.ref4,
      status     = excluded.status
  `)
  const insertItem = db.prepare(`
    INSERT INTO invoice_items
      (invoice_no, description, po_no, qty, uom, uprice, subtotal)
    VALUES (@invoice_no, @description, @po_no, @qty, @uom, @uprice, @subtotal)
  `)
  const run = db.transaction(() => {
    upsert.run(header)
    db.prepare('DELETE FROM invoice_items WHERE invoice_no = ?').run(header.invoice_no)
    for (const item of items) {
      insertItem.run({ ...item, invoice_no: header.invoice_no })
    }
  })
  run()
  return { ok: true }
}

export function deleteInvoice(invoice_no) {
  const db = getDb()
  const run = db.transaction(() => {
    db.prepare('DELETE FROM invoice_items WHERE invoice_no = ?').run(invoice_no)
    db.prepare('DELETE FROM invoices WHERE invoice_no = ?').run(invoice_no)
  })
  run()
  return { ok: true }
}

export function updateInvoiceStatus(invoice_no, status) {
  getDb().prepare('UPDATE invoices SET status = ? WHERE invoice_no = ?').run(status, invoice_no)
  return { ok: true }
}

export function getNextInvoiceNo() {
  try {
    const row = getDb()
      .prepare("SELECT invoice_no FROM invoices WHERE invoice_no LIKE 'INV-%' ORDER BY rowid DESC LIMIT 1")
      .get()
    if (row?.invoice_no) {
      const num = parseInt(row.invoice_no.split('-').pop(), 10) + 1
      return `INV-${String(num).padStart(4, '0')}`
    }
  } catch { /* fall through */ }
  return 'INV-0001'
}

// ── Company Profile ───────────────────────────────────────────────────────────

export function getCompanyProfile() {
  try {
    return getDb().prepare('SELECT * FROM company_profile WHERE id=1').get()
  } catch (err) {
    return null
  }
}

export function saveCompanyProfile(profile) {
  getDb().prepare(`
    INSERT INTO company_profile (id, name, reg_no, address, tel, email, bank_info)
    VALUES (1, @name, @reg_no, @address, @tel, @email, @bank_info)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      reg_no = excluded.reg_no,
      address = excluded.address,
      tel = excluded.tel,
      email = excluded.email,
      bank_info = excluded.bank_info
  `).run(profile)
  return { ok: true }
}

// ── Quotation CRUD ────────────────────────────────────────────────────────────

export function listQuotations() {
  return getDb()
    .prepare(
      `SELECT quotation_no, customer, date, total, status, acc_code, address, attn, tel,
              terms, ref1, ref2
       FROM quotations ORDER BY rowid DESC`
    )
    .all()
}

export function getQuotation(quotation_no) {
  const db = getDb()
  const header = db
    .prepare('SELECT * FROM quotations WHERE quotation_no = ?')
    .get(quotation_no)
  if (!header) return null
  const items = db
    .prepare('SELECT * FROM quotation_items WHERE quotation_no = ? ORDER BY id')
    .all(quotation_no)
  return { ...header, items }
}

export function saveQuotation(header, items) {
  const db = getDb()
  const upsert = db.prepare(`
    INSERT INTO quotations
      (quotation_no, customer, date, total, address, attn, tel, acc_code,
       terms, ref1, ref2, status)
    VALUES (@quotation_no, @customer, @date, @total, @address, @attn, @tel,
            @acc_code, @terms, @ref1, @ref2, @status)
    ON CONFLICT(quotation_no) DO UPDATE SET
      customer   = excluded.customer,
      date       = excluded.date,
      total      = excluded.total,
      address    = excluded.address,
      attn       = excluded.attn,
      tel        = excluded.tel,
      acc_code   = excluded.acc_code,
      terms      = excluded.terms,
      ref1       = excluded.ref1,
      ref2       = excluded.ref2,
      status     = excluded.status
  `)
  const insertItem = db.prepare(`
    INSERT INTO quotation_items
      (quotation_no, description, qty, uom, uprice, subtotal)
    VALUES (@quotation_no, @description, @qty, @uom, @uprice, @subtotal)
  `)
  const run = db.transaction(() => {
    upsert.run(header)
    db.prepare('DELETE FROM quotation_items WHERE quotation_no = ?').run(header.quotation_no)
    for (const item of items) {
      insertItem.run({ ...item, quotation_no: header.quotation_no })
    }
  })
  run()
  return { ok: true }
}

export function deleteQuotation(quotation_no) {
  const db = getDb()
  const run = db.transaction(() => {
    db.prepare('DELETE FROM quotation_items WHERE quotation_no = ?').run(quotation_no)
    db.prepare('DELETE FROM quotations WHERE quotation_no = ?').run(quotation_no)
  })
  run()
  return { ok: true }
}

export function updateQuotationStatus(quotation_no, status) {
  getDb().prepare('UPDATE quotations SET status = ? WHERE quotation_no = ?').run(status, quotation_no)
  return { ok: true }
}

export function getNextQuotationNo() {
  try {
    const row = getDb()
      .prepare("SELECT quotation_no FROM quotations WHERE quotation_no LIKE 'QT-%' ORDER BY rowid DESC LIMIT 1")
      .get()
    if (row?.quotation_no) {
      const num = parseInt(row.quotation_no.split('-').pop(), 10) + 1
      return `QT-${String(num).padStart(4, '0')}`
    }
  } catch { /* fall through */ }
  return 'QT-0001'
}

// ── Close (called on app quit) ────────────────────────────────────────────────

export function closeDb() {
  if (_db) {
    _db.close()
    _db = null
  }
}
