'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { adminCx } from '../_styles/tokens';

type AdminModalProps = {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    ariaLabelledBy?: string;
    ariaLabel?: string;
    maxWidthClassName?: string;
    className?: string;
};

export default function AdminModal({
    isOpen,
    onClose,
    children,
    ariaLabelledBy,
    ariaLabel,
    maxWidthClassName = 'max-w-2xl',
    className,
}: AdminModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const dialog = dialogRef.current;
        if (!dialog) return;

        const previousActive = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusable = dialog.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key === 'Tab') {
                if (focusable.length === 0) {
                    event.preventDefault();
                    return;
                }
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        dialog.addEventListener('keydown', handleKeyDown);
        if (first) {
            first.focus();
        } else {
            dialog.focus();
        }

        return () => {
            dialog.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
            previousActive?.focus();
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overscroll-contain"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={ariaLabelledBy}
                aria-label={ariaLabelledBy ? undefined : ariaLabel}
                tabIndex={-1}
                className={adminCx(
                    'bg-white rounded-2xl w-full max-h-[90vh] flex flex-col shadow-xl',
                    maxWidthClassName,
                    className
                )}
                onClick={(event) => event.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}
