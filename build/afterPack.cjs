/* eslint-disable @typescript-eslint/no-require-imports */
// pattern-check: skip — build hook trimming Chromium locale .pak files, no abstraction
const fs = require('fs')
const path = require('path')

// electronLanguages only prunes Chromium .pak locales on macOS. On Linux and
// Windows the full set (~44 MB) ships, so strip everything except the locales
// declared in build/electron-languages.json.
module.exports = async function afterPack(context) {
    const languagesFile = path.join(__dirname, 'electron-languages.json')
    const { languages } = JSON.parse(fs.readFileSync(languagesFile, 'utf8'))
    const keep = new Set(languages.map((l) => `${l}.pak`))

    const localesDir = path.join(context.appOutDir, 'locales')
    if (!fs.existsSync(localesDir)) return

    let removed = 0
    for (const file of fs.readdirSync(localesDir)) {
        if (!keep.has(file)) {
            fs.rmSync(path.join(localesDir, file))
            removed++
        }
    }
    console.log(`  • trimmed ${removed} unused Chromium locale .pak files`)
}
