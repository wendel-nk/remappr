// Pattern check: no GoF pattern (-) — rejected — additive zustand store slice for per-index macro/combo label overlays, mirrors existing connectionStore shape, no abstraction.
//
// Holds device-derived (auto) and user-defined (override) labels for
// each macro / combo slot. Picker tabs read this store to enrich the
// static MC_*/DM_*/COMBO_* tiles with the user's real names ("Open
// Slack" instead of "M0"). The future macros/combos editor menu
// writes here after committing changes via service.macros.setMacro /
// service.dynamic.setCombo, then calls refresh() — picker re-renders
// automatically through the zustand subscription.
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { KeyboardService } from '@firmware/service'

interface DynamicLabel {
    label: string
    description?: string
}

interface DynamicCatalogState {
    // Auto-derived from device on connect (Vial macro contents, ZMK
    // &macro_* / &combo_* behavior names). Wiped on disconnect.
    macroOverlays: Record<number, DynamicLabel>
    comboOverlays: Record<number, DynamicLabel>
    // User-defined names — future editor writes here. Take precedence
    // over overlays when present.
    macroLabels: Record<number, string>
    comboLabels: Record<number, string>
    setMacroOverlays: (next: Record<number, DynamicLabel>) => void
    setComboOverlays: (next: Record<number, DynamicLabel>) => void
    setMacroLabel: (idx: number, label: string) => void
    setComboLabel: (idx: number, label: string) => void
    refresh: (svc: KeyboardService | null) => Promise<void>
    reset: () => void
}

const useDynamicCatalogStore = create<DynamicCatalogState>()(
    devtools((set) => ({
        macroOverlays: {},
        comboOverlays: {},
        macroLabels: {},
        comboLabels: {},
        setMacroOverlays: (macroOverlays) => set({ macroOverlays }),
        setComboOverlays: (comboOverlays) => set({ comboOverlays }),
        setMacroLabel: (idx, label) =>
            set((s) => ({ macroLabels: { ...s.macroLabels, [idx]: label } })),
        setComboLabel: (idx, label) =>
            set((s) => ({ comboLabels: { ...s.comboLabels, [idx]: label } })),
        refresh: async (svc) => {
            if (!svc) {
                set({ macroOverlays: {}, comboOverlays: {} })
                return
            }
            const [macros, combos] = await Promise.all([
                fetchMacroOverlays(svc),
                fetchComboOverlays(svc),
            ])
            set({ macroOverlays: macros, comboOverlays: combos })
        },
        reset: () =>
            set({
                macroOverlays: {},
                comboOverlays: {},
                macroLabels: {},
                comboLabels: {},
            }),
    })),
)

// Resolve the display label for a macro index — user override beats
// device-derived overlay beats the static slot's own label.
export const resolveMacroLabel = (
    idx: number,
    state: DynamicCatalogState,
    fallback: string,
): string =>
    state.macroLabels[idx] ?? state.macroOverlays[idx]?.label ?? fallback

export const resolveComboLabel = (
    idx: number,
    state: DynamicCatalogState,
    fallback: string,
): string =>
    state.comboLabels[idx] ?? state.comboOverlays[idx]?.label ?? fallback

async function fetchMacroOverlays(
    svc: KeyboardService,
): Promise<Record<number, DynamicLabel>> {
    const out: Record<number, DynamicLabel> = {}
    if (svc.macros) {
        const count = svc.macros.getCount()
        for (let i = 0; i < count; i++) {
            try {
                const actions = await svc.macros.getMacro(i)
                const text = actions
                    .map((a) =>
                        a.kind === 'text' && typeof a.text === 'string'
                            ? a.text
                            : '',
                    )
                    .join('')
                    .trim()
                if (text) out[i] = { label: text.slice(0, 16) }
            } catch (err) {
                console.warn(`getMacro(${i}) failed`, err)
            }
        }
    }
    return out
}

async function fetchComboOverlays(
    svc: KeyboardService,
): Promise<Record<number, DynamicLabel>> {
    const out: Record<number, DynamicLabel> = {}
    const counts = svc.dynamic?.getCounts()
    if (svc.dynamic && counts && counts.combo > 0) {
        for (let i = 0; i < counts.combo; i++) {
            try {
                const entry = await svc.dynamic.getCombo(i)
                const activeKeys = entry.keys.filter((k) => k !== 0).length
                if (entry.output !== 0 && activeKeys >= 2) {
                    out[i] = {
                        label: `Combo ${i}`,
                        description: `${activeKeys}-key combo`,
                    }
                }
            } catch (err) {
                console.warn(`getCombo(${i}) failed`, err)
            }
        }
    }
    return out
}

export default useDynamicCatalogStore
