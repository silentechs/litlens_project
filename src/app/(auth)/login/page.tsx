"use client";

import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, AlertCircle, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

type AuthMode = "password" | "magic-link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("password");
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const errorParam = searchParams.get("error");
  
  // Refs for form inputs to get DOM values as fallback
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get values from state, or fallback to DOM values (for browser automation)
    const emailValue = email || emailRef.current?.value || "";
    const passwordValue = password || passwordRef.current?.value || "";
    
    if (!emailValue || !passwordValue) {
      setError("Please enter both email and password.");
      return;
    }
    
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: emailValue.trim(),
        password: passwordValue,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        if (result.error === "CredentialsSignin") {
          setError("Invalid email or password. Please try again.");
        } else {
          setError(result.error);
        }
      } else if (result?.ok) {
        // Use window.location for more reliable navigation after auth
        window.location.href = callbackUrl;
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("resend", {
        email,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setError("Failed to send magic link. Please try again.");
      } else {
        window.location.href = `/verify-request?email=${encodeURIComponent(email)}`;
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = authMode === "password" ? handlePasswordLogin : handleMagicLink;

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
            <h1 className="text-5xl font-serif mb-4">Welcome Back</h1>
            <p className="text-muted font-serif italic text-lg">
              Sign in to continue your research
            </p>
          </div>

          {/* Auth Mode Toggle */}
          <div className="flex bg-white border border-border rounded-sm p-1 mb-8">
            <button
              type="button"
              onClick={() => setAuthMode("password")}
              className={`flex-1 py-2.5 text-sm font-mono uppercase tracking-wider rounded-sm transition-all
                ${authMode === "password" 
                  ? "bg-ink text-paper" 
                  : "text-muted hover:text-ink"
                }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("magic-link")}
              className={`flex-1 py-2.5 text-sm font-mono uppercase tracking-wider rounded-sm transition-all
                ${authMode === "magic-link" 
                  ? "bg-ink text-paper" 
                  : "text-muted hover:text-ink"
                }`}
            >
              Magic Link
            </button>
          </div>

          {/* Error Messages */}
          {(error || errorParam) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-sm flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-800">
                {error || getErrorMessage(errorParam)}
              </p>
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
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
                  ref={emailRef}
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

            {/* Password Field (only for password mode) */}
            <AnimatePresence mode="wait">
              {authMode === "password" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2 overflow-hidden"
                >
                  <label 
                    htmlFor="password" 
                    className="block text-xs font-mono uppercase tracking-widest text-muted"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                    <input
                      ref={passwordRef}
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required={authMode === "password"}
                      disabled={isLoading}
                      minLength={8}
                      className="w-full pl-12 pr-4 py-4 bg-white border border-border rounded-sm 
                               font-serif text-lg placeholder:text-muted/50
                               focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink
                               disabled:opacity-50 disabled:cursor-not-allowed
                               transition-all"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-ink text-paper font-serif text-lg
                       flex items-center justify-center gap-3
                       hover:bg-ink/90 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all rounded-sm group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {authMode === "password" ? "Signing in..." : "Sending link..."}
                </>
              ) : authMode === "password" ? (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              ) : (
                <>
                  Send Magic Link
                  <Sparkles className="w-5 h-5" />
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
                {authMode === "password" ? "Forgot password?" : "Secure & Passwordless"}
              </span>
            </div>
          </div>

          {/* Secondary Actions */}
          <div className="text-center space-y-4">
            {authMode === "password" ? (
              <p className="text-sm text-muted font-serif italic">
                Forgot your password?{" "}
                <button
                  type="button"
                  onClick={() => setAuthMode("magic-link")}
                  className="underline hover:text-ink transition-colors"
                >
                  Use magic link instead
                </button>
              </p>
            ) : (
              <p className="text-sm text-muted font-serif italic">
                We&apos;ll send you a secure link to sign in instantly.
              </p>
            )}

            <p className="text-sm text-muted">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-ink underline hover:no-underline font-medium">
                Create one
              </Link>
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="p-8 text-center">
        <p className="text-xs font-mono text-muted">
          By continuing, you agree to our{" "}
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

function getErrorMessage(error: string | null): string {
  switch (error) {
    case "Configuration":
      return "There is a problem with the server configuration.";
    case "AccessDenied":
      return "Access denied. You may not have permission to sign in.";
    case "Verification":
      return "The verification link has expired or has already been used.";
    case "CredentialsSignin":
      return "Invalid email or password. Please check your credentials.";
    case "OAuthAccountNotLinked":
      return "This email is already associated with another account.";
    case "EmailSignin":
      return "Could not send the verification email. Please try again.";
    case "SessionRequired":
      return "Please sign in to access this page.";
    default:
      return "An error occurred. Please try again.";
  }
}
