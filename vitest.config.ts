import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts'],
        deps: {
            // Handle ESM/CJS interop issues
            interopDefault: true,
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src/renderer/src'),
            'protobufjs/minimal': 'protobufjs/minimal.js',
        },
    },
})
