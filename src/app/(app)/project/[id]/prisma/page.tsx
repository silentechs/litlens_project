"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProject } from "@/features/projects/api/queries";
import { getPRISMAFlowData } from "@/lib/services/screening-analytics";
import { PRISMAFlowDiagram } from "@/features/screening/components/PRISMAFlowDiagram";
import { Loader2, AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PRISMAFlowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const { data: project } = useProject(projectId);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["prisma-flow", projectId],
    queryFn: async () => {
      const flowData = await getPRISMAFlowData(projectId);
      return flowData;
    },
  });

  if (isLoading) {
    return (
      <div className="py-40 text-center space-y-8">
        <Loader2 className="w-12 h-12 animate-spin mx-auto text-muted" />
        <p className="text-muted font-serif italic text-xl">
          Generating PRISMA flow diagram...
        </p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-40 text-center space-y-8">
        <AlertCircle className="w-12 h-12 mx-auto text-rose-500" />
        <div className="space-y-3">
          <h2 className="text-3xl font-serif text-ink">
            Unable to generate diagram
          </h2>
          <p className="text-muted font-serif italic text-lg max-w-md mx-auto">
            There may not be enough screening data yet.
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-4">
          <FileText className="w-8 h-8 text-intel-blue" />
          <h1 className="text-6xl font-serif">PRISMA Flow Diagram</h1>
        </div>
        <p className="text-muted font-serif italic text-xl max-w-3xl">
          Publication-ready flow diagram following PRISMA 2020 guidelines. Export for your
          manuscript or share with collaborators.
        </p>
      </header>

      <div className="accent-line" />

      {/* PRISMA Diagram */}
      <PRISMAFlowDiagram data={data} projectTitle={project?.title} />

      {/* Information */}
      <div className="bg-intel-blue/5 border border-intel-blue/20 rounded-sm p-6">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-intel-blue font-bold mb-3">
          About PRISMA 2020
        </h3>
        <p className="font-serif italic text-sm text-muted leading-relaxed">
          The PRISMA (Preferred Reporting Items for Systematic Reviews and Meta-Analyses)
          flow diagram provides a visual representation of your study selection process.
          This diagram is automatically generated from your screening decisions and meets
          the requirements for publication in major journals.
        </p>
      </div>
    </div>
  );
}

