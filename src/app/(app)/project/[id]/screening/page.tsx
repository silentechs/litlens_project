import { Metadata } from "next";
import { ScreeningQueue } from "@/features/screening/components/ScreeningQueue";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Project ${id} | Screening | LitLens`,
    description: `Manage title and abstract screening for Project ${id} on LitLens.`,
  };
}

import { PhaseManager } from "@/features/screening/components/PhaseManager";

export default async function ScreeningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-8 max-w-7xl mx-auto px-6 py-8">
      <PhaseManager projectId={id} />
      <ScreeningQueue />
    </div>
  );
}

