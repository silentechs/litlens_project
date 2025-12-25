"use client";

import { useState } from "react";
import { 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Target, 
  Users, 
  Settings,
  BookOpen,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Step = 'basic' | 'pico' | 'team' | 'settings';

export function NewProjectWizard() {
  const [step, setStep] = useState<Step>('basic');
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    pico: { p: "", i: "", c: "", o: "" },
    team: [] as string[],
    isPublic: false
  });

  const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
    { id: 'basic', label: 'Inception', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'pico', label: 'Methodology', icon: <Target className="w-4 h-4" /> },
    { id: 'team', label: 'Collaboration', icon: <Users className="w-4 h-4" /> },
    { id: 'settings', label: 'Governance', icon: <Settings className="w-4 h-4" /> },
  ];

  const handleNext = () => {
    const currentIndex = steps.findIndex(s => s.id === step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1].id);
    }
  };

  const handleBack = () => {
    const currentIndex = steps.findIndex(s => s.id === step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1].id);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <header className="space-y-4">
        <Link href="/" className="text-xs font-mono uppercase tracking-widest text-muted hover:text-ink flex items-center gap-2 transition-colors">
          <ArrowLeft className="w-3 h-3" /> Back to Dashboard
        </Link>
        <h1 className="text-6xl font-serif">Project Inception</h1>
        <p className="text-muted font-serif italic text-xl leading-relaxed">Defining the boundaries of your evidence synthesis.</p>
      </header>

      {/* Progress Stepper */}
      <nav className="flex items-center gap-8 border-b border-border pb-8">
        {steps.map((s, i) => {
          const isActive = step === s.id;
          const isPast = steps.findIndex(x => x.id === step) > i;
          return (
            <div key={s.id} className="flex items-center gap-4">
              <div className={cn(
                "flex items-center gap-3 transition-colors",
                isActive ? "text-ink" : isPast ? "text-ink/40" : "text-muted"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-full border flex items-center justify-center transition-all",
                  isActive ? "border-ink bg-ink text-paper shadow-editorial scale-110" : "border-border"
                )}>
                  {isPast ? <Check className="w-4 h-4" /> : s.icon}
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest font-bold">{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className="w-8 h-[1px] bg-border" />}
            </div>
          );
        })}
      </nav>

      {/* Form Content */}
      <main className="min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-12"
          >
            {step === 'basic' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="font-serif italic text-2xl">What is the focus of this review?</label>
                  <input 
                    type="text" 
                    placeholder="Enter project title..."
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full bg-transparent border-b-2 border-border focus:border-ink py-4 text-4xl font-serif outline-none transition-all placeholder:text-muted/20"
                  />
                </div>
                <div className="space-y-4">
                  <label className="font-serif italic text-2xl text-muted">A brief conceptual summary</label>
                  <textarea 
                    rows={4}
                    placeholder="Describe the scope and objective..."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-transparent border border-border focus:border-ink p-6 text-xl font-serif outline-none transition-all placeholder:text-muted/20"
                  />
                </div>
              </div>
            )}

            {step === 'pico' && (
              <div className="space-y-12">
                <div className="space-y-2">
                  <h3 className="font-serif text-3xl">PICO Framework</h3>
                  <p className="text-muted font-serif italic">Structure your research question for precision.</p>
                </div>
                <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                  <PICOField 
                    label="P" 
                    title="Population" 
                    description="Who are the subjects?" 
                    value={formData.pico.p} 
                    onChange={(v) => setFormData({...formData, pico: {...formData.pico, p: v}})}
                  />
                  <PICOField 
                    label="I" 
                    title="Intervention" 
                    description="What is being tested?" 
                    value={formData.pico.i} 
                    onChange={(v) => setFormData({...formData, pico: {...formData.pico, i: v}})}
                  />
                  <PICOField 
                    label="C" 
                    title="Comparison" 
                    description="Control group or alternative?" 
                    value={formData.pico.c} 
                    onChange={(v) => setFormData({...formData, pico: {...formData.pico, c: v}})}
                  />
                  <PICOField 
                    label="O" 
                    title="Outcome" 
                    description="What are you measuring?" 
                    value={formData.pico.o} 
                    onChange={(v) => setFormData({...formData, pico: {...formData.pico, o: v}})}
                  />
                </div>
              </div>
            )}

            {step === 'team' && (
              <div className="space-y-8 text-center py-20 border-2 border-dashed border-border group hover:border-ink transition-all cursor-pointer">
                <div className="w-20 h-20 bg-paper rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <Plus className="w-8 h-8 text-muted group-hover:text-ink" />
                </div>
                <h3 className="text-3xl font-serif">Invite Collaborators</h3>
                <p className="text-muted font-serif italic max-w-sm mx-auto">Research is a collective endeavor. Add team members by email or ORCID.</p>
              </div>
            )}

            {step === 'settings' && (
              <div className="space-y-12">
                <div className="flex justify-between items-center p-8 border border-border hover:border-ink transition-all cursor-pointer group">
                  <div className="space-y-1">
                    <h4 className="text-2xl font-serif">Blind Screening</h4>
                    <p className="text-muted font-serif italic">Reviewers cannot see each other's decisions until the consensus phase.</p>
                  </div>
                  <div className="w-12 h-6 bg-paper border border-border rounded-full relative">
                    <div className="absolute left-1 top-1 w-4 h-4 bg-border group-hover:bg-ink rounded-full" />
                  </div>
                </div>
                <div className="flex justify-between items-center p-8 border border-border hover:border-ink transition-all cursor-pointer group">
                  <div className="space-y-1">
                    <h4 className="text-2xl font-serif">Living Review Mode</h4>
                    <p className="text-muted font-serif italic">Automatically scan for new publications and notify the team.</p>
                  </div>
                  <div className="w-12 h-6 bg-paper border border-border rounded-full relative">
                    <div className="absolute left-1 top-1 w-4 h-4 bg-border group-hover:bg-ink rounded-full" />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Controls */}
      <footer className="flex justify-between items-center pt-12 border-t border-border">
        <button 
          onClick={handleBack}
          disabled={step === 'basic'}
          className="flex items-center gap-2 font-serif italic text-xl disabled:opacity-0 transition-all"
        >
          <ArrowLeft className="w-5 h-5" /> Previous
        </button>
        <button 
          onClick={handleNext}
          className="btn-editorial flex items-center gap-4 text-2xl px-12 py-4"
        >
          {step === 'settings' ? 'Finalize Protocol' : 'Continue'}
          <ArrowRight className="w-6 h-6" />
        </button>
      </footer>
    </div>
  );
}

function PICOField({ label, title, description, value, onChange }: { label: string, title: string, description: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 bg-ink text-paper flex items-center justify-center font-mono text-[10px] rounded-sm">{label}</span>
        <span className="font-serif font-bold italic">{title}</span>
      </div>
      <input 
        type="text" 
        placeholder={description}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-paper border border-border focus:border-ink px-4 py-3 font-serif outline-none transition-all placeholder:text-muted/40"
      />
    </div>
  );
}

