"use client";

import { useState } from "react";
import { Download, Printer, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PRISMAFlowData {
  identification: {
    total: number;
    duplicates: number;
    afterDeduplication: number;
  };
  screening: {
    titleAbstract: {
      screened: number;
      excluded: number;
      remaining: number;
    };
    fullText: {
      screened: number;
      excluded: number;
      remaining: number;
    };
  };
  exclusionReasons: Array<{ reason: string; count: number }>;
  included: number;
}

interface PRISMAFlowDiagramProps {
  data: PRISMAFlowData;
  projectTitle?: string;
  className?: string;
}

export function PRISMAFlowDiagram({
  data,
  projectTitle,
  className,
}: PRISMAFlowDiagramProps) {
  const [copied, setCopied] = useState(false);

  const handleExportSVG = () => {
    const svgElement = document.getElementById("prisma-diagram");
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `prisma-flow-${projectTitle || "diagram"}.svg`;
    a.click();
    
    URL.revokeObjectURL(url);
    toast.success("PRISMA diagram exported");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyData = () => {
    const text = `
PRISMA 2020 Flow Diagram
${projectTitle || "Systematic Review"}

Identification:
- Records identified: ${data.identification.total}
- Duplicates removed: ${data.identification.duplicates}
- Records screened: ${data.identification.afterDeduplication}

Title & Abstract Screening:
- Records screened: ${data.screening.titleAbstract.screened}
- Records excluded: ${data.screening.titleAbstract.excluded}

Full-Text Screening:
- Full-text articles assessed: ${data.screening.fullText.screened}
- Full-text articles excluded: ${data.screening.fullText.excluded}

Included:
- Studies included in review: ${data.included}

Exclusion Reasons:
${data.exclusionReasons.map(r => `- ${r.reason}: ${r.count}`).join("\n")}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("PRISMA data copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={handleCopyData}
          variant="outline"
          size="sm"
          className="font-mono text-xs uppercase tracking-widest"
        >
          {copied ? <Check className="w-3 h-3 mr-2" /> : <Copy className="w-3 h-3 mr-2" />}
          {copied ? "Copied!" : "Copy Data"}
        </Button>
        <Button
          onClick={handleExportSVG}
          variant="outline"
          size="sm"
          className="font-mono text-xs uppercase tracking-widest"
        >
          <Download className="w-3 h-3 mr-2" />
          Export SVG
        </Button>
        <Button
          onClick={handlePrint}
          variant="outline"
          size="sm"
          className="font-mono text-xs uppercase tracking-widest"
        >
          <Printer className="w-3 h-3 mr-2" />
          Print
        </Button>
      </div>

      {/* PRISMA Diagram */}
      <div className="bg-white border border-border rounded-sm p-8 print:border-0">
        <svg
          id="prisma-diagram"
          viewBox="0 0 800 1000"
          className="w-full h-auto"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Title */}
          <text x="400" y="30" textAnchor="middle" className="fill-ink font-serif text-xl font-bold">
            PRISMA 2020 Flow Diagram
          </text>
          {projectTitle && (
            <text x="400" y="55" textAnchor="middle" className="fill-muted font-serif text-sm italic">
              {projectTitle}
            </text>
          )}

          {/* Identification */}
          <PRISMABox
            x={50}
            y={80}
            width={700}
            height={80}
            title="Identification"
            lines={[
              `Records identified: ${data.identification.total}`,
              `Duplicates removed: ${data.identification.duplicates}`,
            ]}
            color="#3B82F6"
          />

          {/* Arrow down */}
          <Arrow x={400} y1={160} y2={200} />

          {/* After Deduplication */}
          <PRISMABox
            x={50}
            y={200}
            width={700}
            height={60}
            title="Screening"
            lines={[`Records screened: ${data.identification.afterDeduplication}`]}
            color="#3B82F6"
          />

          {/* Split arrow */}
          <Arrow x={400} y1={260} y2={300} />

          {/* Title/Abstract Screening + Excluded */}
          <g>
            <PRISMABox
              x={50}
              y={300}
              width={500}
              height={60}
              lines={[`Records screened (Title/Abstract): ${data.screening.titleAbstract.screened}`]}
            />
            <Arrow x={550} y1={330} y2={330} horizontal />
            <PRISMABox
              x={600}
              y={300}
              width={150}
              height={60}
              lines={[`Excluded:`, `${data.screening.titleAbstract.excluded}`]}
              color="#EF4444"
              small
            />
          </g>

          {/* Arrow down */}
          <Arrow x={300} y1={360} y2={400} />

          {/* Full-Text Screening + Excluded */}
          <g>
            <PRISMABox
              x={50}
              y={400}
              width={500}
              height={100}
              lines={[`Full-text articles assessed: ${data.screening.fullText.screened}`]}
            />
            <Arrow x={550} y1={450} y2={450} horizontal />
            <PRISMABox
              x={600}
              y={400}
              width={150}
              height={100}
              lines={[
                `Excluded:`,
                `${data.screening.fullText.excluded}`,
                ...data.exclusionReasons.slice(0, 2).map(r => `${r.reason}: ${r.count}`),
              ]}
              color="#EF4444"
              small
            />
          </g>

          {/* Arrow down */}
          <Arrow x={300} y1={500} y2={540} />

          {/* Included */}
          <PRISMABox
            x={50}
            y={540}
            width={500}
            height={80}
            title="Included"
            lines={[
              `Studies included in review: ${data.included}`,
              `Studies included in meta-analysis: ${data.included}`,
            ]}
            color="#10B981"
          />

          {/* Legend */}
          <g transform="translate(50, 650)">
            <text className="fill-muted font-mono text-xs uppercase" y="10">
              Generated on {new Date().toLocaleDateString()}
            </text>
          </g>
        </svg>
      </div>

      {/* Exclusion Reasons Detail */}
      {data.exclusionReasons.length > 0 && (
        <div className="bg-white border border-border rounded-sm p-6 space-y-4">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted font-bold">
            Exclusion Reasons (Detailed)
          </h3>
          <div className="space-y-2">
            {data.exclusionReasons.map((reason, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                <span className="font-serif italic text-sm text-ink">{reason.reason}</span>
                <span className="font-mono text-sm text-muted">{reason.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface PRISMABoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  lines: string[];
  color?: string;
  small?: boolean;
}

function PRISMABox({
  x,
  y,
  width,
  height,
  title,
  lines,
  color = "#1F2937",
  small = false,
}: PRISMABoxProps) {
  const fontSize = small ? "10" : "12";
  const titleFontSize = small ? "11" : "13";

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="white"
        stroke={color}
        strokeWidth="2"
        rx="4"
      />
      {title && (
        <text
          x={x + width / 2}
          y={y + 20}
          textAnchor="middle"
          className="font-mono font-bold uppercase"
          fontSize={titleFontSize}
          fill={color}
        >
          {title}
        </text>
      )}
      {lines.map((line, index) => (
        <text
          key={index}
          x={x + width / 2}
          y={y + (title ? 40 : 20) + index * 18}
          textAnchor="middle"
          className="font-serif"
          fontSize={fontSize}
          fill="#1F2937"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

interface ArrowProps {
  x: number;
  y1: number;
  y2: number;
  horizontal?: boolean;
}

function Arrow({ x, y1, y2, horizontal = false }: ArrowProps) {
  if (horizontal) {
    return (
      <g>
        <line
          x1={x}
          y1={y1}
          x2={y2}
          y2={y1}
          stroke="#9CA3AF"
          strokeWidth="2"
        />
        <polygon
          points={`${y2},${y1} ${y2 - 8},${y1 - 5} ${y2 - 8},${y1 + 5}`}
          fill="#9CA3AF"
        />
      </g>
    );
  }

  return (
    <g>
      <line
        x1={x}
        y1={y1}
        x2={x}
        y2={y2}
        stroke="#9CA3AF"
        strokeWidth="2"
        markerEnd="url(#arrowhead)"
      />
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="5"
          refY="5"
          orient="auto"
        >
          <polygon points="0,0 10,5 0,10" fill="#9CA3AF" />
        </marker>
      </defs>
    </g>
  );
}

