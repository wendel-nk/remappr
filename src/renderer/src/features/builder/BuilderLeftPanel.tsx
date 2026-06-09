// pattern-check: skip — extract left tools aside JSX into a props-driven presentational component, no abstraction
// The collapsible 270px left tools panel, extracted verbatim from Builder.tsx:
// Layers + Build-from + Identity sections. Build-from buttons open a build modal
// (via setBuildModal) or commit an added key; everything else is self-contained
// presentation over the existing BuilderLayersPanel / BuilderMetaForm.
import type { ConfigKeymap } from '@firmware/config'
import { addKey } from './geometryEditor'
import { BuildButton, SectionTitle } from './builderChrome'
import { BuilderLayersPanel } from './BuilderLayersPanel'
import { BuilderMetaForm } from './BuilderMetaForm'

export interface BuilderLeftPanelProps {
    config: ConfigKeymap | null
    commit: (config: ConfigKeymap) => void
    setBuildModal: (modal: 'preset' | 'grid' | 'kle' | 'import' | null) => void
}

export function BuilderLeftPanel({
    config,
    commit,
    setBuildModal,
}: BuilderLeftPanelProps): JSX.Element {
    return (
        <aside className="flex w-[270px] shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar">
            <div
                className="border-b border-border p-3.5"
                data-coach="builder-layers"
            >
                <SectionTitle>Layers</SectionTitle>
                <div className="mt-2.5">
                    <BuilderLayersPanel />
                </div>
                <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    Geometry &amp; matrix are shared across all layers.
                </p>
            </div>
            <div
                className="border-b border-border p-3.5"
                data-coach="builder-build-from"
            >
                <SectionTitle>Build from</SectionTitle>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                    <BuildButton
                        label="Presets"
                        onClick={() => setBuildModal('preset')}
                    />
                    <BuildButton
                        label="Import KLE"
                        onClick={() => setBuildModal('kle')}
                    />
                    <BuildButton
                        label="Make grid"
                        onClick={() => setBuildModal('grid')}
                    />
                    <BuildButton
                        label="Add key"
                        onClick={() => config && commit(addKey(config))}
                    />
                </div>
            </div>
            <div className="p-4">
                <SectionTitle>Identity</SectionTitle>
                <div className="mt-3">
                    <BuilderMetaForm />
                </div>
            </div>
        </aside>
    )
}
