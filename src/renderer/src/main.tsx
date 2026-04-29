import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { silenceConsoleInProduction } from '@shared/logger.ts'
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
