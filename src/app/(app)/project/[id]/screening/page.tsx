import { Metadata } from "next";
import { ScreeningQueue } from "@/features/screening/components/ScreeningQueue";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Project ${id} | Screening | LitLens`,
    description: `Manage title and abstract screening for Project ${id} on LitLens.`,
  };
}

export default function ScreeningPage() {
  return <ScreeningQueue />;
}

