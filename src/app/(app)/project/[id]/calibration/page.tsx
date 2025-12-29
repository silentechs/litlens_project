"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Target,
  Plus,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function CalibrationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [phase, setPhase] = useState<"TITLE_ABSTRACT" | "FULL_TEXT">("TITLE_ABSTRACT");
  const [sampleSize, setSampleSize] = useState("20");
  const [targetKappa, setTargetKappa] = useState("0.8");

  // Fetch calibration rounds
  const { data, isLoading, isError } = useQuery({
    queryKey: ["calibration-rounds", projectId],
    queryFn: async () => {
      const response = await fetch(
        `/api/projects/${projectId}/calibration/rounds`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch calibration rounds");
      }

      const result = await response.json();
      return result.data;
    },
  });

  // Create round mutation
  const createRound = useMutation({
    mutationFn: async (data: {
      phase: string;
      sampleSize: number;
      targetAgreement: number;
    }) => {
      const response = await fetch(
        `/api/projects/${projectId}/calibration/rounds`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          credentials: "include",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to create calibration round");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calibration-rounds", projectId] });
      setShowCreateForm(false);
      toast.success("Calibration round created");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCreateRound = () => {
    createRound.mutate({
      phase,
      sampleSize: parseInt(sampleSize),
      targetAgreement: parseFloat(targetKappa),
    });
  };

  if (isLoading) {
    return (
      <div className="py-40 text-center space-y-8">
        <Loader2 className="w-12 h-12 animate-spin mx-auto text-muted" />
        <p className="text-muted font-serif italic text-xl">
          Loading calibration rounds...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-40 text-center space-y-8">
        <AlertCircle className="w-12 h-12 mx-auto text-rose-500" />
        <p className="text-ink font-serif text-xl">Failed to load calibration rounds</p>
      </div>
    );
  }

  const rounds = data?.items || [];

  return (
    <div className="space-y-12 pb-20">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Calibration Rounds</h1>
          <p className="text-muted font-serif italic text-xl max-w-3xl">
            Test inter-rater reliability before full screening. Ensure reviewers have
            aligned understanding of eligibility criteria.
          </p>
        </div>

        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-intel-blue text-white hover:bg-intel-blue/90 font-mono text-xs uppercase tracking-widest"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Calibration
        </Button>
      </header>

      <div className="accent-line" />

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white border border-border rounded-sm p-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-serif font-bold">Create Calibration Round</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Screening Phase
              </label>
              <Select value={phase} onValueChange={(v: any) => setPhase(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TITLE_ABSTRACT">Title & Abstract</SelectItem>
                  <SelectItem value="FULL_TEXT">Full Text</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Sample Size
              </label>
              <Input
                type="number"
                value={sampleSize}
                onChange={(e) => setSampleSize(e.target.value)}
                min={10}
                max={100}
                className="font-mono"
              />
              <p className="text-xs font-serif italic text-muted">
                Number of studies to screen (10-100)
              </p>
            </div>

            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Target Kappa
              </label>
              <Input
                type="number"
                value={targetKappa}
                onChange={(e) => setTargetKappa(e.target.value)}
                min={0}
                max={1}
                step={0.1}
                className="font-mono"
              />
              <p className="text-xs font-serif italic text-muted">
                Minimum acceptable agreement (0.6-0.8 recommended)
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleCreateRound}
              disabled={createRound.isPending}
              className="bg-ink text-white hover:bg-ink/90 font-mono text-xs uppercase tracking-widest min-w-[160px]"
            >
              {createRound.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Target className="w-4 h-4 mr-2" />
              )}
              Create Round
            </Button>
          </div>
        </div>
      )}

      {/* Rounds List */}
      {rounds.length > 0 ? (
        <div className="space-y-4">
          {rounds.map((round: any) => (
            <CalibrationRoundCard
              key={round.id}
              round={round}
              projectId={projectId}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center space-y-4">
          <Target className="w-12 h-12 mx-auto text-muted opacity-20" />
          <h3 className="text-2xl font-serif italic text-muted">
            No calibration rounds yet
          </h3>
          <p className="text-sm font-serif italic text-muted max-w-md mx-auto">
            Create a calibration round to test agreement between reviewers before starting
            full screening.
          </p>
          <Button
            onClick={() => setShowCreateForm(true)}
            variant="outline"
            className="font-mono text-xs uppercase tracking-widest"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create First Round
          </Button>
        </div>
      )}
    </div>
  );
}

function CalibrationRoundCard({ round, projectId }: { round: any; projectId: string }) {
  const statusConfig = {
    PENDING: {
      color: "bg-amber-50 text-amber-700 border-amber-200",
      icon: <Clock className="w-4 h-4" />,
    },
    IN_PROGRESS: {
      color: "bg-blue-50 text-blue-700 border-blue-200",
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
    },
    COMPLETED: {
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
  };

  const config = statusConfig[round.status as keyof typeof statusConfig];

  return (
    <div className="bg-white border border-border rounded-sm p-6 hover:shadow-editorial transition-shadow">
      <div className="flex justify-between items-start">
        <div className="space-y-4 flex-1">
          <div className="flex items-center gap-4">
            <span
              className={cn(
                "px-3 py-1 border rounded-full text-[10px] font-mono uppercase tracking-widest flex items-center gap-2",
                config.color
              )}
            >
              {config.icon}
              {round.status}
            </span>
            <span className="font-mono text-xs text-muted">
              {round.phase.replace("_", " ")}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Stat label="Sample Size" value={round.sampleSize.toString()} />
            <Stat label="Target Kappa" value={round.targetAgreement.toFixed(2)} />
            {round.kappaScore !== null && (
              <Stat
                label="Actual Kappa"
                value={round.kappaScore.toFixed(3)}
                highlight={round.kappaScore >= round.targetAgreement}
              />
            )}
            <Stat label="Reviewers" value={round.reviewersParticipated.toString()} />
          </div>

          {round.kappaScore !== null && (
            <div
              className={cn(
                "px-4 py-2 rounded-sm text-sm font-serif italic",
                round.kappaScore >= round.targetAgreement
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              )}
            >
              {round.kappaScore >= round.targetAgreement
                ? "✓ Target agreement achieved"
                : "⚠ Below target - consider team discussion"}
            </div>
          )}
        </div>

        {round.status === "COMPLETED" && (
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs uppercase tracking-widest"
            onClick={() => {
              // Navigate to results (future enhancement)
              toast.info("Calibration results view coming soon");
            }}
          >
            <Award className="w-3 h-3 mr-2" />
            View Results
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div
        className={cn(
          "text-2xl font-serif font-bold",
          highlight ? "text-emerald-700" : "text-ink"
        )}
      >
        {value}
      </div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted">
        {label}
      </div>
    </div>
  );
}

