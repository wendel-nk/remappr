// Pattern check: no GoF pattern (-) — rejected — pure diff / validation helpers
// for the conditional-(tri-)layer editor; a whole-list overlay, nothing to build.
//
// Pure helpers for the conditional (tri-)layers editor. The .tsx modal stays a
// thin view over these; the diff helper turns the edited local list back into the
// whole list the concrete-service setConditionalLayers() takes (or null when
// nothing changed), and the validators gate Save on a well-formed, in-range set.
import type { CanonConditionalLayer } from '@firmware/config'

/** A fresh, empty tri-layer row for the editor's "add" action. */
export function emptyConditional(): CanonConditionalLayer {
    return { ifLayers: [], thenLayer: '' }
}

/** Add/remove `name` from an if-layer list (immutable). */
export function toggleIfLayer(ifLayers: string[], name: string): string[] {
    return ifLayers.includes(name)
        ? ifLayers.filter((n) => n !== name)
        : [...ifLayers, name]
}

const sameSet = (a: string[], b: string[]): boolean =>
    a.length === b.length && a.every((n) => b.includes(n))

/** Two tri-layers equal when their if-set matches (order-independent) and their
 *  then-layer is identical. */
export function sameConditional(
    a: CanonConditionalLayer,
    b: CanonConditionalLayer,
): boolean {
    return a.thenLayer === b.thenLayer && sameSet(a.ifLayers, b.ifLayers)
}

/** Two tri-layer lists equal when same length and pairwise equal in order. */
export function sameConditionalList(
    a: CanonConditionalLayer[],
    b: CanonConditionalLayer[],
): boolean {
    return a.length === b.length && a.every((c, i) => sameConditional(c, b[i]))
}

/** The edited list as the whole-list patch setConditionalLayers() takes, or null
 *  if it matches the committed list (nothing to push). */
export function conditionalLayersPatch(
    orig: CanonConditionalLayer[],
    edited: CanonConditionalLayer[],
): CanonConditionalLayer[] | null {
    return sameConditionalList(orig, edited)
        ? null
        : edited.map((c) => ({
              ifLayers: [...c.ifLayers],
              thenLayer: c.thenLayer,
          }))
}

/** First problem with the tri-layer set, or null when every row is well-formed and
 *  references only current layers. Bad refs throw on commit() anyway, but catching
 *  them here lets the UI name the offending row and block Save. */
export function conditionalError(
    list: CanonConditionalLayer[],
    layerNames: readonly string[],
): string | null {
    for (let i = 0; i < list.length; i++) {
        const c = list[i]
        const row = `Tri-layer ${i + 1}`
        if (c.ifLayers.length === 0)
            return `${row}: pick at least one "if" layer`
        if (!c.thenLayer) return `${row}: pick a "then" layer`
        const unknownIf = c.ifLayers.find((n) => !layerNames.includes(n))
        if (unknownIf) return `${row}: unknown layer "${unknownIf}"`
        if (!layerNames.includes(c.thenLayer))
            return `${row}: unknown layer "${c.thenLayer}"`
    }
    return null
}
