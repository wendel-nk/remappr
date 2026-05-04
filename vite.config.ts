import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import pkg from './package.json' with {type: 'json'}
// https://vitejs.dev/config/
export default defineConfig( {
    base: '/', //todo remove it after finishing refactoring
    root: path.resolve( __dirname, 'src/renderer' ),
    publicDir: path.resolve( __dirname, 'public' ),
    plugins: [react(), tailwindcss()],
    define: {
        __APP_VERSION__: JSON.stringify( pkg.version ),
    },
    resolve: {
        alias: {
            '@': path.resolve( __dirname, './src/renderer/src' ),
            '@firmware': path.resolve( __dirname, './src/firmware' ),
            '@shared': path.resolve( __dirname, './src/shared' ),
        },
    },
    // prevent vite from obscuring rust errors
    clearScreen: false,
    // Tauri expects a fixed port, fail if that port is not available
    server: {
        strictPort: true,
    },
    // to access the Tauri environment variables set by the CLI with information about the current target
    envPrefix: [
        'VITE_',
        'TAURI_PLATFORM',
        'TAURI_ARCH',
        'TAURI_FAMILY',
        'TAURI_PLATFORM_VERSION',
        'TAURI_PLATFORM_TYPE',
        'TAURI_DEBUG',
    ],
    build: {
        outDir: path.resolve( __dirname, 'dist' ),
        chunkSizeWarningLimit: 1000, // todo remove after refactoring
        // Tauri uses Chromium on Windows and WebKit on macOS and Linux
        target: process.env.TAURI_PLATFORM
            ? process.env.TAURI_PLATFORM == 'windows'
                ? 'chrome105'
                : 'safari14'
            : 'esnext',
        // don't minify for debug builds
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        // produce sourcemaps for debug builds
        sourcemap: !!process.env.TAURI_DEBUG,
    },
} )
