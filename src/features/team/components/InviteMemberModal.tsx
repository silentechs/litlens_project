"use client";

import { useState } from "react";
import { X, Loader2, Mail } from "lucide-react";
import { useAddMember } from "../api/queries";
import { toast } from "sonner";
import { ProjectRole } from "@/types/project";
import { motion, AnimatePresence } from "framer-motion";

interface InviteMemberModalProps {
    projectId: string;
    isOpen: boolean;
    onClose: () => void;
}

export function InviteMemberModal({ projectId, isOpen, onClose }: InviteMemberModalProps) {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<ProjectRole>("REVIEWER");

    const addMember = useAddMember(projectId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        try {
            await addMember.mutateAsync({ email, role });
            toast.success(`Invited ${email} to the project`);
            setEmail("");
            setRole("REVIEWER");
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to invite member");
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-ink/20 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="bg-white w-full max-w-md border border-border shadow-2xl relative z-10"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-muted hover:text-ink transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <form onSubmit={handleSubmit} className="p-8 space-y-8">
                            <div className="space-y-2">
                                <h2 className="text-3xl font-serif">Invite Scholar</h2>
                                <p className="text-muted font-serif italic text-lg">Add a collaborator to your review team.</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-mono uppercase tracking-widest text-muted">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="colleague@institution.edu"
                                            className="w-full bg-paper border border-border pl-12 pr-4 py-3 font-serif outline-none focus:border-ink transition-colors"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-mono uppercase tracking-widest text-muted">Role Assignment</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {roleOptions.map((opt) => (
                                            <label
                                                key={opt.value}
                                                className={`flex items-start gap-3 p-4 border cursor-pointer transition-all ${role === opt.value ? "border-ink bg-paper" : "border-border hover:border-muted"
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="role"
                                                    value={opt.value}
                                                    checked={role === opt.value}
                                                    onChange={(e) => setRole(e.target.value as ProjectRole)}
                                                    className="mt-1"
                                                />
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-serif font-bold">{opt.label}</span>
                                                    </div>
                                                    <p className="text-xs text-muted leading-relaxed">
                                                        {opt.description}
                                                    </p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-6 py-2 text-sm font-serif italic text-muted hover:text-ink transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={addMember.isPending}
                                    className="btn-editorial min-w-[120px] flex items-center justify-center gap-2"
                                >
                                    {addMember.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Invite"}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

const roleOptions = [
    {
        value: "LEAD",
        label: "Project Lead",
        description: "Full access to settings, team management, and conflict resolution."
    },
    {
        value: "REVIEWER",
        label: "Reviewer",
        description: "Can screen studies and extract data. Cannot manage team."
    },
    {
        value: "OBSERVER",
        label: "Observer",
        description: "Read-only access to analytics and progress. Cannot verify decisions."
    }
];
