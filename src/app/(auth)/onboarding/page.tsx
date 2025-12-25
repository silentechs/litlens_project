"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  Building2, 
  ArrowRight, 
  ArrowLeft, 
  Loader2,
  Check,
  Sparkles
} from "lucide-react";
import Link from "next/link";

interface OnboardingData {
  name: string;
  institution: string;
  role: string;
}

const ROLES = [
  { id: "researcher", label: "Researcher", description: "Conducting systematic reviews" },
  { id: "student", label: "Student", description: "Learning systematic review methods" },
  { id: "librarian", label: "Librarian", description: "Supporting research teams" },
  { id: "clinician", label: "Clinician", description: "Evidence-based practice" },
  { id: "other", label: "Other", description: "General use" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    institution: "",
    role: "",
  });

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    
    try {
      // Update user profile
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      // Redirect to callback URL
      router.push(callbackUrl);
    } catch (error) {
      console.error("Onboarding error:", error);
      // Still redirect even if profile update fails
      router.push(callbackUrl);
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return data.name.trim().length >= 2;
      case 2:
        return true; // Institution is optional
      case 3:
        return data.role !== "";
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Header */}
      <header className="p-8">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-8 h-8 bg-ink rounded-sm flex items-center justify-center">
            <span className="text-paper font-serif font-bold text-lg">L</span>
          </div>
          <span className="font-serif text-xl tracking-tight">LitLens</span>
        </Link>
      </header>

      {/* Progress Bar */}
      <div className="px-8 max-w-md mx-auto w-full">
        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-ink" : "bg-border"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs font-mono text-muted text-center">
          Step {step} of 3
        </p>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center mb-10">
                  <div className="w-16 h-16 mx-auto mb-6 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h1 className="text-4xl font-serif mb-3">Welcome!</h1>
                  <p className="text-muted font-serif italic">
                    Let&apos;s personalize your experience
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase tracking-widest text-muted">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={data.name}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                    placeholder="Dr. Jane Smith"
                    autoFocus
                    className="w-full px-4 py-4 bg-white border border-border rounded-sm 
                             font-serif text-lg placeholder:text-muted/50
                             focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink
                             transition-all"
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center mb-10">
                  <div className="w-16 h-16 mx-auto mb-6 bg-blue-50 border-2 border-blue-200 rounded-full flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-blue-600" />
                  </div>
                  <h1 className="text-4xl font-serif mb-3">Your Institution</h1>
                  <p className="text-muted font-serif italic">
                    Optional, but helps us understand our users
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-mono uppercase tracking-widest text-muted">
                    Institution / Organization
                  </label>
                  <input
                    type="text"
                    value={data.institution}
                    onChange={(e) => setData({ ...data, institution: e.target.value })}
                    placeholder="University of Example"
                    autoFocus
                    className="w-full px-4 py-4 bg-white border border-border rounded-sm 
                             font-serif text-lg placeholder:text-muted/50
                             focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink
                             transition-all"
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-center mb-10">
                  <div className="w-16 h-16 mx-auto mb-6 bg-amber-50 border-2 border-amber-200 rounded-full flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-amber-600" />
                  </div>
                  <h1 className="text-4xl font-serif mb-3">Your Role</h1>
                  <p className="text-muted font-serif italic">
                    How will you be using LitLens?
                  </p>
                </div>

                <div className="space-y-3">
                  {ROLES.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => setData({ ...data, role: role.id })}
                      className={`w-full p-4 text-left border rounded-sm transition-all
                        ${data.role === role.id 
                          ? "border-ink bg-ink/5" 
                          : "border-border bg-white hover:border-ink/50"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-sm">{role.label}</h3>
                          <p className="text-xs text-muted">{role.description}</p>
                        </div>
                        {data.role === role.id && (
                          <Check className="w-5 h-5 text-emerald-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-10 flex gap-4">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="flex-1 py-4 border border-border text-ink font-serif
                         flex items-center justify-center gap-2 rounded-sm
                         hover:bg-ink/5 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
            )}

            <button
              onClick={step === 3 ? handleComplete : handleNext}
              disabled={!canProceed() || isLoading}
              className="flex-1 py-4 bg-ink text-paper font-serif
                       flex items-center justify-center gap-2 rounded-sm
                       hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Completing...
                </>
              ) : step === 3 ? (
                <>
                  Get Started
                  <Sparkles className="w-5 h-5" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>

          {/* Skip */}
          <div className="mt-6 text-center">
            <button
              onClick={() => router.push(callbackUrl)}
              className="text-sm text-muted hover:text-ink transition-colors font-serif italic"
            >
              Skip for now
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

