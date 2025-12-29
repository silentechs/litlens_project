import { LoadingState } from "@/components/ui/loading-state";

export default function AppLoading() {
  return (
    <div className="h-full flex items-center justify-center">
      <LoadingState title="Loading Application..." description="Preparing your workspace." />
    </div>
  );
}
