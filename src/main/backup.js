/**
 * backup.js — Auto-backup utility for InvoiceHub
 *
 * On every app start (production only), copies the live invoice.db into a
 * sibling folder next to the installation directory:
 *
 *   <installDir>/../Invoice_Backups/invoice_backup_YYYY-MM-DD.db
 *
 * Only one backup per calendar day is kept. Backups older than 7 days are
 * automatically pruned so the folder doesn't grow infinitely.
 *
 * This function is intentionally fire-and-forget — it logs but never throws,
 * so a backup failure can never prevent the app from starting.
 */

import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { getDbPath } from './db'

const MAX_BACKUPS = 7
const BACKUP_FOLDER_NAME = 'Invoice_Backups'
const BACKUP_PREFIX = 'invoice_backup_'
const BACKUP_EXT = '.db'

/**
 * Run the daily auto-backup.
 * Call this once from app.whenReady() — after the DB is initialised.
 */
export function runAutoBackup() {
  // Skip in dev mode — the dev DB is right next to the source
  if (!app.isPackaged) {
    console.log('[backup] Skipped — dev mode')
    return
  }

  try {
    // 1. Resolve paths
    const dbSource = getDbPath()
    if (!fs.existsSync(dbSource)) {
      console.warn('[backup] Source DB not found:', dbSource)
      return
    }

    const installDir = path.dirname(app.getPath('exe'))
    const backupDir = path.join(installDir, '..', BACKUP_FOLDER_NAME)

    // 2. Ensure the backup folder exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
      console.log('[backup] Created backup folder:', backupDir)
    }

    // 3. Build today's backup filename
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const backupName = `${BACKUP_PREFIX}${today}${BACKUP_EXT}`
    const backupPath = path.join(backupDir, backupName)

    // If today's backup already exists, skip (one backup per day)
    if (fs.existsSync(backupPath)) {
      console.log('[backup] Today\'s backup already exists:', backupName)
      cleanOldBackups(backupDir)
      return
    }

    // 4. Copy the database
    fs.copyFileSync(dbSource, backupPath)
    console.log('[backup] ✓ Backup created:', backupPath)

    // 5. Clean up old backups
    cleanOldBackups(backupDir)
  } catch (err) {
    // Never let a backup failure crash the app
    console.error('[backup] Auto-backup failed:', err.message)
  }
}

/**
 * Delete backups older than MAX_BACKUPS days.
 * Only touches files matching the naming pattern `invoice_backup_YYYY-MM-DD.db`.
 */
function cleanOldBackups(backupDir) {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith(BACKUP_PREFIX) && f.endsWith(BACKUP_EXT))
      .sort() // lexicographic sort on YYYY-MM-DD = chronological order

    if (files.length <= MAX_BACKUPS) return

    // Remove the oldest files, keeping only the most recent MAX_BACKUPS
    const toDelete = files.slice(0, files.length - MAX_BACKUPS)
    for (const file of toDelete) {
      fs.unlinkSync(path.join(backupDir, file))
      console.log('[backup] 🗑  Removed old backup:', file)
    }
  } catch (err) {
    console.error('[backup] Cleanup error:', err.message)
  }
}
