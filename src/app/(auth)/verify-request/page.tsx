"use client";

import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function VerifyRequestPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

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
          className="w-full max-w-md text-center"
        >
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-20 h-20 mx-auto mb-8 bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center"
          >
            <Mail className="w-10 h-10 text-emerald-600" />
          </motion.div>

          <h1 className="text-4xl font-serif mb-4">Check Your Email</h1>
          
          <div className="space-y-4 mb-10">
            <p className="text-muted font-serif italic text-lg">
              A magic link has been sent to
            </p>
            {email && (
              <p className="text-xl font-mono bg-white px-4 py-2 rounded-sm border border-border inline-block">
                {email}
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-white border border-border rounded-sm p-6 mb-10 text-left">
            <div className="flex items-start gap-3 mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-bold text-sm mb-1">Click the link in your email</h3>
                <p className="text-sm text-muted">
                  The link will sign you in automatically.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-bold text-sm mb-1">Link expires in 24 hours</h3>
                <p className="text-sm text-muted">
                  For security, the link can only be used once.
                </p>
              </div>
            </div>
          </div>

          {/* Help Text */}
          <div className="space-y-4">
            <p className="text-sm text-muted font-serif italic">
              Didn&apos;t receive the email? Check your spam folder or{" "}
              <Link href="/login" className="underline hover:text-ink">
                try again
              </Link>
              .
            </p>

            <Link 
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-muted hover:text-ink transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

