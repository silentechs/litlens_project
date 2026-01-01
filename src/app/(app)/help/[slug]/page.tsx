import { notFound } from "next/navigation";
import { getDocBySlug } from "@/lib/docs/data";
import { DocViewer } from "@/components/docs/DocViewer";

interface DocPageProps {
    params: Promise<{
        slug: string;
    }>;
}

export default async function DocPage({ params }: DocPageProps) {
    const { slug } = await params;
    const doc = getDocBySlug(slug);

    if (!doc) {
        notFound();
    }

    return (
        <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8 border-b border-border pb-6">
                <p className="text-sm font-medium text-emerald-500 mb-2 uppercase tracking-wider">
                    {doc.category}
                </p>
                <h1 className="font-serif text-4xl font-light tracking-tight text-foreground">
                    {doc.title}
                </h1>
                <p className="text-lg text-muted-foreground mt-4 font-light">
                    {doc.summary}
                </p>
            </div>

            <DocViewer content={doc.content} />
        </div>
    );
}
