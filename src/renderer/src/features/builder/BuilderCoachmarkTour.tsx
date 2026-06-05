// Pattern check: no GoF pattern (-) — rejected — first-run spotlight tour stepping
// over data-coach target rects with a tooltip card, gated on a persisted store flag
// + an imperative replay nonce. Effect + render logic, no abstraction warranted.
//
// The Keyboard Builder's guided first-run tour. It mirrors the editor's
// onboarding/CoachmarkTour spotlight technique (box-shadow scrim + primary ring)
// but is mounted inside FullScreenBuilder so its data-coach targets are guaranteed
// to exist, persists "seen" in userSettingsStore instead of a bare localStorage
// key, and waits for the start chooser to close before it begins. The "?" toolbar
// button replays it by bumping `replayNonce`.
import { useEffect, useLayoutEffect, useState } from 'react'
import { Button } from '@/ui/button'
import useUserSettingsStore from '@/stores/userSettingsStore'
import {
    BUILDER_TOUR_STEPS,
    isLastTourStep,
    nextTourStep,
    prevTourStep,
} from './builderTourSteps'

interface Rect {
    top: number
    left: number
    width: number
    height: number
}

export function BuilderCoachmarkTour({
    ready,
    replayNonce,
}: {
    /** Gate auto-start until the builder is interactive (start chooser closed). */
    ready: boolean
    /** Bumped by the toolbar "?" button to replay; the initial 0 never starts it. */
    replayNonce: number
}): JSX.Element | null {
    const seen = useUserSettingsStore((s) => s.seenBuilderTour)
    const setSeen = useUserSettingsStore((s) => s.setSeenBuilderTour)
    const [active, setActive] = useState(false)
    const [step, setStep] = useState(0)
    const [rect, setRect] = useState<Rect | null>(null)

    // Auto-start once, the first time the builder is interactive for a user who
    // hasn't seen it. Deferred so the target elements have laid out.
    useEffect(() => {
        if (!ready || seen) return
        const t = setTimeout(() => {
            setStep(0)
            setActive(true)
        }, 600)
        return () => clearTimeout(t)
    }, [ready, seen])

    // Replay on demand (skip the initial mount value of 0). Deferred a tick so
    // the restart happens outside the effect body (no synchronous setState).
    useEffect(() => {
        if (replayNonce === 0) return
        const t = setTimeout(() => {
            setStep(0)
            setActive(true)
        }, 0)
        return () => clearTimeout(t)
    }, [replayNonce])

    const total = BUILDER_TOUR_STEPS.length
    const current = BUILDER_TOUR_STEPS[step]

    useLayoutEffect(() => {
        if (!active) return
        const measure = (): void => {
            if (!current.selector) {
                setRect(null)
                return
            }
            const el = document.querySelector(current.selector)
            if (!el) {
                setRect(null)
                return
            }
            const r = el.getBoundingClientRect()
            setRect({
                top: r.top,
                left: r.left,
                width: r.width,
                height: r.height,
            })
        }
        measure()
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
    }, [active, step, current.selector])

    if (!active) return null

    const finish = (): void => {
        setSeen(true)
        setActive(false)
    }
    const isLast = isLastTourStep(step, total)
    const next = (): void =>
        isLast ? finish() : setStep((s) => nextTourStep(s, total))
    const back = (): void => setStep((s) => prevTourStep(s))

    // Spotlight padding around the target.
    const pad = 6
    const spot = rect
        ? {
              top: rect.top - pad,
              left: rect.left - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
          }
        : null

    // Position the card near the target (below if room, else above); centred otherwise.
    const cardStyle: React.CSSProperties = spot
        ? spot.top + spot.height + 220 < window.innerHeight
            ? {
                  top: spot.top + spot.height + 12,
                  left: Math.min(
                      Math.max(12, spot.left),
                      window.innerWidth - 332,
                  ),
              }
            : {
                  top: Math.max(12, spot.top - 200),
                  left: Math.min(
                      Math.max(12, spot.left),
                      window.innerWidth - 332,
                  ),
              }
        : {
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
          }

    return (
        <div className="fixed inset-0 z-[2000]">
            {/* Click-blocker (transparent) so the builder is paused during the tour. */}
            <div className="absolute inset-0" />
            {spot ? (
                <div
                    aria-hidden
                    className="absolute rounded-lg"
                    style={{
                        ...spot,
                        boxShadow:
                            '0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 2px var(--primary)',
                        pointerEvents: 'none',
                        transition: 'all 0.2s ease',
                    }}
                />
            ) : (
                <div className="absolute inset-0 bg-black/60" />
            )}
            <div
                className="absolute w-80 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-2xl"
                style={cardStyle}
            >
                <div className="text-sm font-semibold">{current.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">
                    {current.body}
                </p>
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                        {step + 1} / {total}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={finish}>
                            Skip
                        </Button>
                        {step > 0 && (
                            <Button variant="outline" size="sm" onClick={back}>
                                Back
                            </Button>
                        )}
                        <Button size="sm" onClick={next}>
                            {isLast ? 'Done' : 'Next'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
