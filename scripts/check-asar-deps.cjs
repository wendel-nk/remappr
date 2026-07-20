// Fails the build when a module packaged inside app.asar declares a runtime
// dependency that was NOT packaged. electron-builder's pnpm node-modules
// collector has repeatedly dropped transitive deps ("duplicate dependency
// references" dedup bug): #143 shipped builds without `ms` (debug -> ms,
// required by serialport), and the electron-builder 26.8.1 lockfile pin
// regressed the exact same way in v0.0.16 — the app died on launch with
// "Cannot find module 'ms'" the moment the serial transport loaded. The
// packaging step itself succeeds, so without this check the breakage only
// surfaces on end-user machines.
//
// Usage: node scripts/check-asar-deps.cjs [dist-dir]
const fs = require('fs')
const path = require('path')

// @electron/asar is not a direct dependency — resolve it through
// electron-builder -> app-builder-lib so this works in both hoisted and
// isolated (pnpm) node_modules layouts.
const appBuilderLibDir = path.dirname(
    require.resolve('app-builder-lib/package.json', {
        paths: [path.dirname(require.resolve('electron-builder/package.json'))],
    }),
)
const asar = require(
    require.resolve('@electron/asar', { paths: [appBuilderLibDir] }),
)

// Packages reachable ONLY through pkg-prebuilds' CLI scripts (bin/*.mjs use
// yargs; the runtime entry bindings.js does not). electron-builder partially
// prunes this subtree, which is harmless — nothing requires it at runtime.
const CLI_ONLY = new Set([
    'yargs',
    'cliui',
    'wrap-ansi',
    'ansi-styles',
    'color-convert',
    'color-name',
    'string-width',
    'strip-ansi',
    'ansi-regex',
    'emoji-regex',
    'is-fullwidth-code-point',
    'y18n',
    'yargs-parser',
    'escalade',
    'get-caller-file',
    'require-directory',
])

function findAsars(dir) {
    const out = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name)
        if (entry.isDirectory()) out.push(...findAsars(p))
        else if (entry.name === 'app.asar') out.push(p)
    }
    return out
}

function moduleNameFromPath(p) {
    // node_modules/foo/package.json -> foo
    // node_modules/@scope/foo/package.json -> @scope/foo
    const m = p.match(/^\/?node_modules\/((?:@[^/]+\/)?[^/]+)\/package\.json$/)
    return m ? m[1] : null
}

function checkAsar(asarPath) {
    const files = asar.listPackage(asarPath, {})
    const pkgJsonPaths = files.filter((f) =>
        moduleNameFromPath(f.replace(/\\/g, '/')),
    )
    const packaged = new Map() // name -> package.json path inside asar
    for (const f of pkgJsonPaths) {
        const norm = f.replace(/\\/g, '/')
        packaged.set(moduleNameFromPath(norm), norm)
    }

    const missing = []
    const checkDeps = (fromLabel, pkg) => {
        const bundled = new Set(
            pkg.bundleDependencies || pkg.bundledDependencies || [],
        )
        const optional = new Set(Object.keys(pkg.optionalDependencies || {}))
        for (const dep of Object.keys(pkg.dependencies || {})) {
            if (bundled.has(dep) || optional.has(dep)) continue
            if (packaged.has(dep)) continue
            if (CLI_ONLY.has(dep)) continue
            missing.push(`${fromLabel} -> ${dep}`)
        }
    }

    // The app's own runtime deps must all be present…
    const rootPkg = JSON.parse(
        asar.extractFile(asarPath, 'package.json').toString(),
    )
    checkDeps(rootPkg.name || 'app', rootPkg)
    // …and every packaged module's declared deps must be present too.
    for (const [name, pkgPath] of packaged) {
        // A CLI-only package that happens to be packaged pulls in equally
        // CLI-only deps — don't demand its subtree.
        if (CLI_ONLY.has(name)) continue
        let pkg
        try {
            pkg = JSON.parse(
                asar
                    .extractFile(asarPath, pkgPath.replace(/^\//, ''))
                    .toString(),
            )
        } catch {
            continue // malformed/unreadable package.json — not a missing dep
        }
        checkDeps(name, pkg)
    }
    return { missing, count: packaged.size }
}

const distDir = path.resolve(process.argv[2] || 'dist')
const asars = findAsars(distDir)
if (asars.length === 0) {
    console.error(`check-asar-deps: no app.asar found under ${distDir}`)
    process.exit(1)
}

let failed = false
for (const asarPath of asars) {
    const { missing, count } = checkAsar(asarPath)
    const rel = path.relative(process.cwd(), asarPath)
    if (missing.length) {
        failed = true
        console.error(
            `check-asar-deps: ${rel} (${count} modules) is missing runtime dependencies:`,
        )
        for (const m of missing) console.error(`  ${m}`)
    } else {
        console.log(
            `check-asar-deps: ${rel} OK (${count} modules, closure complete)`,
        )
    }
}
process.exit(failed ? 1 : 0)
