import React, { useEffect, useState } from 'react'
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
    DialogClose,
} from '@/ui/dialog.tsx'
import { Button } from '@/ui/button.tsx'

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
    description?: string
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
    description,
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
                className={customModalBoxClass}
                showCloseButton={xButton}
                {...(isDismissable
                    ? {
                          onEscapeKeyDown: blockDismiss,
                          onPointerDownOutside: blockDismiss,
                          onInteractOutside: blockDismiss,
                      }
                    : {})}
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {children}
                {showFooter && (
                    <DialogFooter>
                        {close && (
                            <DialogClose asChild>
                                <Button variant="outline" onClick={handleClose}>
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
                )}
            </DialogContent>
        </Dialog>
    )
}
