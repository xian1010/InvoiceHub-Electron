/**
 * preload/index.js — contextBridge for renderer ↔ main IPC
 *
 * IMPORTANT: Electron's contextBridge.exposeInMainWorld supports nested objects
 * only when every leaf is a function — which is exactly our case.
 * However some older Electron versions have bugs with deep nesting.
 * To be safe we build each sub-namespace as a plain object of arrow functions
 * and then compose them into the top-level `api` object.
 */
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// ── Build API object ──────────────────────────────────────────────────────────

const invoices = {
  list:      ()              => ipcRenderer.invoke('invoice:list'),
  get:       (no)            => ipcRenderer.invoke('invoice:get', no),
  save:      (header, items) => ipcRenderer.invoke('invoice:save', header, items),
  delete:    (no)            => ipcRenderer.invoke('invoice:delete', no),
  setStatus: (no, status)    => ipcRenderer.invoke('invoice:setStatus', no, status),
  nextNo:    ()              => ipcRenderer.invoke('invoice:nextNo'),
  exportPdf: (data, shouldOpen = true)          => ipcRenderer.invoke('invoice:exportPdf', data, shouldOpen)
}

const customers = {
  list:       ()     => ipcRenderer.invoke('customers:list'),
  nextCode:   ()     => ipcRenderer.invoke('customers:nextCode'),
  save:       (c)    => ipcRenderer.invoke('customers:save', c),
  delete:     (id)   => ipcRenderer.invoke('customers:delete', id),
  findByName: (name) => ipcRenderer.invoke('customer:findByName', name)
}

const quotations = {
  list:      ()              => ipcRenderer.invoke('quotation:list'),
  get:       (no)            => ipcRenderer.invoke('quotation:get', no),
  save:      (header, items) => ipcRenderer.invoke('quotation:save', header, items),
  delete:    (no)            => ipcRenderer.invoke('quotation:delete', no),
  setStatus: (no, status)    => ipcRenderer.invoke('quotation:setStatus', no, status),
  nextNo:    ()              => ipcRenderer.invoke('quotation:nextNo'),
  exportPdf: (data, shouldOpen = true)          => ipcRenderer.invoke('quotation:exportPdf', data, shouldOpen)
}

const company = {
  get:  ()     => ipcRenderer.invoke('company:get'),
  save: (data) => ipcRenderer.invoke('company:save', data)
}

const products = {
  list:   ()       => ipcRenderer.invoke('products:list'),
  save:   (prod)   => ipcRenderer.invoke('products:save', prod),
  delete: (id)     => ipcRenderer.invoke('products:delete', id),
  find:   (desc)   => ipcRenderer.invoke('products:find', desc)
}

const receipts = {
  getCustomers: ()          => ipcRenderer.invoke('receipts:getCustomers'),
  list:         ()          => ipcRenderer.invoke('receipts:list'),
  save:         (payment)   => ipcRenderer.invoke('receipts:save', payment),
  delete:       (no)        => ipcRenderer.invoke('receipts:delete', no)
}

const statement = {
  getCustomers:      ()                           => ipcRenderer.invoke('statement:getCustomers'),
  fetchTransactions: (customer, fromDate, toDate)  => ipcRenderer.invoke('statement:fetchTransactions', customer, fromDate, toDate),
  exportPdf:         (data, shouldOpen = true)                        => ipcRenderer.invoke('statement:exportPdf', data, shouldOpen),
  listGenerated:     (customer)                   => ipcRenderer.invoke('statement:listGenerated', customer)
}

const ai = {
  extractPO: () => ipcRenderer.invoke('ai:extractPO')
}

const email = {
  getSettings:    ()     => ipcRenderer.invoke('email:getSettings'),
  saveSettings:   (s)    => ipcRenderer.invoke('email:saveSettings', s),
  testConnection: (s)    => ipcRenderer.invoke('email:testConnection', s),
  send:           (opts) => ipcRenderer.invoke('email:send', opts),
  listContacts:   ()     => ipcRenderer.invoke('email:listContacts'),
  upsertContact:  (e, n) => ipcRenderer.invoke('email:upsertContact', e, n)
}

const updater = {
  onUpdateAvailable:  (cb) => ipcRenderer.on('updater:available',  (_e, info) => cb(info)),
  onDownloadProgress: (cb) => ipcRenderer.on('updater:progress',   (_e, prog) => cb(prog)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('updater:downloaded', (_e, info) => cb(info)),
  onUpdateError:      (cb) => ipcRenderer.on('updater:error',      (_e, msg)  => cb(msg)),
  startDownload:      ()   => ipcRenderer.invoke('updater:startDownload'),
  installNow:         ()   => ipcRenderer.invoke('updater:installNow'),
  removeAllListeners: ()   => {
    ipcRenderer.removeAllListeners('updater:available')
    ipcRenderer.removeAllListeners('updater:progress')
    ipcRenderer.removeAllListeners('updater:downloaded')
    ipcRenderer.removeAllListeners('updater:error')
  }
}

// ── Expose ────────────────────────────────────────────────────────────────────

const api = {
  // Dashboard
  getDashboardStats:    ()              => ipcRenderer.invoke('db:getDashboardStats'),
  getRecentInvoices:    (limit)         => ipcRenderer.invoke('db:getRecentInvoices', limit),

  // Layout settings
  getLayoutSettings:    ()              => ipcRenderer.invoke('db:getLayoutSettings'),
  saveLayoutSettings:   (settings)      => ipcRenderer.invoke('db:saveLayoutSettings', settings),

  // Export paths
  getInvoiceExportPath:   ()            => ipcRenderer.invoke('db:getInvoiceExportPath'),
  getQuotationExportPath: ()            => ipcRenderer.invoke('db:getQuotationExportPath'),
  getStatementExportPath: ()            => ipcRenderer.invoke('db:getStatementExportPath'),
  getDefaultPaths:        ()            => ipcRenderer.invoke('db:getDefaultPaths'),
  saveExportPaths: (inv, quot, stmt)    => ipcRenderer.invoke('db:saveExportPaths', inv, quot, stmt),
  selectFolder: ()                      => ipcRenderer.invoke('dialog:selectFolder'),
  openFolder:   (p)                     => ipcRenderer.invoke('shell:openFolder', p),

  // Generic query helpers
  query: (sql, params)  => ipcRenderer.invoke('db:query', sql, params),
  run:   (sql, params)  => ipcRenderer.invoke('db:run',   sql, params),
  get:   (sql, params)  => ipcRenderer.invoke('db:get',   sql, params),

  // Utility
  getNextPaymentNo: ()  => ipcRenderer.invoke('db:getNextPaymentNo'),

  // ── Sub-namespaces ──────────────────────────────────────────────────────
  invoices,
  customers,
  quotations,
  company,
  products,
  receipts,
  statement,
  ai,
  email,
  updater
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (err) {
    console.error(err)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
