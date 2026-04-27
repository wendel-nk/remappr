/* eslint-disable @typescript-eslint/no-require-imports */
// pattern-check: skip — build config script loading JSON language list, no abstraction
const path = require('path')
const fs = require('fs')

const languagesFile = path.join(__dirname, 'build', 'electron-languages.json')
const { languages } = JSON.parse(fs.readFileSync(languagesFile, 'utf8'))

if (!Array.isArray(languages) || languages.length === 0) {
    throw new Error(
        `electron-languages.json must contain a non-empty "languages" array (got: ${JSON.stringify(
            languages,
        )})`,
    )
}

/** @type {import('electron-builder').Configuration} */
module.exports = {
    appId: 'dev.remappr.app',
    productName: 'Remappr',
    compression: 'maximum',
    electronLanguages: languages,
    removePackageScripts: true,
    removePackageKeywords: true,
    directories: {
        buildResources: 'build',
    },
    files: [
        '!**/.vscode/*',
        '!src/*',
        '!src-tauri/**/*',
        '!scripts/**/*',
        '!.storybook/**/*',
        '!stories/**/*',
        '!**/*.stories.{js,jsx,ts,tsx,mdx}',
        '!**/*.test.{js,jsx,ts,tsx}',
        '!**/*.spec.{js,jsx,ts,tsx}',
        '!**/__tests__/**/*',
        '!**/__mocks__/**/*',
        '!**/*.map',
        '!**/.git/**/*',
        '!**/.github/**/*',
        '!**/coverage/**/*',
        '!**/docs/**/*',
        '!electron.vite.config.{js,ts,mjs,cjs}',
        '!vite.config.{js,ts,mjs,cjs}',
        '!vitest.config.{js,ts,mjs,cjs}',
        '!eslint.config.{js,mjs,cjs}',
        '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md,LICENSE,LICENSE.md}',
        '!{.env,.env.*,.npmrc,pnpm-lock.yaml,bun.lockb,yarn.lock,package-lock.json}',
        '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}',
        '!release.config.json',
        '!.release-manifest.json',
        '!build/electron-languages.json',
    ],
    asarUnpack: ['resources/**'],
    win: {
        executableName: 'app',
    },
    nsis: {
        artifactName: '${name}-electron-${version}-setup.${ext}',
        shortcutName: '${productName}',
        uninstallDisplayName: '${productName}',
        createDesktopShortcut: 'always',
    },
    mac: {
        entitlementsInherit: 'build/entitlements.mac.plist',
        extendInfo: {
            NSBluetoothAlwaysUsageDescription:
                'Remappr uses Bluetooth to connect to ZMK keyboards over BLE.',
        },
        notarize: false,
    },
    dmg: {
        artifactName: '${name}-electron-${version}.${ext}',
    },
    linux: {
        target: ['AppImage', 'deb'],
        maintainer: 'electronjs.org',
        category: 'Utility',
    },
    appImage: {
        artifactName: '${name}-electron-${version}.${ext}',
    },
    deb: {
        artifactName: '${name}-electron-${version}.${ext}',
    },
    npmRebuild: true,
    publish: {
        provider: 'generic',
        url: 'https://example.com/auto-updates',
    },
}
