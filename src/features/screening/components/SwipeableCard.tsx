"use client";

import React, { useRef, useState, useEffect } from "react";
import {
    motion,
    useMotionValue,
    useTransform,
    PanInfo,
    useAnimation,
    AnimatePresence
} from "framer-motion";
import { Check, X, HelpCircle } from "lucide-react";

interface SwipeableCardProps {
    children: React.ReactNode;
    onSwipe: (direction: "left" | "right" | "up") => void;
    disabled?: boolean;
}

export function SwipeableCard({ children, onSwipe, disabled }: SwipeableCardProps) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const controls = useAnimation();
    const constraintRef = useRef(null);

    // Rotation based on X movement - subtle tilt
    const rotate = useTransform(x, [-200, 200], [-8, 8]);

    // Opacity indicators for actions
    const rightOpacity = useTransform(x, [50, 150], [0, 1]);
    const leftOpacity = useTransform(x, [-50, -150], [0, 1]);
    const upOpacity = useTransform(y, [-50, -150], [0, 1]);

    // Haptic feedback state to prevent spamming
    const [hasVibrated, setHasVibrated] = useState(false);

    const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const xOffset = info.offset.x;
        const yOffset = info.offset.y;

        // Haptic feedback logic
        if (!hasVibrated) {
            if (Math.abs(xOffset) > 100 || yOffset < -100) {
                if (navigator.vibrate) navigator.vibrate(15);
                setHasVibrated(true);
            }
        } else {
            // Reset if user pulls back
            if (Math.abs(xOffset) < 80 && yOffset > -80) {
                setHasVibrated(false);
            }
        }
    };

    const handleDragEnd = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const xOffset = info.offset.x;
        const yOffset = info.offset.y;
        const velocity = info.velocity.x;

        // Thresholds for triggering action
        const swipeThreshold = 100;
        const velocityThreshold = 500;

        let direction: "left" | "right" | "up" | null = null;

        if (xOffset > swipeThreshold || velocity > velocityThreshold) {
            direction = "right";
        } else if (xOffset < -swipeThreshold || velocity < -velocityThreshold) {
            direction = "left";
        } else if (yOffset < -swipeThreshold) {
            // Swipe up logic for "Maybe" or Details
            direction = "up";
        }

        if (direction) {
            // Success Haptic
            if (navigator.vibrate) navigator.vibrate([10, 30]);

            // Animate off screen
            await controls.start({
                x: direction === "right" ? 500 : direction === "left" ? -500 : 0,
                y: direction === "up" ? -500 : 0,
                opacity: 0,
                transition: { duration: 0.3, ease: "easeIn" }
            });

            onSwipe(direction);

            // Reset position immediately after callback (parent should swap content)
            controls.set({ x: 0, y: 0, opacity: 1 });
            setHasVibrated(false);
        } else {
            // Spring back to center
            controls.start({ x: 0, y: 0, transition: { type: "spring", stiffness: 300, damping: 20 } });
            setHasVibrated(false);
        }
    };

    if (disabled) {
        return <div className="relative">{children}</div>;
    }

    return (
        <div ref={constraintRef} className="relative w-full h-full perspective-1000 touch-none">
            <motion.div
                drag
                dragConstraints={constraintRef}
                dragElastic={0.6}
                animate={controls}
                style={{ x, y, rotate }}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                className="relative bg-white h-full w-full shadow-xl rounded-xl cursor-grab active:cursor-grabbing overflow-hidden border border-border/50"
                whileTap={{ scale: 1.02 }}
            >
                {/* Visual Indicators Overlay */}
                <motion.div
                    style={{ opacity: rightOpacity }}
                    className="absolute inset-0 z-50 bg-emerald-500/10 flex items-center justify-center pointer-events-none border-4 border-emerald-500/50 rounded-xl"
                >
                    <div className="bg-emerald-500 text-white rounded-full p-6 shadow-2xl transform rotate-12">
                        <Check className="w-12 h-12" />
                    </div>
                </motion.div>

                <motion.div
                    style={{ opacity: leftOpacity }}
                    className="absolute inset-0 z-50 bg-rose-500/10 flex items-center justify-center pointer-events-none border-4 border-rose-500/50 rounded-xl"
                >
                    <div className="bg-rose-500 text-white rounded-full p-6 shadow-2xl transform -rotate-12">
                        <X className="w-12 h-12" />
                    </div>
                </motion.div>

                <motion.div
                    style={{ opacity: upOpacity }}
                    className="absolute inset-0 z-50 bg-slate-500/10 flex items-end justify-center pointer-events-none border-t-4 border-slate-500/50 rounded-xl pb-20"
                >
                    <div className="bg-slate-500 text-white rounded-full p-4 shadow-xl">
                        <span className="font-bold text-lg uppercase tracking-widest">Maybe</span>
                    </div>
                </motion.div>

                {children}
            </motion.div>
        </div>
    );
}
