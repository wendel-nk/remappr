// Pattern check: no GoF pattern (-) — rejected — presentational firmware-readiness
// status chips with tooltips; reads checkCompleteness(config), no abstraction.
import { CheckCircle2, TriangleAlert, XCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { checkCompleteness } from '@firmware/config'
import type { ConfigKeymap } from '@firmware/config'
import { MiniLabel } from '../MiniLabel'

export function ReadinessSection({
    config,
}: {
    config: ConfigKeymap
}): JSX.Element {
    return (
        <div>
            <MiniLabel>Readiness</MiniLabel>
            <div className="flex flex-wrap gap-1.5">
                {checkCompleteness(config).map((r) => {
                    const hasError = r.issues.some((i) => i.level === 'error')
                    const status = hasError
                        ? 'error'
                        : r.issues.length > 0
                          ? 'warn'
                          : 'ok'
                    const Icon =
                        status === 'error'
                            ? XCircle
                            : status === 'warn'
                              ? TriangleAlert
                              : CheckCircle2
                    const tone =
                        status === 'error'
                            ? 'text-red-500'
                            : status === 'warn'
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                    return (
                        <Tooltip key={r.firmware}>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-bold focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <Icon size={13} className={tone} />
                                    {r.label}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent
                                side="left"
                                className="max-w-[220px]"
                            >
                                {r.issues.length === 0 ? (
                                    <span>Ready to build</span>
                                ) : (
                                    <ul className="space-y-0.5">
                                        {r.issues.map((i, idx) => (
                                            <li
                                                key={idx}
                                                className="flex items-start gap-1 leading-snug"
                                            >
                                                <span
                                                    className={
                                                        i.level === 'error'
                                                            ? 'text-red-400'
                                                            : 'text-amber-400'
                                                    }
                                                >
                                                    {i.level === 'error'
                                                        ? '✗'
                                                        : '!'}
                                                </span>
                                                {i.message}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    )
                })}
            </div>
        </div>
    )
}
