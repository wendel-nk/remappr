// pattern-check: skip — extract bottom modal cluster JSX into a props-driven presentational component, no abstraction
// The cluster of overlays rendered at the bottom of the builder shell, extracted
// verbatim from Builder.tsx: the build-from modals (preset/grid/KLE/import), the
// export & library modals, settings, the start chooser, and the first-run tour.
// All visibility state + callbacks are threaded in as props; this holds no wiring.
import {
    GridModal,
    ImportModal,
    KleModal,
    PresetModal,
    StartModal,
} from './BuilderModals'
import { BuilderExportModal } from './BuilderExportModal'
import { LibraryModal } from './LibraryModal'
import { BuilderCoachmarkTour } from './BuilderCoachmarkTour'
import { Settings } from '@/components/modals/Settings'

export interface BuilderModalsClusterProps {
    buildModal: 'preset' | 'grid' | 'kle' | 'import' | null
    setBuildModal: (modal: 'preset' | 'grid' | 'kle' | 'import' | null) => void
    fromStart: boolean
    setFromStart: (v: boolean) => void
    backToStart: () => void
    openFromStart: (modal: 'preset' | 'kle' | 'import') => void
    exportOpen: boolean
    setExportOpen: (open: boolean) => void
    libraryOpen: boolean
    setLibraryOpen: (open: boolean) => void
    settingsOpen: boolean
    setSettingsOpen: (open: boolean) => void
    startOpen: boolean
    setStartOpen: (open: boolean) => void
    tourNonce: number
}

export function BuilderModalsCluster({
    buildModal,
    setBuildModal,
    fromStart,
    setFromStart,
    backToStart,
    openFromStart,
    exportOpen,
    setExportOpen,
    libraryOpen,
    setLibraryOpen,
    settingsOpen,
    setSettingsOpen,
    startOpen,
    setStartOpen,
    tourNonce,
}: BuilderModalsClusterProps): JSX.Element {
    return (
        <>
            {/* build-from modals */}
            <PresetModal
                open={buildModal === 'preset'}
                onClose={() => {
                    setBuildModal(null)
                    setFromStart(false)
                }}
                onBack={fromStart ? backToStart : undefined}
            />
            <GridModal
                open={buildModal === 'grid'}
                onClose={() => setBuildModal(null)}
            />
            <KleModal
                open={buildModal === 'kle'}
                onClose={() => {
                    setBuildModal(null)
                    setFromStart(false)
                }}
                onBack={fromStart ? backToStart : undefined}
            />
            <ImportModal
                open={buildModal === 'import'}
                onClose={() => {
                    setBuildModal(null)
                    setFromStart(false)
                }}
                onBack={fromStart ? backToStart : undefined}
            />

            {/* export & build + library */}
            <BuilderExportModal
                open={exportOpen}
                onClose={() => setExportOpen(false)}
            />
            <LibraryModal
                open={libraryOpen}
                onClose={() => {
                    setLibraryOpen(false)
                    setFromStart(false)
                }}
                onBack={fromStart ? backToStart : undefined}
            />
            {settingsOpen && (
                <Settings
                    opened={settingsOpen}
                    onClose={() => setSettingsOpen(false)}
                    sections={['general', 'keycaps', 'workspace', 'about']}
                />
            )}
            <StartModal
                open={startOpen}
                onClose={() => setStartOpen(false)}
                onPreset={() => openFromStart('preset')}
                onKle={() => openFromStart('kle')}
                onImport={() => openFromStart('import')}
                onLibrary={() => {
                    setFromStart(true)
                    setLibraryOpen(true)
                }}
            />
            {/* First-run guided tour — starts on the start chooser, then drives it. */}
            <BuilderCoachmarkTour
                replayNonce={tourNonce}
                onStartModal={setStartOpen}
            />
        </>
    )
}
