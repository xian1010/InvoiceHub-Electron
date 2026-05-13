/**
 * scripts/postinstall.mjs
 *
 * Runs after `npm install` to ensure both native binaries are ready
 * without requiring Visual Studio / node-gyp:
 *
 *  1. Electron binary   — downloaded by electron's own install.js
 *  2. better-sqlite3    — Electron-targeted prebuilt via prebuild-install
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(fileURLToPath(import.meta.url), '../..')

// ── 1. Electron binary ────────────────────────────────────────────────────────

const electronExe   = join(root, 'node_modules/electron/dist/electron.exe')
const electronInstall = join(root, 'node_modules/electron/install.js')

if (!existsSync(electronExe) && existsSync(electronInstall)) {
  console.log('[postinstall] Downloading Electron binary…')
  try {
    execSync(`node "${electronInstall}"`, { stdio: 'inherit', cwd: root })
    console.log('[postinstall] ✓ Electron binary installed.')
  } catch (err) {
    console.error('[postinstall] ✗ Electron download failed:', err.message)
  }
} else {
  console.log('[postinstall] ✓ Electron binary already present.')
}

// ── 2. better-sqlite3 Electron prebuilt ──────────────────────────────────────

const binaryPath  = join(root, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node')
const prebuildBin = join(root, 'node_modules/prebuild-install/bin.js')
const electronPkg = join(root, 'node_modules/electron/package.json')

if (existsSync(binaryPath)) {
  console.log('[postinstall] ✓ better-sqlite3 binary already present.')
  process.exit(0)
}

if (!existsSync(prebuildBin)) {
  console.warn('[postinstall] prebuild-install not found — skipping sqlite3.')
  process.exit(0)
}

let electronVersion = '33.4.11'
try {
  const pkg = JSON.parse(readFileSync(electronPkg, 'utf8'))
  electronVersion = pkg.version
} catch {
  console.warn('[postinstall] Could not read Electron version, using fallback:', electronVersion)
}

console.log(`[postinstall] Downloading better-sqlite3 prebuilt for Electron ${electronVersion}…`)

const cmd = [
  'node', JSON.stringify(prebuildBin),
  '--runtime=electron',
  `--target=${electronVersion}`,
  '--arch=x64',
  '--dist-url=https://electronjs.org/headers',
  '--tag-prefix=v'
].join(' ')

try {
  execSync(cmd, { stdio: 'inherit', cwd: join(root, 'node_modules/better-sqlite3') })
  console.log('[postinstall] ✓ better-sqlite3 prebuilt installed.')
} catch (err) {
  console.error('[postinstall] ✗ Failed:', err.message)
  process.exit(1)
}
