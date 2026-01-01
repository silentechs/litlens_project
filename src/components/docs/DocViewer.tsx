"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { MermaidDiagram } from "./MermaidDiagram";

interface DocViewerProps {
    content: string;
    className?: string;
}

export function DocViewer({ content, className }: DocViewerProps) {
    return (
        <article className={cn("prose prose-zinc dark:prose-invert max-w-none", className)}>
            <ReactMarkdown
                components={{
                    code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const isMermaid = match && match[1] === "mermaid";

                        if (isMermaid) {
                            return (
                                <MermaidDiagram
                                    chart={String(children).replace(/\n$/, "")}
                                    className="my-8"
                                />
                            );
                        }

                        return (
                            <code className={className} {...props}>
                                {children}
                            </code>
                        );
                    },
                    // Customize other elements for "Avant Garde" look
                    h1: ({ children }) => (
                        <h1 className="font-serif text-3xl font-light tracking-tight text-ink dark:text-white mb-6">
                            {children}
                        </h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="font-sans text-xl font-medium tracking-wide text-ink dark:text-white mt-10 mb-4 border-b border-border pb-2">
                            {children}
                        </h2>
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-emerald-500 pl-4 py-1 my-4 bg-emerald-500/5 italic text-muted-foreground">
                            {children}
                        </blockquote>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </article>
    );
}
