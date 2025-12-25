import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[600px] flex flex-col items-center justify-center text-center space-y-8">
      <header className="space-y-4">
        <h1 className="text-9xl font-serif italic opacity-10">404</h1>
        <h2 className="text-4xl font-serif">Page Not Found</h2>
        <p className="text-muted font-serif italic text-xl max-w-md mx-auto">
          The research path you are looking for does not exist or has been moved.
        </p>
      </header>
      
      <div className="accent-line w-24 mx-auto" />
      
      <Link href="/">
        <button className="btn-editorial flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Return to Dashboard
        </button>
      </Link>
    </div>
  );
}

