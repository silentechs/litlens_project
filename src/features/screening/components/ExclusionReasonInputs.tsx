"use client";

import { useState, useEffect } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// Standard PICO-based exclusion reasons
const STANDARD_REASONS = [
    "Wrong Population",
    "Wrong Intervention",
    "Wrong Comparator",
    "Wrong Outcome",
    "Wrong Study Design",
    "Wrong Setting",
    "Duplicate",
    "Not English",
    "Full Text Not Available",
];

interface ExclusionReasonInputsProps {
    value: string;
    onChange: (reason: string) => void;
}

export function ExclusionReasonInputs({ value, onChange }: ExclusionReasonInputsProps) {
    const [customReason, setCustomReason] = useState("");
    const [selectedStandard, setSelectedStandard] = useState<string | null>(null);

    // Initialize state from prop if it matches a standard reason
    useEffect(() => {
        if (value && STANDARD_REASONS.includes(value)) {
            setSelectedStandard(value);
            setCustomReason("");
        } else if (value) {
            setSelectedStandard(null);
            setCustomReason(value);
        }
    }, []); // Only on mount to avoid loops if parent updates 'value' 

    const handleStandardSelect = (reason: string) => {
        if (selectedStandard === reason) {
            setSelectedStandard(null);
            onChange("");
        } else {
            setSelectedStandard(reason);
            setCustomReason("");
            onChange(reason);
        }
    };

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setCustomReason(newVal);
        setSelectedStandard(null);
        onChange(newVal);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
                {STANDARD_REASONS.map((reason) => (
                    <button
                        key={reason}
                        onClick={() => handleStandardSelect(reason)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider border rounded-sm transition-all text-left",
                            selectedStandard === reason
                                ? "bg-rose-50 border-rose-500 text-rose-700"
                                : "bg-white border-border text-muted hover:border-rose-200 hover:text-rose-600"
                        )}
                    >
                        <div className={cn(
                            "w-3 h-3 border rounded-full flex items-center justify-center transition-colors",
                            selectedStandard === reason ? "border-rose-500 bg-rose-500 text-white" : "border-border"
                        )}>
                            {selectedStandard === reason && <Check className="w-2 h-2" />}
                        </div>
                        {reason}
                    </button>
                ))}
            </div>

            <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Plus className="w-3 h-3 text-muted" />
                </div>
                <input
                    type="text"
                    value={customReason}
                    onChange={handleCustomChange}
                    placeholder="Or type a custom reason..."
                    className={cn(
                        "w-full pl-8 pr-3 py-2 text-sm border rounded-sm outline-none focus:ring-1 focus:ring-rose-500 transition-all font-serif italic",
                        customReason ? "border-rose-500 bg-rose-50/10 text-rose-900" : "border-border bg-white text-ink"
                    )}
                />
            </div>
        </div>
    );
}
