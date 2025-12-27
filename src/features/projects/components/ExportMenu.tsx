"use client";

import { useState } from "react";
import {
    Download,
    FileText,
    Table as TableIcon,
    FileJson,
    Database,
    ChevronRight,
    Loader2,
    Check
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { exportApi, type ExportParams } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ExportMenuProps {
    projectId: string;
    className?: string;
}

export function ExportMenu({ projectId, className }: ExportMenuProps) {
    const [isExporting, setIsExporting] = useState(false);
    const [options, setOptions] = useState({
        includeScreeningData: true,
        includeExtractionData: true,
        includeQualityAssessments: true,
        studyFilter: "all" as "all" | "included" | "excluded" | "pending"
    });

    const handleExport = async (format: ExportParams["format"]) => {
        setIsExporting(true);
        try {
            await exportApi.exportStudies(projectId, {
                format,
                ...options
            });
            toast.success(`Exporting as ${format.toUpperCase()}...`);
        } catch (error) {
            console.error("Export failed", error);
            toast.error("Export failed. Please try again.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className={cn("gap-2 font-serif italic", className)}
                    disabled={isExporting}
                >
                    {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Download className="w-4 h-4" />
                    )}
                    Export Data
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-2 shadow-editorial border-border">
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-3">
                    Export Configuration
                </DropdownMenuLabel>

                <div className="px-2 py-4 space-y-4 bg-paper/50 rounded-sm mb-2 border border-border/40">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="inc-screening" className="text-xs font-serif italic cursor-pointer">Screening Data</Label>
                        <Switch
                            id="inc-screening"
                            checked={options.includeScreeningData}
                            onCheckedChange={(val) => setOptions(prev => ({ ...prev, includeScreeningData: val }))}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="inc-extraction" className="text-xs font-serif italic cursor-pointer">Extraction Data</Label>
                        <Switch
                            id="inc-extraction"
                            checked={options.includeExtractionData}
                            onCheckedChange={(val) => setOptions(prev => ({ ...prev, includeExtractionData: val }))}
                        />
                    </div>
                    <div className="flex items-center justify-between border-t border-border/20 pt-4">
                        <Label className="text-xs font-serif italic">Filter</Label>
                        <div className="flex bg-white border border-border rounded-full p-1">
                            {(["all", "included"] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setOptions(prev => ({ ...prev, studyFilter: f }));
                                    }}
                                    className={cn(
                                        "px-3 py-1 text-[9px] font-mono uppercase tracking-tighter rounded-full transition-all",
                                        options.studyFilter === f ? "bg-ink text-paper shadow-sm" : "text-muted hover:text-ink"
                                    )}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuItem className="gap-3 py-3 font-serif italic cursor-pointer" onClick={() => handleExport("csv")}>
                    <TableIcon className="w-4 h-4 text-emerald-600" />
                    Comma Separated (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 py-3 font-serif italic cursor-pointer" onClick={() => handleExport("excel")}>
                    <FileText className="w-4 h-4 text-blue-600" />
                    Excel Spreadsheet
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 py-3 font-serif italic cursor-pointer" onClick={() => handleExport("ris")}>
                    <Database className="w-4 h-4 text-amber-600" />
                    RIS (Citation Manager)
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 py-3 font-serif italic cursor-pointer" onClick={() => handleExport("json")}>
                    <FileJson className="w-4 h-4 text-purple-600" />
                    JSON Format
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem className="gap-3 py-3 font-serif italic cursor-pointer opacity-50 cursor-not-allowed">
                    <Database className="w-4 h-4" />
                    BibTeX Library
                    <span className="ml-auto text-[9px] font-mono uppercase tracking-tighter bg-paper px-2 py-0.5 rounded-full">Soon</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
