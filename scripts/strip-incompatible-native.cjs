/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/explicit-function-return-type */ // plain CJS — no TS annotations
// pattern-check: skip — mechanical fs cleanup script, no abstraction/new logic
//
// usocket is a Unix-only native addon (uses sys/ioctl.h + unix sockets) pulled
// in as an OPTIONAL dependency of dbus-next, which is itself Linux-only. The
// `os: [linux, darwin]` patch on usocket is not honored by pnpm under a frozen
// lockfile (the lockfile records os from registry metadata, not the patched
// manifest) nor by @electron/rebuild, so usocket still lands in node_modules on
// Windows and electron-builder's native rebuild fails compiling it.
//
// Since dbus-next is never used on Windows (src/main/bluez.ts loads it lazily
// and returns early on non-Linux), strip usocket from the install tree on win32
// BEFORE any electron rebuild runs (this script is the first half of the root
// `postinstall`). No-op on Linux/macOS, where usocket builds fine and dbus-next
// needs it. Handles both pnpm layouts: hoisted (node-linker=hoisted, real dir
// at node_modules/usocket) and isolated (.pnpm store + symlinks).

const fs = require('fs')
const path = require('path')

if (process.platform !== 'win32') {
    process.exit(0)
}

const nodeModulesDir = path.join(__dirname, '..', 'node_modules')

function rm(target) {
    try {
        if (!fs.existsSync(target)) return
        fs.rmSync(target, { recursive: true, force: true })
        console.log(
            `strip-incompatible-native: removed ${path.relative(process.cwd(), target)}`,
        )
    } catch (err) {
        console.warn(
            `strip-incompatible-native: could not remove ${target}: ${err.message}`,
        )
    }
}

if (!fs.existsSync(nodeModulesDir)) {
    process.exit(0)
}

// Hoisted layout: real dir / symlink at the top level.
rm(path.join(nodeModulesDir, 'usocket'))

// Isolated (.pnpm) layout: the real store dir + per-package symlinks.
const pnpmDir = path.join(nodeModulesDir, '.pnpm')
if (fs.existsSync(pnpmDir)) {
    for (const entry of fs.readdirSync(pnpmDir)) {
        // The real package store dir, e.g. usocket@0.3.0_patch_hash=...
        if (entry.startsWith('usocket@')) {
            rm(path.join(pnpmDir, entry))
            continue
        }
        // A symlink like dbus-next@x/node_modules/usocket into the store.
        rm(path.join(pnpmDir, entry, 'node_modules', 'usocket'))
    }
}
