// pattern-check: skip — barrel re-export, mechanical rename TRANSPORTS -> getTransports
/**
 * Transport abstraction layer — single entry point for all platform transports.
 *
 * Platform detection and transport construction live in helpers/transports.ts.
 * This barrel re-exports the shared types and the lazy getTransports() getter so
 * consumers can import from '@/transport' regardless of backend (Browser,
 * Tauri, or Electron).
 */

export * from './types'
export { getTransports, isElectron, isTauri } from '../helpers/transports'
