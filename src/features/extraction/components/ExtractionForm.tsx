"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSaveExtractionData, useExtractionData } from "../api/queries";

interface ExtractionField {
    id: string;
    type: 'text' | 'choice' | 'date' | 'numeric' | 'boolean';
    label: string;
    description?: string;
    required: boolean;
    options?: string[];
}

interface ExtractionTemplate {
    id: string;
    name: string;
    fields: ExtractionField[];
}

interface ExtractionFormProps {
    projectId: string;
    workId: string;
    template: ExtractionTemplate;
    onBack: () => void;
}

export function ExtractionForm({ projectId, workId, template, onBack }: ExtractionFormProps) {
    const { data: existingData, isLoading: isLoadingData } = useExtractionData(projectId, workId);
    const { mutate: saveData, isPending: isSaving } = useSaveExtractionData(projectId);

    // We need to initialize form with existing data if available
    const { register, handleSubmit, reset, formState: { errors } } = useForm();

    useEffect(() => {
        if (existingData && existingData.data) {
            reset(existingData.data);
        }
    }, [existingData, reset]);

    const onSubmit = (data: any) => {
        saveData({
            projectWorkId: workId,
            templateId: template.id,
            data
        }, {
            onSuccess: () => {
                toast.success("Extraction data saved");
            },
            onError: () => {
                toast.error("Failed to save extraction data");
            }
        });
    };

    if (isLoadingData) {
        return (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-muted" />
                <p className="font-serif italic text-muted">Loading existing data...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-32">
            <header className="flex items-center justify-between border-b border-border pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 border border-border hover:bg-paper transition-all rounded-full">
                        <ArrowLeft className="w-5 h-5 text-muted" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-serif">Data Extraction</h2>
                        <p className="text-muted text-sm font-mono uppercase tracking-widest">{template.name}</p>
                    </div>
                </div>
                <button
                    onClick={handleSubmit(onSubmit)}
                    disabled={isSaving}
                    className="btn-editorial flex items-center gap-2"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Progress
                </button>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
                {template.fields.map((field) => (
                    <div key={field.id} className="space-y-4">
                        <label className="block text-sm font-mono uppercase tracking-widest text-muted">
                            {field.label} {field.required && <span className="text-rose-500">*</span>}
                        </label>

                        {field.type === 'text' && (
                            <textarea
                                {...register(field.id, { required: field.required })}
                                className={cn(
                                    "w-full bg-paper/30 border p-4 font-serif text-lg outline-none transition-all rounded-sm resize-none",
                                    errors[field.id] ? "border-rose-400 focus:border-rose-600" : "border-border focus:border-ink"
                                )}
                                rows={4}
                                placeholder="Enter narrative text..."
                            />
                        )}

                        {field.type === 'numeric' && (
                            <input
                                type="number"
                                step="any"
                                {...register(field.id, { required: field.required })}
                                className={cn(
                                    "w-full bg-paper/30 border p-4 font-mono text-lg outline-none transition-all rounded-sm",
                                    errors[field.id] ? "border-rose-400 focus:border-rose-600" : "border-border focus:border-ink"
                                )}
                                placeholder="0.00"
                            />
                        )}

                        {/* Add other field types as needed */}

                        {field.description && (
                            <p className="text-xs text-muted/60 italic">{field.description}</p>
                        )}
                        {errors[field.id] && (
                            <p className="text-xs text-rose-500 font-bold">This field is required</p>
                        )}
                    </div>
                ))}
            </form>
        </div>
    );
}
