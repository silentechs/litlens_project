"use client";

import Link from "next/link";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Brain, Search, Network, BookOpen, ShieldCheck } from "lucide-react";

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-paper text-ink font-sans selection:bg-ink selection:text-paper">
            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-paper/80 backdrop-blur-md border-b border-border/40 px-8 py-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-ink rounded-sm flex items-center justify-center text-paper font-serif italic text-xl">L</div>
                    <span className="font-serif text-2xl tracking-tight">LitLens</span>
                </div>
                <div className="flex items-center gap-8">
                    <Link href="#features" className="text-[10px] font-mono uppercase tracking-[0.2em] hover:text-intel-blue transition-colors">Features</Link>
                    <Link href="#methodology" className="text-[10px] font-mono uppercase tracking-[0.2em] hover:text-intel-blue transition-colors">Methodology</Link>
                    <Link href="/dashboard">
                        <button className="btn-editorial py-2 px-6">Enter Workspace</button>
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-40 pb-32 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-intel-blue/5 blur-[120px] rounded-full -z-10" />

                <div className="max-w-6xl mx-auto px-8 text-center space-y-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="space-y-6"
                    >
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-ink text-paper text-[10px] font-mono uppercase tracking-[0.3em] rounded-full">
                            <Sparkles className="w-3 h-3" />
                            Intelligence Reimagined
                        </span>
                        <h1 className="text-8xl md:text-[10rem] font-serif tracking-tighter leading-[0.85] text-ink italic">
                            Evidence, <br />
                            <span className="not-italic opacity-20">Synthesized.</span>
                        </h1>
                    </motion.div>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                        className="text-2xl md:text-3xl font-serif italic text-muted max-w-3xl mx-auto leading-relaxed"
                    >
                        A distinctive, AI-powered platform for systematic reviews, mapping the intellectual lineage of global knowledge with academic rigor.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8"
                    >
                        <Link href="/dashboard">
                            <button className="btn-editorial text-2xl px-12 py-6 flex items-center gap-4 group">
                                Begin Investigation
                                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </Link>
                        <button className="text-sm font-mono uppercase tracking-widest text-muted hover:text-ink transition-colors px-12 py-6 border border-border hover:bg-white bg-transparent rounded-sm">
                            Watch the Film
                        </button>
                    </motion.div>
                </div>
            </section>

            {/* Feature High-Fidelity Glimpse (Research Graph) */}
            <section id="features" className="py-32 bg-white border-y border-border/50 overflow-hidden">
                <div className="max-w-7xl mx-auto px-8">
                    <div className="editorial-grid items-center gap-20">
                        <div className="col-span-12 md:col-span-5 space-y-8">
                            <div className="space-y-4">
                                <h2 className="text-5xl font-serif">A Living Map of <span className="italic">Human Thought</span></h2>
                                <p className="text-xl font-serif italic text-muted leading-relaxed">
                                    Our dynamic citation engine doesn&apos;t just list references—it visualizes the intellectual gravity of every paper, uncovering hidden connections in your field.
                                </p>
                            </div>

                            <div className="space-y-6 pt-8 border-t border-border/40">
                                <FeatureItem icon={<Network className="w-5 h-5" />} title="Force-Directed Lineage" description="Real-time mapping of citation clusters and influence networks." />
                                <FeatureItem icon={<Brain className="w-5 h-5" />} title="AI-Aided Screening" description="Transformers that learn your inclusion criteria with every decision." />
                                <FeatureItem icon={<Search className="w-5 h-5" />} title="Discovery Intelligence" description="Autonomous agents that scour the deep web for relevant evidence." />
                            </div>
                        </div>

                        <div className="col-span-12 md:col-span-7 relative">
                            <div className="aspect-[4/3] bg-paper border border-border shadow-editorial rounded-sm overflow-hidden relative">
                                {/* Visual Placeholder for Graph Demo */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                    <Network className="w-64 h-64" />
                                </div>
                                <div className="absolute top-8 left-8 p-4 bg-white/80 backdrop-blur-sm border border-border shadow-sm max-w-xs space-y-2">
                                    <div className="h-1 w-12 bg-intel-blue" />
                                    <h4 className="font-serif italic font-bold">Citation Cluster: LLM Safety</h4>
                                    <p className="text-[10px] font-mono text-muted uppercase">42 core papers found • Growth: 400% YoY</p>
                                </div>
                            </div>
                            <div className="absolute -bottom-8 -right-8 w-64 h-64 bg-intel-blue/10 blur-[80px] rounded-full -z-10" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Philosophy Section */}
            <section id="methodology" className="py-40 relative">
                <div className="max-w-4xl mx-auto px-8 text-center space-y-12">
                    <h2 className="text-6xl font-serif italic tracking-tight">&ldquo;The quality of a review is determined by the depth of its lens.&rdquo;</h2>
                    <div className="accent-line mx-auto w-24 opacity-20" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-left pt-12">
                        <div className="space-y-4">
                            <BookOpen className="w-8 h-8 text-ink opacity-20" />
                            <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted">Editorial Precision</h4>
                            <p className="font-serif italic text-sm leading-relaxed">Designed for focus. We remove the noise of generic SaaS to prioritize the scholarly experience.</p>
                        </div>
                        <div className="space-y-4">
                            <ShieldCheck className="w-8 h-8 text-ink opacity-20" />
                            <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted">Permanent Audit</h4>
                            <p className="font-serif italic text-sm leading-relaxed">Every decision is logged in a permanent, immutable trail for methodological transparency.</p>
                        </div>
                        <div className="space-y-4">
                            <Sparkles className="w-8 h-8 text-ink opacity-20" />
                            <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted">AI Partnership</h4>
                            <p className="font-serif italic text-sm leading-relaxed">AI that acts as a junior investigator, not a black box, explaining its reasoning at every step.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <footer className="bg-ink text-paper py-32 mt-20">
                <div className="max-w-5xl mx-auto px-8 text-center space-y-12">
                    <h2 className="text-6xl font-serif">Begin your next review.</h2>
                    <p className="text-xl font-serif italic text-paper/60 pb-8">Join the investigative elite bridging the gap between data and insight.</p>
                    <Link href="/dashboard">
                        <button className="bg-white text-ink px-16 py-8 text-2xl font-serif hover:bg-paper transition-colors rounded-sm shadow-editorial">
                            Inaugurate Project
                        </button>
                    </Link>
                    <div className="pt-24 border-t border-white/10 flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.3em] text-paper/30">
                        <span>© 2025 LitLens Intelligence</span>
                        <div className="flex gap-8">
                            <a href="#">Privacy</a>
                            <a href="#">Ethics</a>
                            <a href="#">API</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="flex gap-6 group cursor-default">
            <div className="w-12 h-12 border border-border flex items-center justify-center shrink-0 group-hover:border-ink group-hover:bg-paper transition-all">
                {icon}
            </div>
            <div className="space-y-1">
                <h3 className="font-serif font-bold italic text-lg leading-none group-hover:text-intel-blue transition-colors">{title}</h3>
                <p className="text-sm font-serif italic text-muted leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">{description}</p>
            </div>
        </div>
    );
}
