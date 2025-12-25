"use client";

import { useProject, useUpdateProject } from "@/features/projects/api/queries";
import { useAppStore } from "@/stores/app-store";
import { Loader2, AlertCircle, Save, Shield, Users } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function ProjectSettingsPage({ params }: { params: { id: string } }) {
    const { data: project, isLoading, isError } = useProject(params.id);
    const updateProject = useUpdateProject();

    const [requireDualScreening, setRequireDualScreening] = useState(false);
    const [blindScreening, setBlindScreening] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (project) {
            setRequireDualScreening(project.requireDualScreening);
            setBlindScreening(project.blindScreening);
        }
    }, [project]);

    const handleSave = () => {
        updateProject.mutate(
            {
                id: params.id,
                requireDualScreening,
                blindScreening,
            },
            {
                onSuccess: () => {
                    setHasChanges(false);
                    toast.success("Project settings updated");
                },
            }
        );
    };

    const handleToggle = (setter: (val: boolean) => void, val: boolean) => {
        setter(val);
        setHasChanges(true);
    };

    if (isLoading) {
        return (
            <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted" />
                <p className="mt-4 text-muted font-serif italic">Loading settings...</p>
            </div>
        );
    }

    if (isError || !project) {
        return (
            <div className="py-20 text-center">
                <AlertCircle className="w-8 h-8 mx-auto text-rose-500" />
                <p className="mt-4 text-ink font-serif">Failed to load project settings</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-12 pb-20">
            <header className="space-y-4">
                <h1 className="text-4xl font-serif text-ink">Project Settings</h1>
                <p className="text-muted font-serif text-lg">
                    Configure workflow rules and screening parameters for <strong>{project.title}</strong>.
                </p>
            </header>

            <div className="accent-line" />

            <div className="space-y-10">
                {/* Screening Workflow Section */}
                <section className="space-y-6">
                    <h2 className="text-xl font-serif font-bold flex items-center gap-3">
                        <Users className="w-5 h-5" />
                        Screening Workflow
                    </h2>

                    <div className="bg-white border border-border rounded-sm divide-y divide-border/50">
                        {/* Dual Screening Toggle */}
                        <div className="p-6 flex items-start justify-between gap-6">
                            <div className="space-y-2">
                                <label className="text-base font-bold text-ink">Two-Person Consensus</label>
                                <p className="text-sm text-muted max-w-lg leading-relaxed">
                                    Require two independent reviewers to screen each study. Disagreements will be flagged as conflicts that need adjudication.
                                </p>
                                {!requireDualScreening && (
                                    <div className="text-[10px] uppercase font-mono tracking-widest text-amber-600 font-bold pt-1">
                                        Current Mode: Single Reviewer (Speed)
                                    </div>
                                )}
                            </div>
                            <Switch
                                checked={requireDualScreening}
                                onCheckedChange={(val) => handleToggle(setRequireDualScreening, val)}
                            />
                        </div>

                        {/* Blind Screening Toggle */}
                        <div className="p-6 flex items-start justify-between gap-6">
                            <div className="space-y-2">
                                <label className="text-base font-bold text-ink">Blind Screening</label>
                                <p className="text-sm text-muted max-w-lg leading-relaxed">
                                    Hide decisions made by other reviewers until consensus is reached. This reduces bias but limits collaboration during the active phase.
                                </p>
                            </div>
                            <Switch
                                checked={blindScreening}
                                onCheckedChange={(val) => handleToggle(setBlindScreening, val)}
                            />
                        </div>
                    </div>
                </section>

                {/* Danger Zone (placeholder) */}
                <section className="space-y-6 pt-10">
                    <h2 className="text-xl font-serif font-bold flex items-center gap-3 text-rose-700">
                        <Shield className="w-5 h-5" />
                        Danger Zone
                    </h2>
                    <div className="p-6 bg-rose-50 border border-rose-100 rounded-sm">
                        <p className="text-sm text-rose-800">
                            Project archival and deletion options will be available here once the project is completed.
                        </p>
                    </div>
                </section>
            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-border z-10 flex justify-end gap-4">
                <Button
                    variant="outline"
                    onClick={() => {
                        setRequireDualScreening(project.requireDualScreening);
                        setBlindScreening(project.blindScreening);
                        setHasChanges(false);
                    }}
                    disabled={!hasChanges}
                >
                    Reset
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={!hasChanges || updateProject.isPending}
                    className="bg-ink text-white hover:bg-ink/90 min-w-[120px]"
                >
                    {updateProject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                </Button>
            </div>
        </div>
    );
}
