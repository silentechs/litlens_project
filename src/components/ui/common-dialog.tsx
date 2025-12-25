"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type CommonDialogVariant = "default" | "destructive" | "warning" | "info";

interface CommonDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: CommonDialogVariant;
    loading?: boolean;
    children?: React.ReactNode;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export function CommonDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "default",
    loading = false,
    children,
    maxWidth = "md",
}: CommonDialogProps) {
    const Icon = {
        default: null,
        destructive: AlertCircle,
        warning: AlertTriangle,
        info: Info,
    }[variant];

    const confirmButtonVariant = {
        default: "default",
        destructive: "destructive",
        warning: "default", // We could add a warning variant to button if needed
        info: "default",
    }[variant] as any;

    const maxWidthClass = {
        sm: "sm:max-w-sm",
        md: "sm:max-w-md",
        lg: "sm:max-w-lg",
        xl: "sm:max-w-xl",
        "2xl": "sm:max-w-2xl",
    }[maxWidth];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={maxWidthClass}>
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        {Icon && (
                            <Icon
                                className={cn(
                                    "h-5 w-5",
                                    variant === "destructive" && "text-red-600",
                                    variant === "warning" && "text-amber-500",
                                    variant === "info" && "text-blue-500"
                                )}
                            />
                        )}
                        <DialogTitle className="font-serif text-2xl">
                            {title}
                        </DialogTitle>
                    </div>
                    {description && (
                        <DialogDescription className="font-sans text-muted">
                            {description}
                        </DialogDescription>
                    )}
                </DialogHeader>

                {children && <div className="py-4">{children}</div>}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={loading}
                    >
                        {cancelLabel}
                    </Button>
                    {onConfirm && (
                        <Button
                            variant={confirmButtonVariant}
                            onClick={onConfirm}
                            disabled={loading}
                            className={cn(
                                variant === "warning" &&
                                "bg-amber-500 hover:bg-amber-600 border-amber-500 text-white"
                            )}
                        >
                            {loading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {confirmLabel}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
