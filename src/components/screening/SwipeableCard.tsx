"use client";

import { useRef, useState, useCallback, TouchEvent } from "react";
import { cn } from "@/lib/utils";

interface SwipeableCardProps {
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
    onSwipeUp?: () => void;
    threshold?: number;
    children: React.ReactNode;
    className?: string;
}

/**
 * Wrapper component that adds swipe gesture support
 * 
 * - Swipe left = Exclude
 * - Swipe right = Include
 * - Swipe up = Maybe (optional)
 */
export function SwipeableCard({
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    threshold = 100,
    children,
    className,
}: SwipeableCardProps) {
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
    const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: TouchEvent) => {
        setTouchEnd(null);
        setTouchStart({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY,
        });
        setIsDragging(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
        if (!touchStart) return;

        const currentX = e.targetTouches[0].clientX;
        const currentY = e.targetTouches[0].clientY;

        setTouchEnd({ x: currentX, y: currentY });
        setOffset({
            x: currentX - touchStart.x,
            y: currentY - touchStart.y,
        });
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) {
            setIsDragging(false);
            setOffset({ x: 0, y: 0 });
            return;
        }

        const distanceX = touchEnd.x - touchStart.x;
        const distanceY = touchEnd.y - touchStart.y;
        const isHorizontal = Math.abs(distanceX) > Math.abs(distanceY);

        if (isHorizontal) {
            if (distanceX > threshold) {
                onSwipeRight();
            } else if (distanceX < -threshold) {
                onSwipeLeft();
            }
        } else if (onSwipeUp && distanceY < -threshold) {
            onSwipeUp();
        }

        setIsDragging(false);
        setOffset({ x: 0, y: 0 });
        setTouchStart(null);
        setTouchEnd(null);
    };

    // Calculate visual feedback
    const rotation = offset.x * 0.05;
    const opacity = 1 - Math.abs(offset.x) / 400;

    // Swipe indicator colors
    const getIndicatorStyle = () => {
        if (Math.abs(offset.x) < threshold / 2) return {};

        if (offset.x > 0) {
            return { boxShadow: `inset 0 0 30px rgba(34, 197, 94, ${Math.min(offset.x / 200, 0.5)})` };
        } else {
            return { boxShadow: `inset 0 0 30px rgba(239, 68, 68, ${Math.min(-offset.x / 200, 0.5)})` };
        }
    };

    return (
        <div
            ref={cardRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
                transform: isDragging
                    ? `translateX(${offset.x}px) rotate(${rotation}deg)`
                    : "translateX(0) rotate(0)",
                opacity: isDragging ? opacity : 1,
                transition: isDragging ? "none" : "transform 0.3s ease, opacity 0.3s ease",
                ...getIndicatorStyle(),
            }}
            className={cn(
                "touch-pan-y select-none",
                className
            )}
        >
            {/* Swipe indicators */}
            {isDragging && (
                <>
                    {offset.x > threshold / 2 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div className="px-6 py-3 bg-green-600 text-white font-bold text-xl rounded-lg rotate-12">
                                INCLUDE
                            </div>
                        </div>
                    )}
                    {offset.x < -threshold / 2 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div className="px-6 py-3 bg-red-500 text-white font-bold text-xl rounded-lg -rotate-12">
                                EXCLUDE
                            </div>
                        </div>
                    )}
                </>
            )}

            {children}
        </div>
    );
}

export default SwipeableCard;
