"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useAppStore } from "@/stores/app-store";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const projectId = params?.id as string | undefined;
  const setCurrentProjectId = useAppStore((state) => state.setCurrentProjectId);

  // Set project context when entering a project
  useEffect(() => {
    if (projectId) {
      setCurrentProjectId(projectId);
    }

    // Cleanup when leaving project
    return () => {
      setCurrentProjectId(null);
    };
  }, [projectId, setCurrentProjectId]);

  if (!projectId) {
    return (
      <div className="py-40 text-center">
        <p className="text-muted font-serif italic text-xl">Project not found</p>
      </div>
    );
  }

  return <>{children}</>;
}

