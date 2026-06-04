import React, { useEffect, useState } from 'react'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/ui/dialog'
import { Button } from '@/ui/button'
import { cn } from '@/lib/cn'

// Create a forwardRef wrapper for span
const TextTrigger = React.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement>
>(
    ({ className, ...props }, ref): JSX.Element => (
        <span
            ref={ref}
            className={`underline-offset-4 cursor-pointer ${className || ''}`}
            {...props}
        />
    ),
)
TextTrigger.displayName = 'TextTrigger'

export interface ModernModalProps {
    opened?: boolean
    onClose?: () => void | Promise<void>
    onOk?: () => void | Promise<void>
    type?: 'button' | 'text' | 'icon'
    icon?: JSX.Element
    variant?:
        | 'default'
        | 'destructive'
        | 'outline'
        | 'secondary'
        | 'ghost'
        | 'link'
    customModalBoxClass?: string
    text?: string | React.ReactNode
    xButton?: boolean
    close?: string | boolean
    success?: string | boolean
    title?: string
    /** Design-style header: small line-icon shown in a tinted chip beside the title. */
    headerIcon?: JSX.Element
    /** Muted one-line caption under the title in the header. */
    subtitle?: string
    description?: string
    /** Custom footer content. Overrides the default Cancel/OK footer when provided. */
    footer?: React.ReactNode
    children?: React.ReactNode
    isDismissable?: boolean
    showFooter?: boolean
}

export function Modal({
    opened,
    onClose,
    onOk,
    type = 'button',
    text,
    icon,
    variant = 'default',
    customModalBoxClass = '',
    xButton = true,
    close = 'Cancel',
    success = 'OK',
    showFooter = true,
    title,
    headerIcon,
    subtitle,
    description,
    footer,
    children,
    isDismissable = false,
}: ModernModalProps): JSX.Element {
    const isControlled = opened !== undefined
    const [isOpen, setIsOpen] = useState(opened ?? false)

    // Update internal state when opened prop changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (isControlled) setIsOpen(opened ?? false)
    }, [opened, isControlled])

    const handleClose = (): void => {
        setIsOpen(false)
        onClose?.()
    }

    const handleOk = async (): Promise<void> => {
        if (onOk) {
            await onOk()
        }
        handleClose()
    }

    const handleOpenChange = (open: boolean): void => {
        setIsOpen(open)
        if (!open) {
            onClose?.()
        }
    }

    const blockDismiss = (e: Event): void => e.preventDefault()

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            {!isControlled && type == 'button' && (
                <DialogTrigger asChild>
                    <Button variant={variant} className="cursor-pointer">
                        {text}
                    </Button>
                </DialogTrigger>
            )}
            {!isControlled && type == 'text' && (
                <DialogTrigger asChild>
                    <TextTrigger>{text}</TextTrigger>
                </DialogTrigger>
            )}
            {!isControlled && type == 'icon' && (
                <DialogTrigger asChild>
                    <Button
                        variant={variant}
                        size="icon"
                        className="cursor-pointer"
                    >
                        {icon}
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent
                // Design-prototype modal chrome: top-aligned (not vertically
                // centered), 16px radius, soft drop shadow, body scrolls when tall.
                // twMerge lets these override the shadcn Dialog base classes.
                className={cn(
                    'top-[7vh] max-h-[86vh] translate-y-0 overflow-y-auto rounded-2xl shadow-[0_30px_70px_-20px_rgba(0,0,0,0.7)]',
                    customModalBoxClass,
                )}
                showCloseButton={xButton}
                {...(isDismissable
                    ? {
                          onEscapeKeyDown: blockDismiss,
                          onPointerDownOutside: blockDismiss,
                          onInteractOutside: blockDismiss,
                      }
                    : {})}
            >
                <DialogHeader
                    className={cn(
                        title || headerIcon
                            ? 'flex-row items-center gap-3 space-y-0 border-b pb-4 text-left'
                            : 'sr-only',
                    )}
                >
                    {headerIcon && (
                        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary/15 text-primary [&_svg]:size-[18px]">
                            {headerIcon}
                        </span>
                    )}
                    <div className="flex flex-col gap-0.5">
                        <DialogTitle
                            className={cn(headerIcon && 'text-base font-bold')}
                        >
                            {title}
                        </DialogTitle>
                        <DialogDescription
                            className={cn(
                                subtitle && 'text-xs',
                                !(subtitle || description) && 'sr-only',
                            )}
                        >
                            {subtitle ?? description}
                        </DialogDescription>
                    </div>
                </DialogHeader>
                {children}
                {footer ? (
                    <DialogFooter className="border-t pt-4">
                        {footer}
                    </DialogFooter>
                ) : (
                    showFooter && (
                        <DialogFooter>
                            {close && (
                                <DialogClose asChild>
                                    <Button
                                        variant="outline"
                                        onClick={handleClose}
                                    >
                                        {close}
                                    </Button>
                                </DialogClose>
                            )}
                            {success && (
                                <Button type="submit" onClick={handleOk}>
                                    {success}
                                </Button>
                            )}
                        </DialogFooter>
                    )
                )}
            </DialogContent>
        </Dialog>
    )
}
