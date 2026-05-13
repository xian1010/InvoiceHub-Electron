/**
 * scripts/install-sqlite.mjs
 *
 * Postinstall script — downloads the correct Electron prebuilt for
 * better-sqlite3 without needing Visual Studio / node-gyp.
 *
 * Reads the target Electron version from node_modules/electron/package.json
 * so it always stays in sync when Electron is upgraded.
 */

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const root        = resolve(fileURLToPath(import.meta.url), '../..')
const binaryPath  = join(root, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node')
const prebuildBin = join(root, 'node_modules/prebuild-install/bin.js')
const electronPkg = join(root, 'node_modules/electron/package.json')

// Already installed — skip
if (existsSync(binaryPath)) {
  console.log('[install-sqlite] ✓ better-sqlite3 binary already present, skipping download.')
  process.exit(0)
}

if (!existsSync(prebuildBin)) {
  console.warn('[install-sqlite] prebuild-install not found — skipping.')
  process.exit(0)
}

// Resolve Electron version from installed package
let electronVersion = '33.4.11'
try {
  const pkg = JSON.parse(readFileSync(electronPkg, 'utf8'))
  electronVersion = pkg.version
} catch {
  console.warn('[install-sqlite] Could not read Electron version, using fallback:', electronVersion)
}

console.log(`[install-sqlite] Downloading better-sqlite3 prebuilt for Electron ${electronVersion}…`)

const cmd = [
  'node', JSON.stringify(prebuildBin),
  '--runtime=electron',
  `--target=${electronVersion}`,
  '--arch=x64',
  '--dist-url=https://electronjs.org/headers',
  '--tag-prefix=v',
  '--verbose'
].join(' ')

try {
  execSync(cmd, { stdio: 'inherit', cwd: join(root, 'node_modules/better-sqlite3') })
  console.log('[install-sqlite] ✓ Prebuilt binary installed successfully.')
} catch (err) {
  console.error('[install-sqlite] ✗ Failed to download prebuilt:', err.message)
  console.error('  → If you have Visual Studio build tools, run: npm run rebuild')
  process.exit(1)
}
