/// <reference types="electron-vite/node" />

declare module '*?asset' {
    const src: string
    export default src
}

declare const __APP_VERSION__: string
