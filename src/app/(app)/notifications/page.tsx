"use client";

import React from "react";
import { Bell, CheckCircle2, AlertCircle, MessageSquare, Clock } from "lucide-react";
import { motion } from "framer-motion";

const MOCK_NOTIFICATIONS = [
    {
        id: "1",
        type: "conflict",
        title: "Conflict Detected",
        description: "Reviewer Mina S. disagreed with your inclusion of 'Lee et al. (2024)'.",
        time: "2 hours ago",
        unread: true,
        icon: <AlertCircle className="w-5 h-5 text-red-500" />
    },
    {
        id: "2",
        type: "system",
        title: "Import Complete",
        description: "342 records successfully imported from 'PubMed_Export.ris'.",
        time: "5 hours ago",
        unread: false,
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
    },
    {
        id: "3",
        type: "mention",
        title: "New Comment",
        description: "Zakaria A. mentioned you in a comment on 'Methodology Section'.",
        time: "1 day ago",
        unread: false,
        icon: <MessageSquare className="w-5 h-5 text-intel-blue" />
    }
];

export default function NotificationsPage() {
    return (
        <div className="space-y-12 pb-20">
            <header className="space-y-4">
                <h1 className="text-6xl font-serif">Inbox</h1>
                <p className="text-muted font-serif italic text-xl">System updates, mentions, and methodological alerts.</p>
            </header>

            <div className="accent-line" />

            <div className="max-w-3xl space-y-4">
                {MOCK_NOTIFICATIONS.map((n, i) => (
                    <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`p-6 border ${n.unread ? 'bg-white border-ink shadow-sm' : 'bg-paper/50 border-border/50'} flex gap-6 group transition-all`}
                    >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${n.unread ? 'bg-ink/5' : 'bg-paper border border-border'}`}>
                            {n.icon}
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-start">
                                <h3 className={`font-serif text-lg ${n.unread ? 'font-bold' : ''}`}>{n.title}</h3>
                                <span className="text-[10px] font-mono text-muted uppercase tracking-widest">{n.time}</span>
                            </div>
                            <p className="text-sm text-muted font-serif italic leading-relaxed">{n.description}</p>
                        </div>
                        {n.unread && <div className="w-2 h-2 rounded-full bg-ink mt-2" />}
                    </motion.div>
                ))}
            </div>

            <div className="pt-12">
                <button className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted hover:text-ink transition-colors">
                    View Archived Notifications
                </button>
            </div>
        </div>
    );
}
