import { MutableRefObject, useEffect, useRef } from 'react'

export function useModalRef(
    open: boolean,
    closeOnOutsideClick?: boolean,
    allowCancel?: boolean,
): MutableRefObject<HTMLDialogElement | null> {
    const ref = useRef<HTMLDialogElement | null>(null)

    const reopen = async (): Promise<void> => {
        // We do this in a timeout so it runs after the modal has actually closed.
        setTimeout((): void => {
            ref.current?.showModal()
        })
    }

    useEffect((): void | (() => void) => {
        if (open) {
            if (ref.current && !ref.current?.open) {
                ref.current?.showModal()
                if (allowCancel !== undefined && !allowCancel) {
                    ref.current?.addEventListener('cancel', reopen)
                }
            }
            if (closeOnOutsideClick) {
                const handleClickOutside = (e: MouseEvent): void => {
                    const target = e.target as HTMLDialogElement | null
                    if (!target) return

                    const { top, left, width, height } =
                        target.getBoundingClientRect()
                    const clickedInDialog =
                        top <= e.clientY &&
                        e.clientY <= top + height &&
                        left <= e.clientX &&
                        e.clientX <= left + width

                    if (!clickedInDialog) {
                        target.close()
                    }
                }

                document.addEventListener('mousedown', handleClickOutside)
                return (): void => {
                    document.removeEventListener(
                        'mousedown',
                        handleClickOutside,
                    )
                }
            }
        } else {
            ref.current?.close()
            ref.current?.removeEventListener('cancel', reopen)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, closeOnOutsideClick])

    return ref
}
