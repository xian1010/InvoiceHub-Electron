import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'path'
import path from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initAutoUpdater } from './updater'
import {
  getDashboardStats,
  getRecentInvoices,
  getLayoutSettings,
  saveLayoutSettings,
  getNextPaymentNo,
  getInvoiceExportPath,
  getQuotationExportPath,
  getStatementExportPath,
  saveExportPaths,
  getDefaultPaths,
  getDb,
  getDbPath,
  closeDb,
  listInvoices,
  getInvoice,
  saveInvoice,
  deleteInvoice,
  updateInvoiceStatus,
  getNextInvoiceNo,
  getCompanyProfile,
  saveCompanyProfile,
  listQuotations,
  getQuotation,
  saveQuotation,
  deleteQuotation,
  updateQuotationStatus,
  getNextQuotationNo,
  listProducts,
  saveProduct,
  deleteProduct,
  findProductByDesc,
  getEmailSettings,
  saveEmailSettings,
  listEmailContacts,
  upsertEmailContact
} from './db'
import { extractPoData, extractInvoiceData } from './ai'
import { testEmailConnection, sendEmail } from './email'
import { runAutoBackup } from './backup'
import { spawn } from 'child_process'
import fs from 'fs'

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',   // macOS-style frameless feel
    backgroundColor: '#F5F5F7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => {
    win.maximize()
    win.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.ysunique.invoicehub')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()

  const mainWin = createWindow()

  // Check for updates 3s after window is ready (let UI load first)
  setTimeout(() => initAutoUpdater(mainWin), 3000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Auto-backup: save latest DB to sibling Invoice_Backups folder before quitting
  runAutoBackup()
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC handlers ──────────────────────────────────────────────────────────────

function registerIpcHandlers() {
  // Open a folder in system file explorer
  ipcMain.handle('shell:openFolder', (_, folderPath) => shell.openPath(folderPath))

  // Dashboard
  ipcMain.handle('db:getDashboardStats',  () => getDashboardStats())
  ipcMain.handle('db:getRecentInvoices',  (_, limit) => getRecentInvoices(limit))

  // Layout settings
  ipcMain.handle('db:getLayoutSettings',  () => getLayoutSettings())
  ipcMain.handle('db:saveLayoutSettings', (_, settings) => saveLayoutSettings(settings))

  // Export paths
  ipcMain.handle('db:getInvoiceExportPath',   () => getInvoiceExportPath())
  ipcMain.handle('db:getQuotationExportPath', () => getQuotationExportPath())
  ipcMain.handle('db:getStatementExportPath', () => getStatementExportPath())
  ipcMain.handle('db:getDefaultPaths',        () => getDefaultPaths())
  ipcMain.handle('db:saveExportPaths', (_, inv, quot, stmt) =>
    saveExportPaths(inv, quot, stmt))

  // Folder picker dialog
  ipcMain.handle('dialog:selectFolder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select Export Folder',
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || !filePaths.length) return null
    return filePaths[0]
  })

  // Generic query helpers (renderer calls these for CRUD pages)
  ipcMain.handle('db:query', (_, sql, params = []) => {
    return getDb().prepare(sql).all(...params)
  })
  ipcMain.handle('db:run', (_, sql, params = []) => {
    return getDb().prepare(sql).run(...params)
  })
  ipcMain.handle('db:get', (_, sql, params = []) => {
    return getDb().prepare(sql).get(...params)
  })

  // Utility
  ipcMain.handle('db:getNextPaymentNo', () => getNextPaymentNo())

  // ── Invoice CRUD ──────────────────────────────────────────────────────────
  ipcMain.handle('invoice:list',         ()            => listInvoices())
  ipcMain.handle('invoice:get',          (_, no)       => getInvoice(no))
  ipcMain.handle('invoice:save',         (_, hdr, itm) => saveInvoice(hdr, itm))
  ipcMain.handle('invoice:delete',       (_, no)       => deleteInvoice(no))
  ipcMain.handle('invoice:setStatus',    (_, no, st)   => updateInvoiceStatus(no, st))
  ipcMain.handle('invoice:nextNo',       ()            => getNextInvoiceNo())

  // ── Customer lookup ───────────────────────────────────────────────────────
  ipcMain.handle('customer:findByName', (_, name) => {
    if (!name) return null
    return getDb()
      .prepare(`SELECT acc_code, name, address, tel, attn FROM customers WHERE name LIKE ? LIMIT 1`)
      .get(`%${name}%`)
  })

  // ── Customers CRUD ────────────────────────────────────────────────────────
  ipcMain.handle('customers:list', () => {
    return getDb()
      .prepare('SELECT id, acc_code, name, address, tel, attn FROM customers ORDER BY acc_code')
      .all()
  })

  ipcMain.handle('customers:nextCode', () => {
    const row = getDb()
      .prepare("SELECT acc_code FROM customers ORDER BY id DESC LIMIT 1")
      .get()
    try {
      const num = parseInt(row.acc_code.split('-')[1], 10) + 1
      return `300-${String(num).padStart(4, '0')}`
    } catch {
      return '300-0001'
    }
  })

  ipcMain.handle('customers:save', (_, customer) => {
    const db = getDb()
    if (customer.id) {
      db.prepare(
        `UPDATE customers
         SET acc_code=@acc_code, name=@name, address=@address, tel=@tel, attn=@attn
         WHERE id=@id`
      ).run(customer)
    } else {
      db.prepare(
        `INSERT INTO customers (acc_code, name, address, tel, attn)
         VALUES (@acc_code, @name, @address, @tel, @attn)`
      ).run(customer)
    }
    return { ok: true }
  })

  ipcMain.handle('customers:delete', (_, id) => {
    getDb().prepare('DELETE FROM customers WHERE id=?').run(id)
    return { ok: true }
  })

  // ── Company Profile ───────────────────────────────────────────────────────
  ipcMain.handle('company:get', () => getCompanyProfile())
  ipcMain.handle('company:save', (_, data) => saveCompanyProfile(data))

  // ── Products CRUD ─────────────────────────────────────────────────────────
  ipcMain.handle('products:list',        ()        => listProducts())
  ipcMain.handle('products:save',        (_, prod) => saveProduct(prod))
  ipcMain.handle('products:delete',      (_, id)   => deleteProduct(id))
  ipcMain.handle('products:find',        (_, desc) => findProductByDesc(desc))

  // ── Email System ──────────────────────────────────────────────────────────
  ipcMain.handle('email:getSettings',    () => getEmailSettings())
  ipcMain.handle('email:saveSettings',   (_, s) => saveEmailSettings(s))
  ipcMain.handle('email:testConnection', (_, s) => testEmailConnection(s))
  ipcMain.handle('email:send',           (_, opts) => sendEmail(opts))
  ipcMain.handle('email:listContacts',   () => listEmailContacts())
  ipcMain.handle('email:upsertContact',  (_, e, n) => upsertEmailContact(e, n))

  // ── Quotations CRUD ───────────────────────────────────────────────────────
  ipcMain.handle('quotation:list',         ()            => listQuotations())
  ipcMain.handle('quotation:get',          (_, no)       => getQuotation(no))
  ipcMain.handle('quotation:save',         (_, hdr, itm) => saveQuotation(hdr, itm))
  ipcMain.handle('quotation:delete',       (_, no)       => deleteQuotation(no))
  ipcMain.handle('quotation:setStatus',    (_, no, st)   => updateQuotationStatus(no, st))
  ipcMain.handle('quotation:nextNo',       ()            => getNextQuotationNo())

  // ── Receipts / Payments ──────────────────────────────────────────────────
  ipcMain.handle('receipts:getCustomers', () => {
    return getDb()
      .prepare(`
        SELECT name FROM customers
        UNION
        SELECT DISTINCT customer FROM invoices
        WHERE customer IS NOT NULL AND customer != ''
        ORDER BY 1
      `)
      .all()
      .map(r => r.name)
  })

  ipcMain.handle('receipts:list', () => {
    return getDb()
      .prepare(
        `SELECT id, payment_no, date, customer, acc_code,
                payment_method, ref, amount, notes
         FROM payments ORDER BY id DESC LIMIT 50`
      )
      .all()
  })

  ipcMain.handle('receipts:save', (_, payment) => {
    const cust = getDb()
      .prepare('SELECT acc_code FROM customers WHERE name=? LIMIT 1')
      .get(payment.customer)
    getDb()
      .prepare(
        `INSERT INTO payments
           (date, customer, acc_code, amount, ref, notes, payment_no, payment_method)
         VALUES (@date, @customer, @acc_code, @amount, @ref, @notes, @payment_no, @payment_method)`
      )
      .run({ ...payment, acc_code: cust?.acc_code || '' })
    return { ok: true }
  })

  ipcMain.handle('receipts:delete', (_, paymentNo) => {
    getDb().prepare('DELETE FROM payments WHERE payment_no=?').run(paymentNo)
    return { ok: true }
  })

  // ── Statement of Account ─────────────────────────────────────────────────

  ipcMain.handle('statement:listGenerated', async (_, customer) => {
    try {
      const exportDir = resolveExportDir(getStatementExportPath, 'Statements')
      if (!fs.existsSync(exportDir)) return []
      
      const safeCustomer = customer.replace(/[\\/:*?"<>|]/g, '').slice(0, 30).trim()
      const files = fs.readdirSync(exportDir)
      const results = []
      
      for (const file of files) {
        if (file.toLowerCase().endsWith('.pdf') && file.includes(safeCustomer)) {
          const stats = fs.statSync(join(exportDir, file))
          results.push({
            name: file,
            path: join(exportDir, file),
            size: stats.size,
            mtime: stats.mtimeMs
          })
        }
      }
      return results.sort((a,b) => b.mtime - a.mtime)
    } catch (e) {
      console.error(e)
      return []
    }
  })

  // Distinct customer list (customers table UNION invoice customers)
  ipcMain.handle('statement:getCustomers', () => {
    return getDb()
      .prepare(`
        SELECT name FROM customers
        UNION
        SELECT DISTINCT customer FROM invoices
        WHERE customer IS NOT NULL AND customer != ''
        ORDER BY 1
      `)
      .all()
      .map(r => r.name)
  })

  // Fetch opening balance + all transactions in [fromDate, toDate]
  ipcMain.handle('statement:fetchTransactions', (_, customer, fromDate, toDate) => {
    const db = getDb()

    // Since dates in V2 are natively stored as YYYY-MM-DD (via <input type="date">),
    // we can use standard string comparison without D2ISO formatting.

    // Opening balance: invoices before fromDate
    const [obDebit]  = db
      .prepare(`SELECT COALESCE(SUM(total),0) FROM invoices WHERE customer=? AND date<?`)
      .raw().get(customer, fromDate)
    // Opening balance: payments before fromDate
    const [obCredit] = db
      .prepare(`SELECT COALESCE(SUM(amount),0) FROM payments WHERE customer=? AND date<?`)
      .raw().get(customer, fromDate)
    const openingBalance = Number(obDebit) - Number(obCredit)

    // Invoices in range
    const invRows = db
      .prepare(`
        SELECT date, invoice_no, total FROM invoices
        WHERE customer=? AND date>=? AND date<=?
        ORDER BY date, invoice_no
      `)
      .all(customer, fromDate, toDate)

    // Payments in range
    const pmtRows = db
      .prepare(`
        SELECT date, ref, amount, notes FROM payments
        WHERE customer=? AND date>=? AND date<=?
        ORDER BY date, id
      `)
      .all(customer, fromDate, toDate)

    const txns = [
      ...invRows.map(r => ({
        date:        r.date,
        description: 'Sales Invoice',
        ref_no:      r.invoice_no,
        debit:       Number(r.total  || 0),
        credit:      0,
        type:        'debit'
      })),
      ...pmtRows.map(r => ({
        date:        r.date,
        description: r.notes || 'Payment Received',
        ref_no:      r.ref   || '',
        debit:       0,
        credit:      Number(r.amount || 0),
        type:        'credit'
      }))
    ]

    // Sort — normalise DD/MM/YYYY dates to ISO for comparison
    const toIso = d =>
      d && d.length === 10 && d[2] === '/'
        ? `${d.slice(6)}-${d.slice(3, 5)}-${d.slice(0, 2)}`
        : (d || '')
    txns.sort((a, b) => {
      const da = toIso(a.date), db2 = toIso(b.date)
      return da < db2 ? -1 : da > db2 ? 1 : a.ref_no < b.ref_no ? -1 : 1
    })

    // Compute running balance
    let running = openingBalance
    for (const t of txns) {
      running += t.debit - t.credit
      t.balance = running
    }

    return { openingBalance, txns }
  })

  // ── AI OCR ────────────────────────────────────────────────────────────────
  // Opens native file picker, then sends image to VectorEngine API
  ipcMain.handle('ai:extractPO', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'AI Smart Recognition — Select PO Image or PDF',
      filters: [
        { name: 'Images & PDFs', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'] }
      ],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    return extractPoData(filePaths[0])
  })

  // ── Python PDF Bridge ─────────────────────────────────────────────────────
  // Helper: resolve export dir (DB setting → fallback) and ensure it exists
  function resolveExportDir(dbPathFn, fallbackSub) {
    let dir = ''
    try { dir = dbPathFn() } catch {}
    if (!dir) {
      const root = is.dev ? join(process.cwd(), '..') : process.resourcesPath
      dir = join(root, 'Exports', fallbackSub)
    }
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  // Helper: build environment for Python subprocess so db_utils.py finds the right DB
  function getPyEnv() {
    const env = { ...process.env }
    // Always pass the DB path confirmed by db.js
    env.INVOICEHUB_DB_PATH = getDbPath()
    return env
  }

  ipcMain.handle('invoice:exportPdf', async (_, invoiceData, shouldOpen = true) => {
    return new Promise((resolve, reject) => {
      try {
        const exportDir = resolveExportDir(getInvoiceExportPath, 'Invoices')
        invoiceData._export_dir = exportDir

        const tmpPath = join(app.getPath('temp'), `inv_export_${Date.now()}.json`)
        fs.writeFileSync(tmpPath, JSON.stringify(invoiceData))

        let py
        if (is.dev) {
          const pyScript = join(process.cwd(), '..', 'pdf_invoice.py')
          const wrapperScript = join(app.getPath('temp'), `pdf_wrapper_${Date.now()}.py`)
          const wrapperContent = `
import sys, json, os
sys.path.append(os.path.dirname(r"${pyScript}"))
from pdf_invoice import generate_pdf
with open(r"${tmpPath}", "r", encoding="utf-8") as f:
    data = json.load(f)
out_path = generate_pdf(data)
print("SUCCESS:" + out_path)
`
          fs.writeFileSync(wrapperScript, wrapperContent)
          py = spawn('python', [wrapperScript])
          py.on('close', () => { try { fs.unlinkSync(wrapperScript) } catch {} })
        } else {
          const exe = join(process.resourcesPath, 'bin', 'pdf_invoice.exe')
          py = spawn(exe, [tmpPath], { env: getPyEnv() })
        }

        let stdout = '', stderr = ''
        py.stdout.on('data', d => stdout += d.toString())
        py.stderr.on('data', d => stderr += d.toString())
        py.on('error', (err) => {
          try { fs.unlinkSync(tmpPath) } catch {}
          reject(new Error(err.code === 'ENOENT' ? 'Python / PDF engine not found.' : err.message))
        })
        py.on('close', (code) => {
          try { fs.unlinkSync(tmpPath) } catch {}
          if (code === 0 && stdout.includes('SUCCESS:')) {
            const pdfPath = stdout.split('SUCCESS:')[1].trim()
            if (shouldOpen) { shell.openPath(pdfPath) }
            resolve({ ok: true, path: pdfPath })
          } else {
            reject(new Error(stderr || stdout || 'Unknown Python error'))
          }
        })
      } catch (err) {
        reject(err)
      }
    })
  })

  ipcMain.handle('quotation:exportPdf', async (_, quotationData, shouldOpen = true) => {
    return new Promise((resolve, reject) => {
      try {
        const exportDir = resolveExportDir(getQuotationExportPath, 'Quotations')
        quotationData._export_dir = exportDir

        const tmpPath = join(app.getPath('temp'), `quot_export_${Date.now()}.json`)
        fs.writeFileSync(tmpPath, JSON.stringify(quotationData))

        let py
        if (is.dev) {
          const pyScript = join(process.cwd(), '..', 'pdf_quotation.py')
          const wrapperScript = join(app.getPath('temp'), `pdf_quot_wrapper_${Date.now()}.py`)
          const wrapperContent = `
import sys, json, os
sys.path.append(os.path.dirname(r"${pyScript}"))
from pdf_quotation import generate_quotation_pdf
with open(r"${tmpPath}", "r", encoding="utf-8") as f:
    data = json.load(f)
out_path = generate_quotation_pdf(data)
print("SUCCESS:" + out_path)
`
          fs.writeFileSync(wrapperScript, wrapperContent)
          py = spawn('python', [wrapperScript])
          py.on('close', () => { try { fs.unlinkSync(wrapperScript) } catch {} })
        } else {
          const exe = join(process.resourcesPath, 'bin', 'pdf_quotation.exe')
          py = spawn(exe, [tmpPath], { env: getPyEnv() })
        }

        let stdout = '', stderr = ''
        py.stdout.on('data', d => stdout += d.toString())
        py.stderr.on('data', d => stderr += d.toString())
        py.on('error', (err) => {
          try { fs.unlinkSync(tmpPath) } catch {}
          reject(new Error(err.code === 'ENOENT' ? 'Python / PDF engine not found.' : err.message))
        })
        py.on('close', (code) => {
          try { fs.unlinkSync(tmpPath) } catch {}
          if (code === 0 && stdout.includes('SUCCESS:')) {
            const pdfPath = stdout.split('SUCCESS:')[1].trim()
            if (shouldOpen) { shell.openPath(pdfPath) }
            resolve({ ok: true, path: pdfPath })
          } else {
            reject(new Error(stderr || stdout || 'Unknown Python error'))
          }
        })
      } catch (err) {
        reject(err)
      }
    })
  })

  ipcMain.handle('statement:exportPdf', async (_, statementData, shouldOpen = true) => {
    return new Promise((resolve, reject) => {
      try {
        const exportDir = resolveExportDir(getStatementExportPath, 'Statements')
        statementData._export_dir = exportDir

        const tmpPath = join(app.getPath('temp'), `stmt_export_${Date.now()}.json`)
        fs.writeFileSync(tmpPath, JSON.stringify(statementData))

        let py
        if (is.dev) {
          const pyScript = join(process.cwd(), '..', 'pdf_statement.py')
          const wrapperScript = join(app.getPath('temp'), `pdf_stmt_wrapper_${Date.now()}.py`)
          const wrapperContent = `
import sys, json, os
sys.path.append(os.path.dirname(r"${pyScript}"))
from pdf_statement import generate_statement_pdf
with open(r"${tmpPath}", "r", encoding="utf-8") as f:
    data = json.load(f)
c = data.get("customer", "")
fd = data.get("from_date", "")
td = data.get("to_date", "")
ob = float(data.get("opening_balance", 0))
rows = data.get("transactions", [])
export_dir = data.get("_export_dir", "")
out_path = generate_statement_pdf(c, fd, td, ob, rows, export_dir=export_dir)
print("SUCCESS:" + out_path)
`
          fs.writeFileSync(wrapperScript, wrapperContent)
          py = spawn('python', [wrapperScript])
          py.on('close', () => { try { fs.unlinkSync(wrapperScript) } catch {} })
        } else {
          const exe = join(process.resourcesPath, 'bin', 'pdf_statement.exe')
          py = spawn(exe, [tmpPath], { env: getPyEnv() })
        }

        let stdout = '', stderr = ''
        py.stdout.on('data', d => stdout += d.toString())
        py.stderr.on('data', d => stderr += d.toString())
        py.on('error', (err) => {
          try { fs.unlinkSync(tmpPath) } catch {}
          reject(new Error(err.code === 'ENOENT' ? 'Python / PDF engine not found.' : err.message))
        })
        py.on('close', (code) => {
          try { fs.unlinkSync(tmpPath) } catch {}
          if (code === 0 && stdout.includes('SUCCESS:')) {
            const pdfPath = stdout.split('SUCCESS:')[1].trim()
            if (shouldOpen) { shell.openPath(pdfPath) }
            resolve({ ok: true, path: pdfPath })
          } else {
            reject(new Error(stderr || stdout || 'Unknown Python error'))
          }
        })
      } catch (err) {
        reject(err)
      }
    })
  })

  // ── Bulk PDF Recovery ────────────────────────────────────────────────────
  ipcMain.handle('recovery:selectFolder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select folder containing Invoice PDFs',
      properties: ['openDirectory']
    })
    if (canceled || !filePaths.length) return null
    // Count PDFs in the folder
    const folder = filePaths[0]
    const pdfs = fs.readdirSync(folder).filter(f => f.toLowerCase().endsWith('.pdf'))
    return { folder, count: pdfs.length }
  })

  ipcMain.handle('recovery:bulkFromPdf', async (event, folderPath) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const db = getDb()
    const files = fs.readdirSync(folderPath)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => join(folderPath, f))

    const results = { total: files.length, processed: 0, saved: 0, skipped: 0, errors: [] }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileName = path.basename(file)

      // Send progress to renderer
      if (win && !win.isDestroyed()) {
        win.webContents.send('recovery:progress', {
          current: i + 1,
          total: files.length,
          fileName,
          status: 'processing'
        })
      }

      try {
        const data = await extractInvoiceData(file)

        if (!data.invoice_no) {
          results.errors.push({ file: fileName, error: 'No invoice number found' })
          results.processed++
          continue
        }

        // Duplicate check
        const existing = db.prepare('SELECT invoice_no FROM invoices WHERE invoice_no = ?').get(data.invoice_no)
        if (existing) {
          results.skipped++
          results.processed++
          console.log(`[recovery] Skipped ${data.invoice_no} — already exists`)
          continue
        }

        // Build header for saveInvoice
        const header = {
          invoice_no: data.invoice_no,
          customer:   data.customer,
          date:       data.date,
          total:      data.total,
          address:    data.address,
          attn:       data.attn,
          tel:        data.tel,
          acc_code:   data.acc_code,
          terms:      data.terms,
          ref1:       data.ref1,
          ref2:       data.ref2,
          ref3:       '',
          ref4:       '',
          status:     'Paid'   // Recovered invoices are historical, mark as Paid
        }

        saveInvoice(header, data.items)
        results.saved++
        results.processed++
        console.log(`[recovery] Saved ${data.invoice_no} (${data.items.length} items)`)

      } catch (err) {
        results.errors.push({ file: fileName, error: err.message || String(err) })
        results.processed++
        console.error(`[recovery] Error processing ${fileName}:`, err.message)
      }
    }

    // Send final completion signal
    if (win && !win.isDestroyed()) {
      win.webContents.send('recovery:progress', {
        current: files.length,
        total: files.length,
        fileName: '',
        status: 'done'
      })
    }

    return results
  })
}
