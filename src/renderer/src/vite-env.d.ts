/// <reference types="vite/client" />

declare const __APP_VERSION__: string

declare namespace React {
    interface CSSProperties {
        WebkitAppRegion?: 'drag' | 'no-drag'
    }
}
