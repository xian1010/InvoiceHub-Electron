/**
 * updater.js — Auto-update module using electron-updater
 *
 * Handles checking for updates, downloading, and notifying the renderer
 * process through IPC events. Updates are fetched from GitHub Releases.
 */

import { autoUpdater } from 'electron-updater'
import { ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'

let mainWin = null

/**
 * Initialize the auto-updater. Call once after the main window is ready.
 * @param {BrowserWindow} win — the main BrowserWindow instance
 */
export function initAutoUpdater(win) {
  mainWin = win

  // ── Configuration ────────────────────────────────────────────────────────
  autoUpdater.autoDownload = false          // Ask user first, don't silently download
  autoUpdater.autoInstallOnAppQuit = true   // Install pending update when user quits
  autoUpdater.allowDowngrade = false

  // In dev mode, skip actual update checks to avoid noise
  if (is.dev) {
    console.log('[updater] Dev mode — skipping auto-update check')
    return
  }

  // ── Logging ──────────────────────────────────────────────────────────────
  autoUpdater.logger = {
    info:  (...args) => console.log('[updater]', ...args),
    warn:  (...args) => console.warn('[updater]', ...args),
    error: (...args) => console.error('[updater]', ...args),
    debug: (...args) => console.log('[updater:debug]', ...args)
  }

  // ── Events → Renderer ───────────────────────────────────────────────────

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for update…')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update available:', info.version)
    send('updater:available', {
      version:      info.version,
      releaseDate:  info.releaseDate,
      releaseNotes: info.releaseNotes || ''
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] Already on latest version:', info.version)
  })

  autoUpdater.on('download-progress', (progress) => {
    send('updater:progress', {
      percent:    Math.round(progress.percent),
      transferred: progress.transferred,
      total:       progress.total,
      speed:       progress.bytesPerSecond
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] Download complete:', info.version)
    send('updater:downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err?.message || err)
    send('updater:error', err?.message || 'Unknown update error')
  })

  // ── IPC handlers from renderer ──────────────────────────────────────────

  ipcMain.handle('updater:startDownload', () => {
    console.log('[updater] User confirmed — starting download')
    autoUpdater.downloadUpdate()
  })

  ipcMain.handle('updater:installNow', () => {
    console.log('[updater] User requested restart to install')
    autoUpdater.quitAndInstall(false, true)   // isSilent=false, isForceRunAfter=true
  })

  // ── Kick off the first check ────────────────────────────────────────────
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[updater] Initial check failed:', err?.message || err)
  })
}

/** Helper: safely send event to renderer */
function send(channel, data) {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(channel, data)
  }
}
