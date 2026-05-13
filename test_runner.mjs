// ── test_runner.js ─────────────────────────────────────────────────────────
import fs from 'fs'
import path from 'path'
import { spawnSync, spawn } from 'child_process'
import Database from 'better-sqlite3'

// 1. Mock Electron for DB functions
const mockApp = {
  isPackaged: false,
  getPath: (name) => path.join(process.cwd(), '.test_userData'),
}

// Write a small wrapper to run DB tests from within the electron context
// to avoid ESM/Electron import issues in plain Node.js.
// We'll write an electron script to execute.

const scriptContent = `
const { app, ipcMain } = require('electron');
const path = require('path');
app.whenReady().then(async () => {
  try {
    // Dynamic import to support ES modules if the project uses type: module or electron-vite
    // Actually, in electron-vite, src/main is usually bundled or requires special loader.
    // Instead of messing with imports, let's just test the DB directly using better-sqlite3 in plain JS.
    console.log("READY_TO_TEST");
  } catch(e) {
    console.error(e);
  } finally {
    app.quit();
  }
});
`;
