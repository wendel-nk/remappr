// pattern-check: skip — mechanical postinstall guard, no abstraction/new logic
//
// `electron-vite dev` dies with a bare "Error: Electron uninstall" when
// node_modules/electron has no dist/ + path.txt — i.e. the package is linked
// but its binary was never downloaded. That happens whenever pnpm re-links the
// hoisted tree from the store (adding/removing an unrelated dependency is
// enough): the store copy predates electron's own postinstall, so the download
// is gone and pnpm won't re-run a script it considers already built.
//
// Re-running electron's installer is cheap and idempotent — it restores from
// ~/.cache/electron without hitting the network when the zip is already there.

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron')
const installer = path.join(electronDir, 'install.js')
const pathTxt = path.join(electronDir, 'path.txt')

// No electron in the tree (web-only install) — nothing to guard.
if (!fs.existsSync(installer)) process.exit(0)

function binaryPresent() {
    if (!fs.existsSync(pathTxt)) return false
    const rel = fs.readFileSync(pathTxt, 'utf8').trim()
    if (!rel) return false
    return fs.existsSync(path.join(electronDir, 'dist', rel))
}

if (binaryPresent()) process.exit(0)

console.log('ensure-electron-binary: electron binary missing — downloading…')
const res = spawnSync(process.execPath, [installer], {
    cwd: electronDir,
    stdio: 'inherit',
})

if (res.status !== 0 || !binaryPresent()) {
    // Don't fail the whole install: a web-only contributor may have no network
    // for the electron mirror, and `pnpm dev` (renderer) works without it.
    console.warn(
        'ensure-electron-binary: could not install the electron binary. ' +
            'Run `node node_modules/electron/install.js` before `pnpm edev`.',
    )
}
