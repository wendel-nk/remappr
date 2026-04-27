import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react-swc'
import pkg from './package.json' with { type: 'json' }

const versionDefine = { __APP_VERSION__: JSON.stringify(pkg.version) }

export default defineConfig({
    main: {
        define: versionDefine,
        build: {
            rollupOptions: {
                external: ['serialport'],
            },
        },
    },
    preload: { define: versionDefine },
    renderer: {
        define: versionDefine,
        resolve: {
            alias: {
                '@renderer': resolve('src/renderer/src'),
                '@': resolve('src/renderer/src'),
            },
        },
        plugins: [react()],
    },
})
