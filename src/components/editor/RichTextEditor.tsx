"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    Quote,
    Heading1,
    Heading2,
    Link as LinkIcon,
    Undo,
    Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback } from "react";

interface RichTextEditorProps {
    content?: string | object;
    placeholder?: string;
    onChange?: (json: object, html: string) => void;
    onSave?: (json: object, html: string) => void;
    editable?: boolean;
    className?: string;
}

export function RichTextEditor({
    content = "",
    placeholder = "Start writing...",
    onChange,
    editable = true,
    className,
}: RichTextEditorProps) {
    const editor = useEditor({
        immediatelyRender: false, // Prevent SSR hydration mismatch
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
            Placeholder.configure({
                placeholder,
                emptyEditorClass: "is-editor-empty",
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "text-intel-blue underline cursor-pointer",
                },
            }),
            Underline,
        ],
        content,
        editable,
        onUpdate: ({ editor }) => {
            onChange?.(editor.getJSON(), editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: cn(
                    "prose prose-lg max-w-none focus:outline-none min-h-[300px]",
                    "prose-headings:font-serif prose-headings:text-ink",
                    "prose-p:font-serif prose-p:text-ink/90 prose-p:leading-relaxed",
                    "prose-blockquote:border-l-intel-blue prose-blockquote:italic",
                    "prose-a:text-intel-blue prose-a:no-underline hover:prose-a:underline",
                ),
            },
        },
    });

    const setLink = useCallback(() => {
        if (!editor) return;

        const previousUrl = editor.getAttributes("link").href;
        const url = window.prompt("URL", previousUrl);

        if (url === null) return;

        if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }, [editor]);

    if (!editor) {
        return (
            <div className={cn("animate-pulse bg-muted/10 rounded-md min-h-[300px]", className)} />
        );
    }

    return (
        <div className={cn("flex flex-col h-full", className)}>
            {/* Toolbar */}
            <EditorToolbar editor={editor} onSetLink={setLink} />

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <EditorContent
                    editor={editor}
                    className="h-full"
                />
            </div>
        </div>
    );
}

interface EditorToolbarProps {
    editor: Editor;
    onSetLink: () => void;
}

function EditorToolbar({ editor, onSetLink }: EditorToolbarProps) {
    return (
        <div className="h-12 border-b border-border flex items-center px-4 gap-1 bg-paper/30 flex-shrink-0">
            {/* Text Formatting */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                active={editor.isActive("bold")}
                title="Bold"
            >
                <Bold className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                active={editor.isActive("italic")}
                title="Italic"
            >
                <Italic className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                active={editor.isActive("underline")}
                title="Underline"
            >
                <UnderlineIcon className="w-4 h-4" />
            </ToolbarButton>

            <div className="h-4 w-[1px] bg-border mx-2" />

            {/* Headings */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                active={editor.isActive("heading", { level: 1 })}
                title="Heading 1"
            >
                <Heading1 className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                active={editor.isActive("heading", { level: 2 })}
                title="Heading 2"
            >
                <Heading2 className="w-4 h-4" />
            </ToolbarButton>

            <div className="h-4 w-[1px] bg-border mx-2" />

            {/* Lists */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                active={editor.isActive("bulletList")}
                title="Bullet List"
            >
                <List className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                active={editor.isActive("orderedList")}
                title="Numbered List"
            >
                <ListOrdered className="w-4 h-4" />
            </ToolbarButton>

            <div className="h-4 w-[1px] bg-border mx-2" />

            {/* Block Elements */}
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                active={editor.isActive("blockquote")}
                title="Quote"
            >
                <Quote className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
                onClick={onSetLink}
                active={editor.isActive("link")}
                title="Link"
            >
                <LinkIcon className="w-4 h-4" />
            </ToolbarButton>

            <div className="flex-1" />

            {/* Undo/Redo */}
            <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                title="Undo"
            >
                <Undo className="w-4 h-4" />
            </ToolbarButton>

            <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                title="Redo"
            >
                <Redo className="w-4 h-4" />
            </ToolbarButton>

            <div className="h-4 w-[1px] bg-border mx-2" />

            <span className="text-xs font-mono text-muted uppercase tracking-widest">
                Auto-saving
            </span>
        </div>
    );
}

interface ToolbarButtonProps {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={cn(
                "p-2 rounded-sm transition-all",
                active
                    ? "bg-ink text-paper"
                    : "hover:bg-white border border-transparent hover:border-border",
                disabled && "opacity-30 cursor-not-allowed"
            )}
        >
            {children}
        </button>
    );
}

export default RichTextEditor;
