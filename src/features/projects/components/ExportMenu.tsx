"use client";

import { useState } from "react";
import {
    Download,
    FileText,
    FileSpreadsheet,
    FileJson,
    Check,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { exportApi } from "@/lib/api-client";
import { toast } from "sonner";

interface ExportMenuProps {
    projectId: string;
    className?: string;
}

export function ExportMenu({ projectId, className }: ExportMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Export Options
    const [format, setFormat] = useState<"csv" | "excel" | "ris" | "json">("csv");
    const [scope, setScope] = useState<"all" | "included" | "excluded" | "pending">("included");

    // Data Inclusion Options
    const [includeScreening, setIncludeScreening] = useState(true);
    const [includeExtraction, setIncludeExtraction] = useState(false);
    const [includeQuality, setIncludeQuality] = useState(false);

    const handleExport = async () => {
        try {
            setIsExporting(true);

            // Trigger the export download
            exportApi.exportStudies(projectId, {
                format,
                studyFilter: scope,
                includeScreeningData: includeScreening,
                includeExtractionData: includeExtraction,
                includeQualityAssessments: includeQuality
            });

            // Show success message (download happens via browser navigation)
            toast.success("Export started");
            setIsOpen(false);
        } catch (error) {
            console.error("Export failed", error);
            toast.error("Failed to start export");
        } finally {
            setIsExporting(false);
        }
    };

    const getFormatIcon = (fmt: string) => {
        switch (fmt) {
            case "excel": return <FileSpreadsheet className="w-4 h-4 ml-2" />;
            case "json": return <FileJson className="w-4 h-4 ml-2" />;
            case "ris": return <FileText className="w-4 h-4 ml-2" />;
            default: return <FileText className="w-4 h-4 ml-2" />;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className={`gap-2 ${className || ''}`}>
                    <Download className="w-4 h-4" />
                    Export Data
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="font-serif text-xl">Export Project Data</DialogTitle>
                    <DialogDescription>
                        Download your study data, screening decisions, and extractions.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">

                    {/* Format Selection */}
                    <div className="space-y-2">
                        <Label>Export Format</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant={format === "csv" ? "default" : "outline"}
                                onClick={() => setFormat("csv")}
                                className={format === "csv" ? "bg-ink text-white" : ""}
                                size="sm"
                            >
                                CSV
                            </Button>
                            <Button
                                variant={format === "excel" ? "default" : "outline"}
                                onClick={() => setFormat("excel")}
                                className={format === "excel" ? "bg-ink text-white" : ""}
                                size="sm"
                            >
                                Excel
                            </Button>
                            <Button
                                variant={format === "ris" ? "default" : "outline"}
                                onClick={() => setFormat("ris")}
                                className={format === "ris" ? "bg-ink text-white" : ""}
                                size="sm"
                            >
                                RIS (Citation)
                            </Button>
                            <Button
                                variant={format === "json" ? "default" : "outline"}
                                onClick={() => setFormat("json")}
                                className={format === "json" ? "bg-ink text-white" : ""}
                                size="sm"
                            >
                                JSON
                            </Button>
                        </div>
                    </div>

                    {/* Scope Selection */}
                    <div className="space-y-2">
                        <Label>Studies to Include</Label>
                        <Select
                            value={scope}
                            onValueChange={(val: any) => setScope(val)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select scope" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Studies (Complete Library)</SelectItem>
                                <SelectItem value="included">Included Only</SelectItem>
                                <SelectItem value="excluded">Excluded Only</SelectItem>
                                <SelectItem value="pending">Pending Only</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Detailed Data Toggles */}
                    <div className="space-y-4">
                        <Label>Additional Data</Label>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Screening Decisions</Label>
                                <p className="text-xs text-muted-foreground">
                                    Include votes, timestamps, and confidence scores
                                </p>
                            </div>
                            <Switch
                                checked={includeScreening}
                                onCheckedChange={setIncludeScreening}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Extraction Data</Label>
                                <p className="text-xs text-muted-foreground">
                                    Include structured data from extraction forms
                                </p>
                            </div>
                            <Switch
                                checked={includeExtraction}
                                onCheckedChange={setIncludeExtraction}
                                disabled={format === 'ris'} // RIS doesn't support custom fields easily
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Quality Assessments</Label>
                                <p className="text-xs text-muted-foreground">
                                    Include risk of bias / quality scores
                                </p>
                            </div>
                            <Switch
                                checked={includeQuality}
                                onCheckedChange={setIncludeQuality}
                                disabled={format === 'ris'}
                            />
                        </div>
                    </div>

                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleExport} disabled={isExporting} className="bg-ink text-white hover:bg-ink/90">
                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                        Download {format.toUpperCase()}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
