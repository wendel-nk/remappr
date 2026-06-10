/* eslint-disable @typescript-eslint/no-require-imports */
// pattern-check: skip — mechanical fs cleanup script, no abstraction/new logic
//
// usocket is a Unix-only native addon (uses sys/ioctl.h + unix sockets) pulled
// in as an OPTIONAL dependency of dbus-next, which is itself Linux-only. The
// `os: [linux, darwin]` patch on usocket is not honored by pnpm under a frozen
// lockfile (the lockfile records os from registry metadata, not the patched
// manifest) nor by @electron/rebuild, so usocket still lands in node_modules on
// Windows and electron-builder's native rebuild fails compiling it.
//
// Since dbus-next is never used on Windows, strip usocket from the install tree
// on win32 BEFORE any electron rebuild runs (this script is the first half of
// the root `postinstall`). No-op on Linux/macOS, where usocket builds fine and
// dbus-next needs it.

const fs = require('fs')
const path = require('path')

if (process.platform !== 'win32') {
    process.exit(0)
}

const pnpmDir = path.join(__dirname, '..', 'node_modules', '.pnpm')

function rm(target) {
    try {
        fs.rmSync(target, { recursive: true, force: true })
        console.log(`strip-incompatible-native: removed ${path.relative(process.cwd(), target)}`)
    } catch (err) {
        console.warn(`strip-incompatible-native: could not remove ${target}: ${err.message}`)
    }
}

if (!fs.existsSync(pnpmDir)) {
    process.exit(0)
}

for (const entry of fs.readdirSync(pnpmDir)) {
    // The real package store dir, e.g. usocket@0.3.0_patch_hash=...
    if (entry.startsWith('usocket@')) {
        rm(path.join(pnpmDir, entry))
        continue
    }
    // The symlink dbus-next@x/node_modules/usocket pointing into the store.
    const linked = path.join(pnpmDir, entry, 'node_modules', 'usocket')
    if (fs.existsSync(linked)) {
        rm(linked)
    }
}
