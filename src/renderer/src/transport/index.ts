// pattern-check: skip — barrel re-export replacing dead TransportManager class, no new logic
/**
 * Transport abstraction layer — single entry point for all platform transports.
 *
 * Platform detection and transport construction live in helpers/transports.ts.
 * This barrel re-exports the shared types and the built TRANSPORTS array so
 * consumers can import from '@/transport' regardless of backend (Browser,
 * Tauri, or Electron).
 */

export * from './types'
export { TRANSPORTS, isElectron, isTauri } from '../helpers/transports'
