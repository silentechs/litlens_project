"use client";

import { cn } from "@/lib/utils";

interface PresenceUser {
    id: string;
    name: string;
    avatar?: string;
}

interface PresenceIndicatorProps {
    users: PresenceUser[];
    maxDisplay?: number;
    size?: "sm" | "md" | "lg";
    className?: string;
}

/**
 * Shows avatars of active users in a project
 */
export function PresenceIndicator({
    users,
    maxDisplay = 5,
    size = "md",
    className,
}: PresenceIndicatorProps) {
    const displayUsers = users.slice(0, maxDisplay);
    const overflow = users.length - maxDisplay;

    const sizeClasses = {
        sm: "w-6 h-6 text-[10px]",
        md: "w-8 h-8 text-xs",
        lg: "w-10 h-10 text-sm",
    };

    const overlapClasses = {
        sm: "-ml-2",
        md: "-ml-3",
        lg: "-ml-4",
    };

    if (users.length === 0) {
        return null;
    }

    return (
        <div className={cn("flex items-center", className)}>
            <div className="flex">
                {displayUsers.map((user, index) => (
                    <div
                        key={user.id}
                        className={cn(
                            sizeClasses[size],
                            index > 0 && overlapClasses[size],
                            "rounded-full bg-ink text-paper flex items-center justify-center font-serif",
                            "ring-2 ring-paper",
                            "relative"
                        )}
                        title={user.name}
                    >
                        {user.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={user.avatar}
                                alt={user.name}
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            <span>{user.name.charAt(0).toUpperCase()}</span>
                        )}
                        {/* Online indicator */}
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full ring-2 ring-paper" />
                    </div>
                ))}

                {overflow > 0 && (
                    <div
                        className={cn(
                            sizeClasses[size],
                            overlapClasses[size],
                            "rounded-full bg-muted/30 text-muted flex items-center justify-center font-mono",
                            "ring-2 ring-paper"
                        )}
                    >
                        +{overflow}
                    </div>
                )}
            </div>

            <span className="ml-3 text-sm text-muted">
                {users.length === 1
                    ? `${users[0].name} is online`
                    : `${users.length} collaborators online`
                }
            </span>
        </div>
    );
}

interface TypingIndicatorProps {
    users: Array<{ id: string; name: string; location: string }>;
    className?: string;
}

/**
 * Shows who is currently typing
 */
export function TypingIndicator({ users, className }: TypingIndicatorProps) {
    if (users.length === 0) return null;

    const names = users.map(u => u.name);
    const text = names.length === 1
        ? `${names[0]} is typing...`
        : names.length === 2
            ? `${names[0]} and ${names[1]} are typing...`
            : `${names[0]} and ${names.length - 1} others are typing...`;

    return (
        <div className={cn("flex items-center gap-2 text-sm text-muted", className)}>
            <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="font-serif italic">{text}</span>
        </div>
    );
}

export default PresenceIndicator;
