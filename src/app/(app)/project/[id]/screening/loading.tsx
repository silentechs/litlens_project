import { LoadingState } from "@/components/ui/loading-state";

export default function ScreeningLoading() {
    return (
        <LoadingState
            title="Loading Screening Queue..."
            description="Preparing studies for review."
        />
    );
}
