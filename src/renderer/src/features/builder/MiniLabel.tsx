// pattern-check: skip presentational label extracted verbatim from BuilderMetaForm/BuilderInspector (dedupe)
import React from 'react'

/** Small uppercase section label used across the builder's side panels. */
export function MiniLabel({
    children,
}: {
    children: React.ReactNode
}): JSX.Element {
    return (
        <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            {children}
        </div>
    )
}
