const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

if (process.platform !== 'darwin') process.exit(0)

const root = path.resolve(__dirname, '..')
const source = path.join(root, 'src', 'native', 'macos-ble-helper.swift')
const infoPlist = path.join(root, 'build', 'macos-ble-helper-info.plist')
const output = path.join(root, 'build', 'macos-ble-helper')
const arm64 = `${output}-arm64`
const x64 = `${output}-x64`

function compile(target, destination) {
    execFileSync(
        'xcrun',
        [
            'swiftc',
            source,
            '-O',
            '-swift-version',
            '5',
            '-target',
            `${target}-apple-macosx13.0`,
            '-framework',
            'CoreBluetooth',
            '-framework',
            'Foundation',
            '-Xlinker',
            '-sectcreate',
            '-Xlinker',
            '__TEXT',
            '-Xlinker',
            '__info_plist',
            '-Xlinker',
            infoPlist,
            '-o',
            destination,
        ],
        { stdio: 'inherit' },
    )
}

try {
    compile('arm64', arm64)
    compile('x86_64', x64)
    execFileSync('lipo', ['-create', arm64, x64, '-output', output], {
        stdio: 'inherit',
    })
    fs.chmodSync(output, 0o755)
    console.log(`Built universal macOS BLE helper: ${output}`)
} finally {
    fs.rmSync(arm64, { force: true })
    fs.rmSync(x64, { force: true })
}
