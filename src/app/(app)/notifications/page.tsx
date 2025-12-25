"use client";

import React from "react";
import { Bell, CheckCircle2, AlertCircle, MessageSquare, Clock } from "lucide-react";
import { motion } from "framer-motion";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface NotificationAPIResponse {
    items: Array<{
        id: string;
        type: string;
        title: string;
        message: string;
        metadata: any;
        user: { name: string; image?: string };
        createdAt: string;
    }>;
    total: number;
}

export default function NotificationsPage() {
    const { data, isLoading } = useQuery<NotificationAPIResponse>({
        queryKey: ["notifications"],
        queryFn: async () => {
            const res = await fetch("/api/notifications");
            if (!res.ok) throw new Error("Failed to fetch notifications");
            return res.json();
        },
    });

    const notifications = data?.items || [];

    return (
        <div className="space-y-12 pb-20">
            <header className="space-y-4">
                <h1 className="text-6xl font-serif">Inbox</h1>
                <p className="text-muted font-serif italic text-xl">System updates, mentions, and methodological alerts.</p>
            </header>

            <div className="accent-line" />

            <div className="max-w-3xl space-y-4">
                {isLoading ? (
                    <div className="p-12 text-center font-serif italic text-muted">Scanning for alerts...</div>
                ) : notifications.length === 0 ? (
                    <div className="p-12 bg-white border border-border/50 text-center space-y-4">
                        <Bell className="w-8 h-8 text-muted mx-auto opacity-20" />
                        <p className="font-serif italic text-xl text-muted">Your inbox is clear.</p>
                        <p className="text-sm text-muted/60 font-serif">You have no methodological alerts or team mentions at this time.</p>
                    </div>
                ) : (
                    notifications.map((n, i) => (
                        <motion.div
                            key={n.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={`p-6 border bg-white border-ink shadow-sm flex gap-6 group transition-all`}
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-ink/5`}>
                                {getNotificationIcon(n.type)}
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex justify-between items-start">
                                    <h3 className={`font-serif text-lg font-bold`}>{n.title}</h3>
                                    <span className="text-[10px] font-mono text-muted uppercase tracking-widest">
                                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                    </span>
                                </div>
                                <p className="text-sm text-muted font-serif italic leading-relaxed">{n.message}</p>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            <div className="pt-12">
                <button className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted hover:text-ink transition-colors">
                    View Archived Notifications
                </button>
            </div>
        </div>
    );
}

function getNotificationIcon(type: string) {
    switch (type) {
        case "CONFLICT_CREATED":
            return <AlertCircle className="w-5 h-5 text-red-500" />;
        case "STUDY_IMPORTED":
            return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
        case "MEMBER_ADDED":
            return <UserPlus className="w-5 h-5 text-intel-blue" />;
        default:
            return <Bell className="w-5 h-5 text-intel-blue" />;
    }
}

import { UserPlus } from "lucide-react";
