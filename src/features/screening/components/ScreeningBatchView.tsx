import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScreeningQueueItem } from "@/lib/api-client";

interface ScreeningBatchViewProps {
    studies: ScreeningQueueItem[];
    selectedIds: string[];
    onSelectAll: () => void;
    onSelect: (id: string) => void;
    onOpenBatchPanel: () => void;
}

export function ScreeningBatchView({
    studies,
    selectedIds,
    onSelectAll,
    onSelect,
    onOpenBatchPanel,
}: ScreeningBatchViewProps) {
    return (
        <div className="max-w-7xl mx-auto w-full space-y-4">
            <div className="flex justify-between items-center bg-white p-4 border border-border rounded-sm">
                <div className="flex items-center gap-4">
                    <h3 className="font-serif italic text-lg text-ink">
                        Batch Selection
                    </h3>
                    <div className="h-4 w-[1px] bg-border" />
                    <span className="font-mono text-xs uppercase tracking-widest text-muted">
                        {selectedIds.length} Selected
                    </span>
                </div>
                <Button
                    onClick={onOpenBatchPanel}
                    disabled={selectedIds.length === 0}
                    className="bg-ink text-paper hover:bg-ink/90 font-mono uppercase tracking-widest text-xs"
                >
                    <Sparkles className="w-3 h-3 mr-2" />
                    Batch Actions
                </Button>
            </div>

            <div className="bg-white border border-border rounded-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <input
                                    type="checkbox"
                                    checked={
                                        studies.length > 0 && selectedIds.length === studies.length
                                    }
                                    onChange={onSelectAll}
                                    className="rounded-sm border-border"
                                />
                            </TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Authors</TableHead>
                            <TableHead>Year</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>AI Suggestion</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {studies.map((study) => (
                            <TableRow key={study.id}>
                                <TableCell>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(study.id)}
                                        onChange={() => onSelect(study.id)}
                                        className="rounded-sm border-border"
                                    />
                                </TableCell>
                                <TableCell
                                    className="font-medium max-w-lg truncate"
                                    title={study.title}
                                >
                                    {study.title}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                    {study.authors.map((a) => a.name).join(", ")}
                                </TableCell>
                                <TableCell>{study.year || "-"}</TableCell>
                                <TableCell>
                                    <span
                                        className={cn(
                                            "px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-widest",
                                            study.userDecision === "INCLUDE"
                                                ? "bg-emerald-100 text-emerald-700"
                                                : study.userDecision === "EXCLUDE"
                                                    ? "bg-rose-100 text-rose-700"
                                                    : study.userDecision === "MAYBE"
                                                        ? "bg-slate-100 text-slate-700"
                                                        : "bg-gray-50 text-gray-400"
                                        )}
                                    >
                                        {study.userDecision || "Pending"}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    {study.aiSuggestion && (
                                        <div className="flex items-center gap-1 text-xs font-mono text-intel-blue">
                                            <Sparkles className="w-3 h-3" />
                                            {study.aiSuggestion} (
                                            {Math.round((study.aiConfidence || 0) * 100)}%)
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
