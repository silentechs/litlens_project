import Link from "next/link";
import { DOCS, DOC_CATEGORIES } from "@/lib/docs/data";

interface HelpLayoutProps {
    children: React.ReactNode;
}

export default function HelpLayout({ children }: HelpLayoutProps) {
    return (
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
            {/* Documentation Sidebar */}
            <aside className="w-full lg:w-64 border-r border-border bg-background/50 backdrop-blur-sm p-6 lg:fixed lg:bottom-0 lg:top-16 lg:left-16 overflow-y-auto">
                <h2 className="font-serif text-lg font-medium mb-6 text-foreground">Docs & Help</h2>

                <nav className="space-y-8">
                    {DOC_CATEGORIES.map((category) => (
                        <div key={category}>
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                                {category}
                            </h3>
                            <ul className="space-y-2">
                                {DOCS.filter((doc) => doc.category === category).map((doc) => (
                                    <li key={doc.slug}>
                                        <Link
                                            href={`/help/${doc.slug}`}
                                            className="block text-sm text-foreground/80 hover:text-emerald-500 transition-colors"
                                        >
                                            {doc.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    {/* Fallback/Future Categories */}
                    <div>
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                            Resources
                        </h3>
                        <ul className="space-y-2">
                            <li>
                                <a href="#" className="block text-sm text-foreground/80 hover:text-emerald-500 transition-colors opacity-50 cursor-not-allowed">
                                    API Reference (Soon)
                                </a>
                            </li>
                            <li>
                                <a href="#" className="block text-sm text-foreground/80 hover:text-emerald-500 transition-colors opacity-50 cursor-not-allowed">
                                    Deployment Guide (Soon)
                                </a>
                            </li>
                        </ul>
                    </div>
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 lg:ml-64 p-8 lg:p-12 max-w-5xl">
                {children}
            </main>
        </div>
    );
}
