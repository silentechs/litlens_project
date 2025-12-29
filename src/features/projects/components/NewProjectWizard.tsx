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
  Plus,
  Loader2,
  X,
  Mail
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCreateProject } from "../api/queries";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Step = 'basic' | 'pico' | 'team' | 'settings';

export function NewProjectWizard() {
  const router = useRouter();
  const { mutate: createProject, isPending } = useCreateProject();

  const [step, setStep] = useState<Step>('basic');
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    pico: { p: "", i: "", c: "", o: "" },
    team: [] as string[],
    isPublic: false,
    blindScreening: true,
    livingReview: false // Not currently in API but kept for UI state
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
    } else {
      handleFinalize();
    }
  };

  const handleBack = () => {
    const currentIndex = steps.findIndex(s => s.id === step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1].id);
    }
  };

  const handleFinalize = () => {
    if (!formData.title) {
      toast.error("Please provide a project title");
      setStep('basic');
      return;
    }

    createProject({
      title: formData.title,
      description: formData.description,
      population: formData.pico.p,
      intervention: formData.pico.i,
      comparison: formData.pico.c,
      outcome: formData.pico.o,
      isPublic: formData.isPublic,
      blindScreening: formData.blindScreening,
      // livingReview ignored for now as not in API schema
    }, {
      onSuccess: async (data) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const projectId = (data as any).id;
        
        // Send invitations to team members
        if (formData.team.length > 0) {
          const invitePromises = formData.team.map(email =>
            fetch(`/api/projects/${projectId}/members`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, role: 'REVIEWER' }),
            }).catch(err => console.error(`Failed to invite ${email}:`, err))
          );
          
          await Promise.all(invitePromises);
          toast.success(`Project created! ${formData.team.length} invitation(s) sent.`);
        } else {
          toast.success("Project initialized successfully");
        }
        
        // Smart Navigation: Redirect to Import Lab for onboarding
        router.push(`/project/${projectId}/import`);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create project");
      }
    });
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
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-transparent border-b-2 border-border focus:border-ink py-4 text-4xl font-serif outline-none transition-all placeholder:text-muted/20"
                    autoFocus
                  />
                </div>
                <div className="space-y-4">
                  <label className="font-serif italic text-2xl text-muted">A brief conceptual summary</label>
                  <textarea
                    rows={4}
                    placeholder="Describe the scope and objective..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                    onChange={(v) => setFormData({ ...formData, pico: { ...formData.pico, p: v } })}
                  />
                  <PICOField
                    label="I"
                    title="Intervention"
                    description="What is being tested?"
                    value={formData.pico.i}
                    onChange={(v) => setFormData({ ...formData, pico: { ...formData.pico, i: v } })}
                  />
                  <PICOField
                    label="C"
                    title="Comparison"
                    description="Control group or alternative?"
                    value={formData.pico.c}
                    onChange={(v) => setFormData({ ...formData, pico: { ...formData.pico, c: v } })}
                  />
                  <PICOField
                    label="O"
                    title="Outcome"
                    description="What are you measuring?"
                    value={formData.pico.o}
                    onChange={(v) => setFormData({ ...formData, pico: { ...formData.pico, o: v } })}
                  />
                </div>
              </div>
            )}

            {step === 'team' && (
              <TeamInviteStep 
                emails={formData.team}
                onEmailsChange={(emails) => setFormData({ ...formData, team: emails })}
              />
            )}

            {step === 'settings' && (
              <div className="space-y-12">
                <div
                  onClick={() => setFormData(prev => ({ ...prev, blindScreening: !prev.blindScreening }))}
                  className={cn(
                    "flex justify-between items-center p-8 border hover:border-ink transition-all cursor-pointer group select-none",
                    formData.blindScreening ? "border-ink bg-white shadow-sm" : "border-border"
                  )}
                >
                  <div className="space-y-1">
                    <h4 className="text-2xl font-serif">Blind Screening</h4>
                    <p className="text-muted font-serif italic">Reviewers cannot see each other's decisions until the consensus phase.</p>
                  </div>
                  <div className={cn(
                    "w-12 h-6 rounded-full relative transition-colors",
                    formData.blindScreening ? "bg-ink" : "bg-paper border border-border"
                  )}>
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full transition-all",
                      formData.blindScreening ? "left-7 bg-white" : "left-1 bg-border group-hover:bg-ink"
                    )} />
                  </div>
                </div>

                <div
                  onClick={() => setFormData(prev => ({ ...prev, livingReview: !prev.livingReview }))}
                  className={cn(
                    "flex justify-between items-center p-8 border hover:border-ink transition-all cursor-pointer group select-none",
                    formData.livingReview ? "border-ink bg-white shadow-sm" : "border-border"
                  )}
                >
                  <div className="space-y-1">
                    <h4 className="text-2xl font-serif">Living Review Mode</h4>
                    <p className="text-muted font-serif italic">Automatically scan for new publications and notify the team.</p>
                  </div>
                  <div className={cn(
                    "w-12 h-6 rounded-full relative transition-colors",
                    formData.livingReview ? "bg-ink" : "bg-paper border border-border"
                  )}>
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full transition-all",
                      formData.livingReview ? "left-7 bg-white" : "left-1 bg-border group-hover:bg-ink"
                    )} />
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
          disabled={step === 'basic' || isPending}
          className="flex items-center gap-2 font-serif italic text-xl disabled:opacity-0 transition-all"
        >
          <ArrowLeft className="w-5 h-5" /> Previous
        </button>
        <button
          onClick={handleNext}
          disabled={isPending}
          className="btn-editorial flex items-center gap-4 text-2xl px-12 py-4 disabled:opacity-70"
        >
          {isPending ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Initializing...
            </>
          ) : step === 'settings' ? (
            <>
              Finalize Protocol
              <Check className="w-6 h-6" />
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-6 h-6" />
            </>
          )}
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

function TeamInviteStep({ emails, onEmailsChange }: { emails: string[], onEmailsChange: (emails: string[]) => void }) {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const addEmail = () => {
    const email = inputValue.trim().toLowerCase();
    
    if (!email) return;
    
    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }
    
    if (emails.includes(email)) {
      setError("This email has already been added");
      return;
    }
    
    onEmailsChange([...emails, email]);
    setInputValue("");
    setError("");
  };

  const removeEmail = (emailToRemove: string) => {
    onEmailsChange(emails.filter(e => e !== emailToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail();
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="font-serif text-3xl">Invite Collaborators</h3>
        <p className="text-muted font-serif italic">Research is a collective endeavor. Add team members to collaborate on screening and review.</p>
      </div>

      {/* Email Input */}
      <div className="space-y-3">
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted">
          Collaborator Email
        </label>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <Input
              type="email"
              placeholder="colleague@university.edu"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              className="pl-12 h-14 text-lg font-serif border-border focus:border-ink"
            />
          </div>
          <Button 
            type="button"
            onClick={addEmail}
            className="h-14 px-6 bg-ink text-paper hover:bg-ink/90"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add
          </Button>
        </div>
        {error && (
          <p className="text-red-500 text-sm font-serif italic">{error}</p>
        )}
      </div>

      {/* Added Emails List */}
      {emails.length > 0 ? (
        <div className="space-y-3">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Pending Invitations ({emails.length})
          </label>
          <div className="space-y-2">
            {emails.map((email) => (
              <div
                key={email}
                className="flex items-center justify-between p-4 bg-paper border border-border hover:border-ink transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-ink/5 rounded-full flex items-center justify-center">
                    <Users className="w-5 h-5 text-ink/60" />
                  </div>
                  <div>
                    <p className="font-serif">{email}</p>
                    <p className="text-xs text-muted font-mono uppercase tracking-wider">Reviewer</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-border">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted/40" />
          <p className="text-muted font-serif italic">No collaborators added yet</p>
          <p className="text-sm text-muted/60 mt-1">You can also invite team members after creating the project</p>
        </div>
      )}
    </div>
  );
}
