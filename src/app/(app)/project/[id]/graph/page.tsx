
import { use } from "react";
import { CitationGraph } from "@/features/graphs/components/CitationGraph";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default function GraphPage({ params }: PageProps) {
    const { id } = use(params);
    return <CitationGraph projectId={id} />;
}
