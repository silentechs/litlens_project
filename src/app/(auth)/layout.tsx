import { Suspense } from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="animate-pulse text-muted font-serif italic">Loading...</div>
      </div>
    }>
      {children}
    </Suspense>
  );
}

