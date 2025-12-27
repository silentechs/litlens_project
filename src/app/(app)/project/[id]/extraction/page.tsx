import { ExtractionLab } from "@/features/extraction/components/ExtractionLab";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ExtractionPage(props: PageProps) {
  const params = await props.params;
  return <ExtractionLab projectId={params.id} />;
}

