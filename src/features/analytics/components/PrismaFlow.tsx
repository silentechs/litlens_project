"use client";

import { useQuery } from "@tanstack/react-query";
import { exportApi } from "@/lib/api-client";
import { Loader2, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useRef } from "react";
import { toast } from "sonner";

interface PrismaFlowProps {
    projectId: string;
}

interface PrismaData {
    identification: {
        databaseSearches: number;
        recordsIdentified: number;
        duplicatesRemoved: number;
    };
    screening: {
        titleAbstract: {
            screened: number;
            excluded: number;
        };
        fullText: {
            assessed: number;
            excluded: number;
            exclusionReasons: Record<string, number>;
        };
    };
    included: {
        qualitativeAnalysis: number;
        quantitativeAnalysis: number;
    };
}

export function PrismaFlow({ projectId }: PrismaFlowProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    const { data: prismaData, isLoading, isError } = useQuery({
        queryKey: ["prisma-flow", projectId],
        queryFn: async () => {
            const res = await exportApi.getPrismaFlow(projectId);
            return res as any as PrismaData;
        }
    });

    // ... code ...

    const handleDownload = () => {
        if (!svgRef.current) return;

        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `prisma-flow-${projectId}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("PRISMA diagram downloaded");
    };

    if (isLoading) {
        return (
            <div className="h-[600px] flex flex-col items-center justify-center gap-4 text-muted">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="font-serif italic">Generating PRISMA visualization...</p>
            </div>
        );
    }

    if (isError || !prismaData) {
        return (
            <div className="h-[600px] flex flex-col items-center justify-center gap-4 text-rose-500">
                <AlertCircle className="w-8 h-8" />
                <p className="font-serif italic">Failed to load flow data</p>
            </div>
        );
    }

    // Diagram Configuration
    const boxWidth = 250;
    const boxHeight = 80;
    const gapY = 60;
    const centerX = 400;

    // Y coordinates for each level
    const yIdentification = 50;
    const yScreening = yIdentification + boxHeight + gapY;
    const yEligibility = yScreening + boxHeight + gapY;
    const yIncluded = yEligibility + boxHeight + gapY;

    // Computed values
    const recordsAfterDuplicates = prismaData.identification.recordsIdentified - prismaData.identification.duplicatesRemoved;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-paper p-4 border border-border rounded-sm">
                <div>
                    <h3 className="font-serif italic text-lg text-ink">PRISMA 2020 Flow Diagram</h3>
                    <p className="text-xs text-muted font-mono uppercase tracking-widest mt-1">Live visualization of study selection</p>
                </div>
                <Button onClick={handleDownload} variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    Download SVG
                </Button>
            </div>

            <div className="bg-white border border-border rounded-sm p-8 overflow-x-auto flex justify-center">
                <motion.svg
                    ref={svgRef}
                    width="800"
                    height="600"
                    viewBox="0 0 800 600"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-full"
                >
                    <defs>
                        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                            <feOffset dx="2" dy="2" result="offsetblur" />
                            <feComponentTransfer>
                                <feFuncA type="linear" slope="0.2" />
                            </feComponentTransfer>
                            <feMerge>
                                <feMergeNode />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Phase Labels (Left Side) */}
                    <text x="50" y={yIdentification + boxHeight / 2} className="text-xs font-bold font-sans fill-blue-600 uppercase tracking-widest" dominantBaseline="middle" transform="rotate(-90, 50, 90)">Identification</text>
                    <text x="50" y={yScreening + boxHeight / 2} className="text-xs font-bold font-sans fill-blue-600 uppercase tracking-widest" dominantBaseline="middle" transform="rotate(-90, 50, 230)">Screening</text>
                    <text x="50" y={yIncluded + boxHeight / 2} className="text-xs font-bold font-sans fill-blue-600 uppercase tracking-widest" dominantBaseline="middle" transform="rotate(-90, 50, 480)">Included</text>

                    {/* --- Identification Phase --- */}
                    <PrismaBox
                        x={centerX - boxWidth / 2}
                        y={yIdentification}
                        width={boxWidth}
                        height={boxHeight}
                        label="Records identified from:"
                        count={prismaData.identification.recordsIdentified}
                        subLabel={`Databases: ${prismaData.identification.databaseSearches}`}
                    />

                    {/* Arrow down */}
                    <Arrow x1={centerX} y1={yIdentification + boxHeight} x2={centerX} y2={yScreening} />

                    {/* Duplicates Removed Box (Right) */}
                    <PrismaBox
                        x={centerX + boxWidth / 2 + 50}
                        y={yIdentification + boxHeight / 2}
                        width={boxWidth - 50}
                        height={boxHeight - 20}
                        label="Records removed before screening:"
                        count={prismaData.identification.duplicatesRemoved}
                        subLabel="Duplicate records removed"
                        variant="exclusion"
                    />
                    {/* Connector to exclusion */}
                    <path d={`M ${centerX} ${yIdentification + boxHeight + gapY / 2} L ${centerX + boxWidth / 2 + 50} ${yIdentification + boxHeight + gapY / 2}`} stroke="#94a3b8" strokeWidth="1.5" fill="none" />


                    {/* --- Screening Phase --- */}
                    <PrismaBox
                        x={centerX - boxWidth / 2}
                        y={yScreening}
                        width={boxWidth}
                        height={boxHeight}
                        label="Records screened"
                        count={prismaData.screening.titleAbstract.screened}
                    />

                    {/* Arrow to Excluded (Right) */}
                    <path d={`M ${centerX + boxWidth / 2} ${yScreening + boxHeight / 2} L ${centerX + boxWidth / 2 + 50} ${yScreening + boxHeight / 2}`} stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrowhead)" />

                    <PrismaBox
                        x={centerX + boxWidth / 2 + 50}
                        y={yScreening}
                        width={boxWidth - 50}
                        height={boxHeight}
                        label="Records excluded"
                        count={prismaData.screening.titleAbstract.excluded}
                        variant="exclusion"
                    />

                    {/* Arrow down */}
                    <Arrow x1={centerX} y1={yScreening + boxHeight} x2={centerX} y2={yEligibility} />

                    {/* --- Eligibility Phase --- */}
                    <PrismaBox
                        x={centerX - boxWidth / 2}
                        y={yEligibility}
                        width={boxWidth}
                        height={boxHeight}
                        label="Reports sought for retrieval"
                        count={prismaData.screening.fullText.assessed}
                    />

                    {/* Arrow to Excluded (Right) */}
                    <path d={`M ${centerX + boxWidth / 2} ${yEligibility + boxHeight / 2} L ${centerX + boxWidth / 2 + 50} ${yEligibility + boxHeight / 2}`} stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrowhead)" />

                    <PrismaBox
                        x={centerX + boxWidth / 2 + 50}
                        y={yEligibility}
                        width={boxWidth - 50}
                        height={boxHeight + 20}
                        label="Reports excluded:"
                        count={prismaData.screening.fullText.excluded}
                        subLabel={Object.entries(prismaData.screening.fullText.exclusionReasons).map(([r, c]) => `${r} (${c})`).join(", ")}
                        variant="exclusion"
                    />

                    {/* Arrow down */}
                    <Arrow x1={centerX} y1={yEligibility + boxHeight} x2={centerX} y2={yIncluded} />

                    {/* --- Included Phase --- */}
                    <PrismaBox
                        x={centerX - boxWidth / 2}
                        y={yIncluded}
                        width={boxWidth}
                        height={boxHeight}
                        label="Studies included in review"
                        count={prismaData.included.qualitativeAnalysis}
                        subLabel={`With data extraction: ${prismaData.included.quantitativeAnalysis}`}
                        variant="final"
                    />

                    {/* Arrowhead definition */}
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                    </marker>

                </motion.svg>
            </div>
        </div>
    );
}

function PrismaBox({ x, y, width, height, label, count, subLabel, variant = 'default' }: {
    x: number, y: number, width: number, height: number, label: string, count: number, subLabel?: string, variant?: 'default' | 'exclusion' | 'final'
}) {
    const bgFill = variant === 'final' ? '#ecfdf5' : variant === 'exclusion' ? '#e11d48' : '#ffffff'; // rn-50 typo handled by stroke
    const stroke = variant === 'final' ? '#059669' : variant === 'exclusion' ? '#e11d48' : '#2563eb';
    const textFill = '#0f172a';

    // Manual color fixes since Tailwind classes won't work inside SVG usually without dedicated CSS
    const fillColor = variant === 'final' ? '#ecfdf5' : variant === 'exclusion' ? '#fff1f2' : '#ffffff';

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={fillColor}
                stroke={stroke}
                strokeWidth="1.5"
                rx="2"
                filter="url(#shadow)"
            />
            <text x={x + width / 2} y={y + 25} textAnchor="middle" fontSize="12" fontWeight="bold" fill={textFill} fontFamily="sans-serif">{label}</text>
            <text x={x + width / 2} y={y + 45} textAnchor="middle" fontSize="14" fontWeight="bold" fill={stroke} fontFamily="sans-serif">{count}</text>
            {subLabel && (
                <text x={x + width / 2} y={y + 65} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="sans-serif">
                    {subLabel}
                </text>
            )}
        </g>
    );
}

function Arrow({ x1, y1, x2, y2 }: { x1: number, y1: number, x2: number, y2: number }) {
    return (
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
    );
}
