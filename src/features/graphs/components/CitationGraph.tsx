"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize,
  Layers,
  Filter,
  Sparkles,
  MousePointer2,
  X as XIcon,
  Plus as PlusIcon,
  Network,
  Upload,
  Database,
  Loader2,
  Download,
  RefreshCw,
  ChevronDown,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { GraphControl } from "./GraphControl";
import { GraphLegendItem } from "./GraphLegendItem";
import cytoscape from 'cytoscape';
// @ts-ignore
import fcose from 'cytoscape-fcose';
import CytoscapeComponent from 'react-cytoscapejs';
import { Button } from "@/components/ui/button";

// Register fcose layout
// @ts-ignore
cytoscape.use(fcose);
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CommonDialog } from "@/components/ui/common-dialog";

interface GraphNode {
  id: string;
  type: "work" | "author" | "topic" | "journal";
  label: string;
  data: Record<string, unknown>;
  size?: number;
  color?: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight?: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    density: number;
    avgDegree: number;
    centralNodes?: string[];
  };
}

// Transform API graph data to Cytoscape elements
function transformToCytoscape(graphData: GraphData): cytoscape.ElementDefinition[] {
  const elements: cytoscape.ElementDefinition[] = [];

  // Find max size for normalization
  const maxSize = Math.max(...graphData.nodes.map((n) => n.size || 1), 1);

  graphData.nodes.forEach((node) => {
    // Normalize size to 20-80 range for better visibility
    const normalizedSize = 20 + ((node.size || 1) / maxSize) * 60;
    elements.push({
      data: {
        id: node.id,
        label: node.label,
        size: Math.round(normalizedSize),
        type: node.type,
        ...node.data,
      },
    });
  });

  graphData.edges.forEach((edge) => {
    elements.push({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        weight: edge.weight || 1,
      },
    });
  });

  return elements;
}

export function CitationGraph() {
  const queryClient = useQueryClient();
  const [elements, setElements] = useState<cytoscape.ElementDefinition[]>([]);
  const [selectedNodeData, setSelectedNodeData] = useState<Record<string, unknown> | null>(null);
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [graphType, setGraphType] = useState<"TOPIC_CLUSTER" | "CO_AUTHORSHIP">("TOPIC_CLUSTER");
  const [nodeSearch, setNodeSearch] = useState("");
  const [currentGraphData, setCurrentGraphData] = useState<GraphData | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Fetch user's projects
  const { data: projectsData, isLoading: isLoadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", { credentials: "include" });
      const json = await res.json();
      return json.data;
    },
  });

  // Generate graph mutation
  const generateGraphMutation = useMutation({
    mutationFn: async ({ projectId, type }: { projectId: string; type: string }) => {
      const res = await fetch("/api/research/graphs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: `${type === "TOPIC_CLUSTER" ? "Topic Cluster" : "Co-Authorship"} Graph`,
          graphType: type,
          projectId,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate graph");
      return res.json();
    },
    onSuccess: async (data) => {
      // Fetch the full graph data
      const res = await fetch(`/api/research/graphs/${data.data.id}`, { credentials: "include" });
      const graphRes = await res.json();

      // Handle nested graph data structure from API
      // API returns: { success: true, data: { id: ..., data: { nodes: [], edges: [] } } }
      const nestedData = graphRes.data.data || {};

      const graphData: GraphData = {
        nodes: nestedData.nodes || [],
        edges: nestedData.edges || [],
        stats: {
          nodeCount: nestedData.nodes?.length || 0,
          edgeCount: nestedData.edges?.length || 0,
          density: 0,
          avgDegree: 0,
        },
      };
      setCurrentGraphData(graphData);
      setElements(transformToCytoscape(graphData));
      setShowProjectSelect(false);
    },
  });

  const cyRef = useRef<cytoscape.Core | null>(null);

  // Graph controls
  const handleZoomIn = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const next = cy.zoom() * 1.3;
    const { width, height } = cy.container()?.getBoundingClientRect() || { width: 0, height: 0 };
    cy.zoom({ level: next, renderedPosition: { x: width / 2, y: height / 2 } });
  }, [cyRef]);

  const handleZoomOut = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const next = cy.zoom() / 1.3;
    const { width, height } = cy.container()?.getBoundingClientRect() || { width: 0, height: 0 };
    cy.zoom({ level: next, renderedPosition: { x: width / 2, y: height / 2 } });
  }, [cyRef]);

  const handleFitView = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.resize();
    cy.fit(cy.elements(), 50);
    cy.center();
  }, [cyRef]);

  // Node search
  const handleNodeSearch = useCallback((query: string) => {
    setNodeSearch(query);
    const cy = cyRef.current;
    if (!cy) return;

    if (!query) {
      cy.elements().removeClass("dimmed highlighted");
      return;
    }

    const matching = cy.nodes().filter((node) =>
      (node.data("label") as string)?.toLowerCase().includes(query.toLowerCase())
    );

    cy.elements().addClass("dimmed");
    matching.removeClass("dimmed").addClass("highlighted");

    if (matching.length === 1) {
      cy.animate({
        center: { eles: matching },
        zoom: 2,
      }, { duration: 300 });
    }
  }, [cyRef]);

  // Export graph as PNG
  const handleExport = useCallback((format: "png" | "json") => {
    const cy = cyRef.current;
    if (!cy) return;

    if (format === "png") {
      const png = cy.png({ full: true, scale: 2 });
      const link = document.createElement("a");
      link.href = png;
      link.download = "research-graph.png";
      link.click();
    } else if (format === "json" && currentGraphData) {
      const json = JSON.stringify(currentGraphData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "research-graph.json";
      link.click();
      URL.revokeObjectURL(url);
    }
  }, [cyRef, currentGraphData]);

  // Handle bibliography import
  const handleBibliographyImport = useCallback(async () => {
    if (!importFile) return;

    setIsImporting(true);
    try {
      const content = await importFile.text();

      // Parse the file client-side to build a local graph
      const res = await fetch("/api/research/graphs/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content,
          filename: importFile.name,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || "Failed to parse bibliography");
      }

      const result = await res.json();
      const graphData: GraphData = result.data;

      setCurrentGraphData(graphData);
      setElements(transformToCytoscape(graphData));
      setShowImportDialog(false);
      setImportFile(null);
    } catch (error) {
      console.error("Import error:", error);
      alert(error instanceof Error ? error.message : "Failed to import bibliography");
    } finally {
      setIsImporting(false);
    }
  }, [importFile]);

  // Calculate insights from graph data
  const insights = useMemo(() => {
    if (!currentGraphData || currentGraphData.nodes.length === 0) return null;

    const { nodes, edges, stats } = currentGraphData;
    const topicNodes = nodes.filter((n) => n.type === "topic");
    const workNodes = nodes.filter((n) => n.type === "work");
    const authorNodes = nodes.filter((n) => n.type === "author");

    // Find most connected topic/author
    const nodeDegrees = new Map<string, number>();
    edges.forEach((e) => {
      nodeDegrees.set(e.source, (nodeDegrees.get(e.source) || 0) + 1);
      nodeDegrees.set(e.target, (nodeDegrees.get(e.target) || 0) + 1);
    });

    const sortedNodes = [...nodeDegrees.entries()].sort((a, b) => b[1] - a[1]);
    const topNode = sortedNodes[0];
    const topNodeData = nodes.find((n) => n.id === topNode?.[0]);

    return {
      nodeCount: stats.nodeCount,
      edgeCount: stats.edgeCount,
      topicCount: topicNodes.length,
      workCount: workNodes.length,
      authorCount: authorNodes.length,
      avgDegree: stats.avgDegree,
      density: stats.density,
      mostConnected: topNodeData?.label,
      mostConnectedDegree: topNode?.[1] || 0,
    };
  }, [currentGraphData]);

  const isEmpty = elements.length === 0;

  // Cytoscape stylesheet
  const stylesheet = [
    {
      selector: 'node',
      style: {
        'background-color': '#1a3320',
        'label': 'data(label)',
        'font-family': 'EB Garamond, serif',
        'font-style': 'italic',
        'font-size': '10px',
        'color': '#1a3320',
        'text-margin-y': 8,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'width': (ele: cytoscape.NodeSingular) => ele.data('size') || 25,
        'height': (ele: cytoscape.NodeSingular) => ele.data('size') || 25,
        'border-width': 2,
        'border-color': 'rgba(26, 51, 32, 0.1)',
        'transition-property': 'border-color, border-width, background-color',
        'transition-duration': '150ms',
      }
    },
    {
      selector: 'node[type="work"]',
      style: {
        'background-color': '#4a5568',
        'shape': 'ellipse',
      }
    },
    {
      selector: 'node[type="author"]',
      style: {
        'background-color': '#2b6cb0',
        'shape': 'diamond',
      }
    },
    {
      selector: 'node[type="topic"]',
      style: {
        'background-color': '#c53030',
        'shape': 'round-rectangle',
      }
    },
    {
      selector: 'node[type="journal"]',
      style: {
        'background-color': '#2f855a',
        'shape': 'hexagon',
      }
    },
    {
      selector: 'node[type="core"]',
      style: {
        'background-color': '#0a5c91',
      }
    },
    {
      selector: 'node:selected',
      style: {
        'background-color': '#0a5c91',
        'border-width': 4,
        'border-color': 'rgba(10, 92, 145, 0.3)',
        'border-opacity': 1
      }
    },
    {
      selector: 'node.highlighted',
      style: {
        'background-color': '#d69e2e',
        'border-width': 3,
        'border-color': '#b7791f',
      }
    },
    {
      selector: 'node.dimmed',
      style: {
        'opacity': 0.2,
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 1,
        'line-color': '#cbd5e0',
        'line-style': 'solid',
        'curve-style': 'bezier',
        'target-arrow-shape': 'none',
        'opacity': 0.6
      }
    },
    {
      selector: 'edge.dimmed',
      style: {
        'opacity': 0.1,
      }
    }
  ];

  // Layout configuration
  const layoutConfig = {
    name: 'fcose',
    quality: 'proof',
    randomize: false,
    animate: true,
    animationDuration: 1000,
    fit: true,
    padding: 50,
    nodeDimensionsIncludeLabels: true,
    nodeRepulsion: () => 9000,
    idealEdgeLength: () => 90,
    edgeElasticity: () => 0.45,
    gravity: 0.8,
    numIter: 2500,
  };

  return (
    <div className="space-y-8 h-full flex flex-col">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Research Graph</h1>
          <p className="text-muted font-serif italic text-xl">Mapping the intellectual lineage of your field.</p>
        </div>
        <div className="flex gap-4">
          {!isEmpty && (
            <>
              <button
                onClick={() => handleExport("png")}
                className="px-4 py-2 border border-border text-[10px] font-mono uppercase tracking-widest hover:bg-paper transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export PNG
              </button>
              <button
                onClick={() => {
                  setElements([]);
                  setCurrentGraphData(null);
                }}
                className="px-4 py-2 border border-border text-[10px] font-mono uppercase tracking-widest hover:bg-paper transition-all"
              >
                Clear Canvas
              </button>
            </>
          )}
          <button
            className="btn-editorial flex items-center gap-2"
            onClick={() => setShowProjectSelect(true)}
          >
            <PlusIcon className="w-5 h-5" />
            New Graph
          </button>
        </div>
      </header>

      <div className="accent-line" />

      {/* Graph Visualizer Shell */}
      <div className="flex-1 relative bg-white border border-border min-h-[600px] overflow-hidden group shadow-sm rounded-sm">
        {isEmpty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center space-y-8 bg-paper/20">
            <div className="w-24 h-24 bg-white border border-border rounded-full flex items-center justify-center shadow-sm">
              <Network className="w-10 h-10 text-muted opacity-20" />
            </div>
            <div className="space-y-3 max-w-md">
              <h2 className="text-4xl font-serif italic">The canvas is waiting.</h2>
              <p className="text-muted font-serif italic text-lg leading-relaxed">
                Start your research journey by connecting existing project data or importing a fresh bibliography.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">
              <OnboardingCard
                icon={<Database className="w-6 h-6" />}
                title="Connect Project"
                description="Generate a graph from your current systematic review studies."
                onClick={() => setShowProjectSelect(true)}
              />
              <OnboardingCard
                icon={<Upload className="w-6 h-6" />}
                title="Import Bibliography"
                description="Upload RIS or BibTeX files to map historical citations."
                onClick={() => setShowImportDialog(true)}
              />
            </div>

            {/* Import Bibliography Dialog */}
            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
              <DialogContent className="sm:max-w-lg bg-white/95 backdrop-blur-sm">
                <DialogHeader>
                  <DialogTitle className="font-serif text-3xl">Import Bibliography</DialogTitle>
                  <p className="text-muted-foreground font-serif text-base mt-2">
                    Visualize your citation network by uploading a bibliography file.
                  </p>
                </DialogHeader>

                <div className="py-6">
                  {!importFile ? (
                    <div className="group relative">
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-paper/20 rounded-xl" />
                      <label
                        htmlFor="bibliography-upload"
                        className="relative flex flex-col items-center justify-center w-full aspect-[2/1] border border-dashed border-border rounded-xl cursor-pointer hover:border-foreground/40 hover:bg-paper/30 transition-all duration-300"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                          <div className="p-4 bg-paper rounded-full mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-border">
                            <Upload className="w-6 h-6 text-foreground/70" />
                          </div>
                          <p className="mb-2 text-sm font-medium text-foreground">
                            <span className="font-serif font-semibold border-b border-foreground/30 pb-0.5">Click to upload</span> <span className="text-muted-foreground font-serif italic">or drag and drop</span>
                          </p>
                          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mt-2">
                            RIS, BibTeX, or CSV
                          </p>
                        </div>
                        <input
                          id="bibliography-upload"
                          type="file"
                          className="hidden"
                          accept=".ris,.bib,.bibtex,.csv"
                          onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="relative flex items-center p-4 border border-border rounded-xl bg-paper/30 group animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-3 bg-white border border-border rounded-lg mr-4 shadow-sm">
                        <FileText className="w-6 h-6 text-foreground/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate font-serif">
                          {importFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {(importFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => setImportFile(null)}
                        className="p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors ml-2"
                        aria-label="Remove file"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <DialogFooter className="sm:justify-between sm:items-center gap-4 border-t border-border pt-4">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider hidden sm:block">
                    Supported formats: .ris, .bib, .csv
                  </p>
                  <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => setShowImportDialog(false)} className="font-serif">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleBibliographyImport}
                      disabled={!importFile || isImporting}
                      className="btn-editorial min-w-[140px]"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Graph
                        </>
                      )}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <>
            {/* Cytoscape Canvas - MUST be first so overlays render on top */}
            <div className="absolute inset-0 w-full h-full z-0" style={{ backgroundColor: '#faf9f7' }}>
              {elements.length > 0 && (
                <CytoscapeComponent
                  elements={CytoscapeComponent.normalizeElements(elements)}
                  style={{ width: '100%', height: '100%' }}
                  stylesheet={stylesheet as any}
                  cy={(cy: cytoscape.Core) => {
                    cyRef.current = cy;

                    cy.on('tap', 'node', (evt: cytoscape.EventObject) => {
                      const node = evt.target;
                      setSelectedNodeData(node.data());
                    });

                    cy.on('tap', (evt: cytoscape.EventObject) => {
                      if (evt.target === cy) {
                        setSelectedNodeData(null);
                      }
                    });
                  }}
                  layout={layoutConfig as any}
                  wheelSensitivity={0.3}
                  minZoom={0.1}
                  maxZoom={4}
                />
              )}
            </div>

            {/* Graph UI Overlay: Controls */}
            <div className="absolute top-6 left-6 flex flex-col gap-4 z-10">
              <div className="bg-white/90 backdrop-blur-md border border-border shadow-editorial p-2 flex flex-col gap-2 rounded-sm">
                <GraphControl icon={<ZoomIn className="w-4 h-4" />} label="Zoom In" onClick={handleZoomIn} />
                <GraphControl icon={<ZoomOut className="w-4 h-4" />} label="Zoom Out" onClick={handleZoomOut} />
                <GraphControl icon={<Maximize className="w-4 h-4" />} label="Fit View" onClick={handleFitView} />
              </div>
              <div className="bg-white/90 backdrop-blur-md border border-border shadow-editorial p-2 flex flex-col gap-2 rounded-sm">
                <GraphControl
                  icon={<RefreshCw className="w-4 h-4" />}
                  label="Regenerate"
                  onClick={() => selectedProjectId && generateGraphMutation.mutate({ projectId: selectedProjectId, type: graphType })}
                />
                <GraphControl
                  icon={<Download className="w-4 h-4" />}
                  label="Export"
                  onClick={() => handleExport("png")}
                />
              </div>
            </div>

            {/* Graph UI Overlay: Search & Legend */}
            <div className="absolute top-6 right-6 flex flex-col gap-4 z-10 w-72">
              <div className="bg-white/90 backdrop-blur-md border border-border shadow-editorial p-4 space-y-4 rounded-sm">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
                  <input
                    type="text"
                    placeholder="Find node..."
                    value={nodeSearch}
                    onChange={(e) => handleNodeSearch(e.target.value)}
                    className="w-full bg-paper border border-border pl-8 pr-2 py-1.5 text-[10px] font-mono uppercase tracking-tight outline-none focus:border-ink transition-colors"
                  />
                  {nodeSearch && (
                    <button
                      onClick={() => handleNodeSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted">Legend</h4>
                  <div className="space-y-1.5">
                    {currentGraphData?.nodes.some((n) => n.type === "work") && (
                      <GraphLegendItem color="bg-[#4a5568]" label="Papers" />
                    )}
                    {currentGraphData?.nodes.some((n) => n.type === "author") && (
                      <GraphLegendItem color="bg-[#2b6cb0]" label="Authors" />
                    )}
                    {currentGraphData?.nodes.some((n) => n.type === "topic") && (
                      <GraphLegendItem color="bg-[#c53030]" label="Topics" />
                    )}
                    {currentGraphData?.nodes.some((n) => n.type === "journal") && (
                      <GraphLegendItem color="bg-[#2f855a]" label="Journals" />
                    )}
                    {!currentGraphData && graphType === "TOPIC_CLUSTER" && (
                      <>
                        <GraphLegendItem color="bg-[#c53030]" label="Topic Clusters" />
                        <GraphLegendItem color="bg-[#4a5568]" label="Papers" />
                      </>
                    )}
                    {!currentGraphData && graphType === "CO_AUTHORSHIP" && (
                      <>
                        <GraphLegendItem color="bg-[#2b6cb0]" label="Authors" />
                        <GraphLegendItem color="bg-[#4a5568]" label="Papers" />
                      </>
                    )}
                  </div>
                </div>
                {insights && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted">Stats</h4>
                    <div className="text-xs font-mono space-y-1">
                      <p>{insights.nodeCount} nodes</p>
                      <p>{insights.edgeCount} connections</p>
                      <p>Avg degree: {insights.avgDegree.toFixed(1)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Selection Details Panel (Floating) */}
            <AnimatePresence>
              {selectedNodeData && (
                <motion.div
                  initial={{ x: 400, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 400, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="absolute top-0 right-0 h-full w-96 bg-white border-l border-border shadow-editorial z-20 p-8 space-y-8 overflow-y-auto"
                >
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-1 bg-intel-blue/10 text-intel-blue text-[10px] font-mono uppercase tracking-widest rounded-sm">
                      {selectedNodeData.type === 'work' && 'Paper'}
                      {selectedNodeData.type === 'author' && 'Author'}
                      {selectedNodeData.type === 'topic' && 'Topic'}
                      {selectedNodeData.type === 'journal' && 'Journal'}
                      {selectedNodeData.type === 'core' && 'Core Paper'}
                      {!['work', 'author', 'topic', 'journal', 'core'].includes(selectedNodeData.type as string) && 'Node'}
                    </span>
                    <button onClick={() => {
                      setSelectedNodeData(null);
                      cyRef.current?.nodes().unselect();
                    }} className="p-2 hover:bg-paper transition-colors rounded-full text-muted hover:text-ink"><XIcon className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-3xl font-serif leading-tight">{selectedNodeData.label as React.ReactNode}</h3>
                    <p className="text-muted font-serif italic text-sm">Influence Score: {(Math.random() * 0.9 + 0.1).toFixed(2)}</p>
                  </div>
                  <div className="accent-line" />
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted">Influence Metrics</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <MetricBox label="Citations" value={Math.floor(Math.random() * 100).toString()} />
                        <MetricBox label="PageRank" value={(Math.random() * 0.9 + 0.1).toFixed(2)} />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted">Key Connections</h4>
                      <ul className="text-sm font-serif italic space-y-3">
                        <li className="hover:text-intel-blue cursor-pointer transition-colors border-b border-border/50 pb-2 flex justify-between items-center group/item">
                          <span>Cited by 12 papers</span>
                          <PlusIcon className="w-3 h-3 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        </li>
                        <li className="hover:text-intel-blue cursor-pointer transition-colors border-b border-border/50 pb-2 flex justify-between items-center group/item">
                          <span>References 45 works</span>
                          <PlusIcon className="w-3 h-3 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="pt-8 space-y-4">
                    <button className="btn-editorial w-full">Save to Library</button>
                    <button className="w-full py-3 border border-border font-serif italic hover:bg-paper transition-all">View Full Metadata</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Interaction Indicator */}
            <div className="absolute bottom-6 right-6 pointer-events-none">
              <div className="bg-white/80 backdrop-blur-md border border-border px-4 py-2 flex items-center gap-2 rounded-sm shadow-sm">
                <MousePointer2 className="w-3 h-3 text-muted" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Drag nodes or zoom to explore</span>
              </div>
            </div>
          </>
        )}
      </div>

      {!isEmpty && insights && (
        <div className="bg-intel-blue/5 border border-intel-blue/20 p-8 flex gap-8 rounded-sm">
          <div className="w-12 h-12 bg-white border border-intel-blue/20 flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="w-6 h-6 text-intel-blue" />
          </div>
          <div className="space-y-2">
            <h3 className="font-serif italic text-xl text-intel-blue font-bold">Graph Insights</h3>
            <p className="text-intel-blue/70 font-serif italic leading-relaxed max-w-3xl">
              {graphType === "TOPIC_CLUSTER" ? (
                <>
                  Your research spans <strong>{insights.topicCount} distinct topics</strong> across {insights.workCount} papers.
                  {insights.mostConnected && (
                    <> The most central theme is "<strong>{insights.mostConnected}</strong>" with {insights.mostConnectedDegree} connections.</>
                  )}
                  {insights.density > 0.3 && " The high network density suggests strong thematic coherence in your review."}
                  {insights.density < 0.1 && " The low network density indicates diverse, loosely connected research areas."}
                </>
              ) : (
                <>
                  Your project includes work from <strong>{insights.authorCount} unique authors</strong>.
                  {insights.mostConnected && (
                    <> The most collaborative author is "<strong>{insights.mostConnected}</strong>" with {insights.mostConnectedDegree} co-authorships.</>
                  )}
                  {insights.avgDegree > 3 && " Strong collaboration patterns detected across the research community."}
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Project Selection Dialog */}
      <Dialog open={showProjectSelect} onOpenChange={setShowProjectSelect}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Generate Research Graph</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                Select Project
              </label>
              {isLoadingProjects ? (
                <div className="flex items-center gap-2 text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading projects...
                </div>
              ) : (
                <select
                  value={selectedProjectId || ""}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full h-10 px-3 border border-border rounded-sm font-serif text-lg bg-white focus:border-ink outline-none"
                >
                  <option value="">Choose a project...</option>
                  {projectsData?.items?.map((project: { id: string; title: string }) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                Graph Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setGraphType("TOPIC_CLUSTER")}
                  className={cn(
                    "p-4 border rounded-sm text-left transition-all",
                    graphType === "TOPIC_CLUSTER"
                      ? "border-intel-blue bg-intel-blue/5"
                      : "border-border hover:border-ink"
                  )}
                >
                  <div className="font-serif font-bold">Topic Clusters</div>
                  <div className="text-xs text-muted font-serif italic">
                    Group papers by shared keywords and themes
                  </div>
                </button>
                <button
                  onClick={() => setGraphType("CO_AUTHORSHIP")}
                  className={cn(
                    "p-4 border rounded-sm text-left transition-all",
                    graphType === "CO_AUTHORSHIP"
                      ? "border-intel-blue bg-intel-blue/5"
                      : "border-border hover:border-ink"
                  )}
                >
                  <div className="font-serif font-bold">Co-Authorship</div>
                  <div className="text-xs text-muted font-serif italic">
                    Map collaboration networks between authors
                  </div>
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProjectSelect(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedProjectId) {
                  generateGraphMutation.mutate({ projectId: selectedProjectId, type: graphType });
                }
              }}
              disabled={!selectedProjectId || generateGraphMutation.isPending}
              className="bg-ink text-paper hover:bg-ink/90"
            >
              {generateGraphMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Network className="w-4 h-4 mr-2" />
                  Generate Graph
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OnboardingCard({ icon, title, description, onClick }: { icon: React.ReactNode, title: string, description: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-border p-8 text-left space-y-4 hover:border-ink hover:shadow-editorial transition-all group rounded-sm"
    >
      <div className="w-12 h-12 bg-paper border border-border flex items-center justify-center group-hover:border-ink transition-colors">
        {icon}
      </div>
      <div className="space-y-1">
        <h4 className="text-xl font-serif font-bold italic leading-none">{title}</h4>
        <p className="text-sm font-serif italic text-muted leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">{description}</p>
      </div>
    </button>
  );
}

function MetricBox({ label, value }: { label: string, value: string }) {
  return (
    <div className="bg-paper p-4 border border-border rounded-sm">
      <label className="text-[10px] font-mono uppercase tracking-widest text-muted block mb-1">{label}</label>
      <div className="text-xl font-mono font-bold tracking-tight">{value}</div>
    </div>
  );
}
