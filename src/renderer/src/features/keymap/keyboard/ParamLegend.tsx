// pattern-check: skip — one shared presentational span, extracted to dedupe

/** The cap legend for a non-HID parameter (layer name, enum text, macro name).
 *  Renders as a block that clips over-long text to an ellipsis, while `title`
 *  carries the full value for the native tooltip. Shared by the editor stage
 *  and the layout preview so the two render identically. */
export function ParamLegend({
    text,
    title,
}: {
    text: string
    title?: string
}): JSX.Element {
    return (
        <span
            className="font-bold block w-full text-center leading-tight overflow-hidden text-ellipsis whitespace-nowrap"
            title={title}
        >
            {text}
        </span>
    )
}
