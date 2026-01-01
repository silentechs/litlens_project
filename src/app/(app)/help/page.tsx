import Link from "next/link";
import { DOCS } from "@/lib/docs/data";
import { BookOpen, LifeBuoy, Zap } from "lucide-react";

export default function HelpPage() {
    return (
        <div className="space-y-12">
            <div className="max-w-2xl">
                <h1 className="font-serif text-4xl font-light tracking-tight mb-4">
                    How can we help?
                </h1>
                <p className="text-lg text-muted-foreground">
                    Explore documentation, workflow diagrams, and guides to get the most out of LitLens.
                </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {DOCS.map((doc) => (
                    <Link
                        key={doc.slug}
                        href={`/help/${doc.slug}`}
                        className="group block p-6 rounded-xl border border-border bg-card hover:border-emerald-500/50 transition-all hover:bg-emerald-500/5"
                    >
                        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4 group-hover:bg-emerald-500 group-hover:text-emerald-50 transition-colors">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <h3 className="font-medium text-lg mb-2">{doc.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                            {doc.summary}
                        </p>
                    </Link>
                ))}

                {/* Support Card */}
                <div className="p-6 rounded-xl border border-border border-dashed bg-card/50 flex flex-col justify-center items-center text-center">
                    <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-muted-foreground mb-4">
                        <LifeBuoy className="w-5 h-5" />
                    </div>
                    <h3 className="font-medium text-lg mb-2">Need Support?</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Contact the engineering team for assistance.
                    </p>
                    <a
                        href="mailto:support@litlens.ai"
                        className="text-sm font-medium text-emerald-500 hover:underline"
                    >
                        support@litlens.ai
                    </a>
                </div>
            </div>
        </div>
    );
}
