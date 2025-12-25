"use client";

import { useState, useEffect } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

interface ConfidenceSliderProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
}

export function ConfidenceSlider({ value, onChange, className }: ConfidenceSliderProps) {
    // Local state for smooth sliding
    const [localValue, setLocalValue] = useState([value]);

    useEffect(() => {
        setLocalValue([value]);
    }, [value]);

    const handleValueChange = (newValues: number[]) => {
        setLocalValue(newValues);
        onChange(newValues[0]);
    };

    const getConfidenceLabel = (val: number) => {
        if (val >= 90) return "Very Confident";
        if (val >= 70) return "Confident";
        if (val >= 50) return "Unsure";
        if (val >= 30) return "Low Confidence";
        return "Guessing";
    };

    const getConfidenceColor = (val: number) => {
        if (val >= 90) return "bg-emerald-500";
        if (val >= 70) return "bg-emerald-400";
        if (val >= 50) return "bg-amber-400";
        if (val >= 30) return "bg-orange-400";
        return "bg-rose-500";
    };

    return (
        <div className={cn("space-y-3", className)}>
            <div className="flex justify-between items-end">
                <label className="text-xs font-mono uppercase tracking-widest text-muted font-bold">
                    Confidence
                </label>
                <div className="text-right">
                    <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-full text-white",
                        getConfidenceColor(localValue[0])
                    )}>
                        {localValue[0]}%
                    </span>
                    <p className="text-[10px] text-muted uppercase mt-1">{getConfidenceLabel(localValue[0])}</p>
                </div>
            </div>

            <SliderPrimitive.Root
                className="relative flex items-center select-none touch-none w-full h-5"
                value={localValue}
                max={100}
                step={5}
                onValueChange={handleValueChange}
            >
                <SliderPrimitive.Track className="bg-paper relative grow rounded-full h-[3px] overflow-hidden">
                    <SliderPrimitive.Range className={cn("absolute h-full", getConfidenceColor(localValue[0]))} />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb
                    className={cn(
                        "block w-4 h-4 bg-white border-2 rounded-full cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
                        getConfidenceColor(localValue[0]).replace("bg-", "border-")
                    )}
                />
            </SliderPrimitive.Root>
        </div>
    );
}
