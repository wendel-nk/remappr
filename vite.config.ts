import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import pkg from './package.json' with { type: 'json' }
// https://vitejs.dev/config/
export default defineConfig({
    base: '/', //todo remove it after finishing refactoring
    root: path.resolve(__dirname, 'src/renderer'),
    publicDir: path.resolve(__dirname, 'public'),
    plugins: [react(), tailwindcss()],
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src/renderer/src'),
            '@firmware': path.resolve(__dirname, './src/firmware'),
            '@shared': path.resolve(__dirname, './src/shared'),
        },
    },
    envPrefix: ['VITE_'],
    build: {
        outDir: path.resolve(__dirname, 'dist'),
        chunkSizeWarningLimit: 1000, // todo remove after refactoring
        target: 'esnext',
        minify: 'esbuild',
    },
})
