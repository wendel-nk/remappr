import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { silenceConsoleInProduction } from '@shared/logger.ts'
// Remappr is this app's primary firmware — register it first so the Electron
// HID transport's single-filter discovery (hidDiscovery() returns the first
// registered adapter's filter) targets the Remappr vendor interface
// (0x1209 / usage page 0xFF00). Without this import the adapter was never
// registered, so getAdapters() had no Remappr entry and every connect failed.
import '@firmware/remappr'
import '@firmware/qmk-vial'
import '@firmware/keychron'
import '@firmware/qmk'
import '@firmware/zmk'
import '@firmware/mock'
import './index.css'

silenceConsoleInProduction()

ReactDOM.createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
