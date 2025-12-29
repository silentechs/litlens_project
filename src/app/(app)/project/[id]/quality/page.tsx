import { QualityAssessment } from "@/features/quality/components/QualityAssessment";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function QualityPage(props: PageProps) {
  const params = await props.params;
  return <QualityAssessment projectId={params.id} />;
}

