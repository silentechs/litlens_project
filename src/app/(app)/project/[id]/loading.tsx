import { LoadingState } from "@/components/ui/loading-state";

export default function ProjectLoading() {
    return (
        <LoadingState
            title="Loading Project..."
            description="Retrieving project data and analytics."
        />
    );
}
