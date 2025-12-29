import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-paper p-8 text-center">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6">
                <FileQuestion className="w-10 h-10 text-amber-600" />
            </div>

            <h1 className="text-4xl font-serif font-bold text-ink mb-3">Page Not Found</h1>
            <p className="text-muted font-serif italic text-xl max-w-md mb-8 leading-relaxed">
                We couldn't find the page you're looking for. It might have been moved or doesn't exist.
            </p>

            <Button asChild className="bg-ink text-white hover:bg-ink/90">
                <Link href="/dashboard">
                    Return Home
                </Link>
            </Button>
        </div>
    );
}
