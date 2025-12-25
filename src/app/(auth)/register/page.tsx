"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  AlertCircle, 
  Loader2,
  Check,
  X
} from "lucide-react";
import Link from "next/link";

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "Contains uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "Contains lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "Contains number", test: (p) => /\d/.test(p) },
];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordHints, setShowPasswordHints] = useState(false);

  const passwordsMatch = password === confirmPassword;
  const passwordValid = PASSWORD_REQUIREMENTS.every((req) => req.test(password));
  const canSubmit = name && email && password && confirmPassword && passwordsMatch && passwordValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError("Please fill in all fields correctly.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Registration failed");
      }

      // Redirect to login with success message
      router.push("/login?registered=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
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

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-10">
            <h1 className="text-5xl font-serif mb-4">Create Account</h1>
            <p className="text-muted font-serif italic text-lg">
              Join LitLens to streamline your research
            </p>
          </div>

          {/* Error Messages */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-sm flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-800">{error}</p>
            </motion.div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Field */}
            <div className="space-y-2">
              <label 
                htmlFor="name" 
                className="block text-xs font-mono uppercase tracking-widest text-muted"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Jane Smith"
                  required
                  disabled={isLoading}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-border rounded-sm 
                           font-serif text-lg placeholder:text-muted/50
                           focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all"
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label 
                htmlFor="email" 
                className="block text-xs font-mono uppercase tracking-widest text-muted"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-border rounded-sm 
                           font-serif text-lg placeholder:text-muted/50
                           focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label 
                htmlFor="password" 
                className="block text-xs font-mono uppercase tracking-widest text-muted"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setShowPasswordHints(true)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className="w-full pl-12 pr-4 py-4 bg-white border border-border rounded-sm 
                           font-serif text-lg placeholder:text-muted/50
                           focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all"
                />
              </div>
              
              {/* Password Requirements */}
              {showPasswordHints && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-2 p-3 bg-white border border-border rounded-sm"
                >
                  <p className="text-xs font-mono uppercase tracking-widest text-muted mb-2">
                    Password Requirements
                  </p>
                  <ul className="space-y-1">
                    {PASSWORD_REQUIREMENTS.map((req, index) => {
                      const passed = req.test(password);
                      return (
                        <li 
                          key={index}
                          className={`flex items-center gap-2 text-xs ${
                            passed ? "text-emerald-600" : "text-muted"
                          }`}
                        >
                          {passed ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          {req.label}
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <label 
                htmlFor="confirmPassword" 
                className="block text-xs font-mono uppercase tracking-widest text-muted"
              >
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className={`w-full pl-12 pr-4 py-4 bg-white border rounded-sm 
                           font-serif text-lg placeholder:text-muted/50
                           focus:outline-none focus:ring-1
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all ${
                             confirmPassword && !passwordsMatch 
                               ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500" 
                               : "border-border focus:border-ink focus:ring-ink"
                           }`}
                />
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-rose-600">Passwords do not match</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !canSubmit}
              className="w-full py-4 bg-ink text-paper font-serif text-lg
                       flex items-center justify-center gap-3
                       hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all rounded-sm group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-paper text-xs font-mono uppercase tracking-widest text-muted">
                Already have an account?
              </span>
            </div>
          </div>

          {/* Sign In Link */}
          <div className="text-center">
            <Link 
              href="/login"
              className="text-ink underline hover:no-underline font-serif"
            >
              Sign in instead
            </Link>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="p-8 text-center">
        <p className="text-xs font-mono text-muted">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-ink">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-ink">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  );
}

