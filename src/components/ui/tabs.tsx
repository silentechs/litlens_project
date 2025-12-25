"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Tabs = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        value?: string;
        defaultValue?: string;
        onValueChange?: (value: string) => void;
    }
>(({ className, value, defaultValue, onValueChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue || "");
    const currentValue = value ?? internalValue;

    const handleValueChange = React.useCallback(
        (newValue: string) => {
            if (!value) {
                setInternalValue(newValue);
            }
            onValueChange?.(newValue);
        },
        [value, onValueChange]
    );

    return (
        <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
            <div ref={ref} className={cn("", className)} {...props} />
        </TabsContext.Provider>
    );
});
Tabs.displayName = "Tabs";

const TabsContext = React.createContext<{
    value: string;
    onValueChange: (value: string) => void;
}>({ value: "", onValueChange: () => { } });

const TabsList = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "inline-flex h-10 items-center justify-center rounded-md bg-muted/10 p-1 text-muted",
            className
        )}
        {...props}
    />
));
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, ...props }, ref) => {
    const { value: selectedValue, onValueChange } = React.useContext(TabsContext);
    const isSelected = selectedValue === value;

    return (
        <button
            ref={ref}
            type="button"
            role="tab"
            aria-selected={isSelected}
            data-state={isSelected ? "active" : "inactive"}
            onClick={() => onValueChange(value)}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-paper transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isSelected
                    ? "bg-paper text-ink shadow-sm"
                    : "text-muted hover:text-ink",
                className
            )}
            {...props}
        />
    );
});
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, ...props }, ref) => {
    const { value: selectedValue } = React.useContext(TabsContext);
    const isSelected = selectedValue === value;

    if (!isSelected) return null;

    return (
        <div
            ref={ref}
            role="tabpanel"
            data-state={isSelected ? "active" : "inactive"}
            className={cn(
                "mt-2 ring-offset-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
                className
            )}
            {...props}
        />
    );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
