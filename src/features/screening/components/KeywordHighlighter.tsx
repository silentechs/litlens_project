"use client";

import { useMemo } from "react";

interface KeywordHighlighterProps {
    text: string;
    keywords: string[];
    className?: string;
}

export function KeywordHighlighter({ text, keywords, className }: KeywordHighlighterProps) {
    const parts = useMemo(() => {
        if (!keywords || keywords.length === 0 || !text) {
            return [{ text, highlight: false }];
        }

        // Escape special regex characters
        const escapedKeywords = keywords
            .filter(k => k && k.trim().length > 0)
            .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

        if (escapedKeywords.length === 0) return [{ text, highlight: false }];

        const regex = new RegExp(`(${escapedKeywords.join("|")})`, "gi");
        const sentances = text.split(regex);

        return sentances.map((part) => {
            const isMatch = escapedKeywords.some(k => k.toLowerCase() === part.toLowerCase());
            return { text: part, highlight: regex.test(part) };
        });
    }, [text, keywords]);

    return (
        <span className={className}>
            {parts.map((part, index) => (
                part.highlight ? (
                    <mark key={index} className="bg-yellow-200 text-ink px-0.5 rounded-sm font-medium">
                        {part.text}
                    </mark>
                ) : (
                    <span key={index}>{part.text}</span>
                )
            ))}
        </span>
    );
}
