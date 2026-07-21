const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

if (process.platform !== 'win32') process.exit(0)

const root = path.resolve(__dirname, '..')
const project = path.join(
    root,
    'src',
    'native',
    'windows-ble-helper',
    'WindowsBleHelper.csproj',
)
const publishDir = path.join(
    root,
    'src',
    'native',
    'windows-ble-helper',
    'bin',
    'publish',
)
const source = path.join(publishDir, 'windows-ble-helper.exe')
const output = path.join(root, 'build', 'windows-ble-helper.exe')

execFileSync(
    'dotnet',
    [
        'publish',
        project,
        '--configuration',
        'Release',
        '--runtime',
        'win-x64',
        '--self-contained',
        'true',
        '--output',
        publishDir,
        '-p:PublishSingleFile=true',
        '-p:DebugType=None',
        '-p:DebugSymbols=false',
    ],
    { stdio: 'inherit' },
)

fs.copyFileSync(source, output)
console.log(`Built Windows BLE helper: ${output}`)
