"use client";

import { useState } from "react";
import {
  Plus,
  Settings,
  GripVertical,
  Trash2,
  ChevronDown,
  ToggleLeft,
  Type,
  ListOrdered,
  Calendar,
  Binary,
  Hash,
  Sparkles,
  Save,
  Play,
  ChevronLeft,
  Loader2
} from "lucide-react";
import { motion, Reorder } from "framer-motion";
import { cn } from "@/lib/utils";

type FieldType = 'text' | 'choice' | 'date' | 'numeric' | 'boolean';

interface ExtractionField {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  required: boolean;
  options?: string[];
}

const FIELD_TYPES: { type: FieldType; icon: React.ReactNode; label: string }[] = [
  { type: 'text', icon: <Type className="w-4 h-4" />, label: "Narrative / Text" },
  { type: 'choice', icon: <ListOrdered className="w-4 h-4" />, label: "Single/Multi Choice" },
  { type: 'numeric', icon: <Binary className="w-4 h-4" />, label: "Numeric Data" },
  { type: 'date', icon: <Calendar className="w-4 h-4" />, label: "Date" },
  { type: 'boolean', icon: <ToggleLeft className="w-4 h-4" />, label: "Boolean (Yes/No)" },
];

import { useCreateExtractionTemplate } from "../api/queries";
import { toast } from "sonner";

interface ExtractionBuilderProps {
  projectId: string;
  onBack?: () => void;
}

export function ExtractionBuilder({ projectId, onBack }: ExtractionBuilderProps) {
  const [templateName, setTemplateName] = useState("New Extraction Template");
  const { mutate: createTemplate, isPending } = useCreateExtractionTemplate(projectId);

  const [fields, setFields] = useState<ExtractionField[]>([
    { id: "f1", type: 'text', label: "Sample Population Details", required: true },
    { id: "f2", type: 'numeric', label: "Mean Age", required: false },
  ]);

  const handleSave = () => {
    if (!templateName.trim()) {
      toast.error("Please provide a template name");
      return;
    }

    createTemplate({
      name: templateName,
      description: "Created via Builder", // Could add a field for this
      fields: fields
    }, {
      onSuccess: () => {
        toast.success("Template saved successfully");
        if (onBack) onBack();
      },
      onError: () => {
        toast.error("Failed to save template");
      }
    });
  };

  const addField = (type: FieldType) => {
    const newField: ExtractionField = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      label: "New " + type + " field",
      required: false
    };
    setFields([...fields, newField]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const toggleRequired = (id: string) => {
    setFields(fields.map(f => f.id === id ? { ...f, required: !f.required } : f));
  };

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <button onClick={onBack} className="p-2 border border-border hover:bg-paper transition-all rounded-full">
                <ChevronLeft className="w-5 h-5 text-muted" />
              </button>
            )}
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="text-6xl font-serif bg-transparent border-none outline-none placeholder:text-muted/50 w-full"
              placeholder="Template Name"
            />
          </div>
          <p className="text-muted font-serif italic text-xl">Designing the instrument for evidence harvesting.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-6 py-2 border border-border text-xs font-mono uppercase tracking-widest hover:bg-paper transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Template
          </button>
          <button className="btn-editorial flex items-center gap-2">
            <Play className="w-4 h-4" /> Deploy to Workspace
          </button>
        </div>
      </header>

      <div className="accent-line" />

      <div className="editorial-grid gap-12">
        {/* Field Palette (Aside) */}
        <aside className="col-span-12 md:col-span-3 space-y-8 text-ink">
          <div className="bg-white border border-border p-8 space-y-6 sticky top-8 shadow-sm">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted border-b border-border pb-4">Field Library</h3>
            <div className="space-y-1">
              {FIELD_TYPES.map((ft) => (
                <button
                  key={ft.type}
                  onClick={() => addField(ft.type)}
                  className="w-full flex items-center gap-3 p-3 border border-transparent hover:border-ink hover:bg-paper transition-all group rounded-sm"
                >
                  <div className="w-8 h-8 border border-border flex items-center justify-center group-hover:border-ink transition-colors bg-paper">
                    {ft.icon}
                  </div>
                  <span className="font-serif italic text-lg leading-none">{ft.label}</span>
                </button>
              ))}
            </div>

            <div className="accent-line opacity-5" />

            <div className="p-4 bg-intel-blue/5 border border-intel-blue/20 space-y-3 rounded-sm shadow-sm">
              <div className="flex items-center gap-2 text-intel-blue">
                <Sparkles className="w-3 h-3" />
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold">AI Suggestion</span>
              </div>
              <p className="text-[11px] font-serif italic text-intel-blue/70 leading-relaxed">
                Based on your PICO, you might need a "Treatment Duration" numeric field.
              </p>
            </div>
          </div>
        </aside>

        {/* Builder Canvas */}
        <main className="col-span-12 md:col-span-9 space-y-8">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Form Instrument ({fields.length} Fields)</h3>
            <span className="text-[10px] font-mono text-muted uppercase tracking-widest italic opacity-50">Draft // Version 1.0</span>
          </div>

          <Reorder.Group axis="y" values={fields} onReorder={setFields} className="space-y-4">
            {fields.map((field) => (
              <Reorder.Item key={field.id} value={field}>
                <div className="bg-white border border-border p-8 group hover:border-ink transition-all relative shadow-sm hover:shadow-editorial rounded-sm overflow-hidden">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-20 cursor-grab active:cursor-grabbing transition-opacity">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <div className="flex justify-between items-start pl-4 gap-8">
                    <div className="space-y-6 flex-1">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-2 py-0.5 bg-paper border border-border rounded-sm">
                          <span className="text-[8px] font-mono uppercase tracking-tighter text-muted">Type:</span>
                          <span className="text-[10px] font-mono uppercase tracking-tighter font-bold">{field.type}</span>
                        </div>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => setFields(fields.map(f => f.id === field.id ? { ...f, label: e.target.value } : f))}
                          className="text-3xl font-serif italic outline-none border-b border-transparent focus:border-border transition-all w-full bg-transparent"
                        />
                      </div>

                      <textarea
                        placeholder="Add instructional notes for reviewers..."
                        className="w-full bg-paper/30 border border-border/50 focus:border-ink p-4 text-sm font-serif italic outline-none transition-all rounded-sm resize-none"
                        rows={2}
                      />

                      {/* Options Editor for Choice Fields */}
                      {field.type === 'choice' && (
                        <div className="space-y-3 bg-paper/30 p-4 border border-border/50 rounded-sm">
                          <label className="text-[10px] font-mono uppercase tracking-widest text-muted">Response Options</label>
                          <div className="space-y-2">
                            {(field.options || []).map((option, idx) => (
                              <div key={idx} className="flex gap-2">
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => {
                                    const newOptions = [...(field.options || [])];
                                    newOptions[idx] = e.target.value;
                                    setFields(fields.map(f => f.id === field.id ? { ...f, options: newOptions } : f));
                                  }}
                                  className="flex-1 text-sm font-mono border border-border px-3 py-1.5 rounded-sm outline-none focus:border-ink"
                                />
                                <button
                                  onClick={() => {
                                    const newOptions = (field.options || []).filter((_, i) => i !== idx);
                                    setFields(fields.map(f => f.id === field.id ? { ...f, options: newOptions } : f));
                                  }}
                                  className="p-1.5 hover:bg-rose-100 text-rose-500 rounded-sm"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                const newOptions = [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`];
                                setFields(fields.map(f => f.id === field.id ? { ...f, options: newOptions } : f));
                              }}
                              className="text-[10px] font-mono uppercase tracking-widest text-intel-blue hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Add Option
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-8 shrink-0 pt-2">
                      <div className="flex flex-col items-end gap-3">
                        <label className="text-[10px] font-mono uppercase tracking-widest text-muted">Field Status</label>
                        <div
                          onClick={() => toggleRequired(field.id)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 border rounded-full cursor-pointer transition-all",
                            field.required ? "bg-ink border-ink text-paper" : "bg-paper border-border text-muted hover:border-ink hover:text-ink"
                          )}
                        >
                          <span className="font-mono text-[8px] uppercase tracking-widest">{field.required ? "Required" : "Optional"}</span>
                          <div className={cn(
                            "w-2 h-2 rounded-full transition-all",
                            field.required ? "bg-emerald-400" : "bg-border"
                          )} />
                        </div>
                      </div>
                      <button
                        onClick={() => removeField(field.id)}
                        className="p-3 bg-paper border border-border text-muted hover:text-rose-600 hover:border-rose-200 transition-all rounded-full"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          {fields.length === 0 && (
            <div className="py-32 border-2 border-dashed border-border flex flex-col items-center justify-center text-center space-y-6 rounded-sm bg-white/50">
              <div className="w-16 h-16 bg-paper border border-border flex items-center justify-center rounded-full">
                <Hash className="w-8 h-8 text-muted opacity-20" />
              </div>
              <div className="space-y-2">
                <h4 className="text-3xl font-serif italic text-muted">The instrument is empty.</h4>
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted opacity-60">Add fields from the library to begin evidence harvesting.</p>
              </div>
              <button onClick={() => addField('text')} className="btn-editorial">Initialise with Narrative Field</button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
