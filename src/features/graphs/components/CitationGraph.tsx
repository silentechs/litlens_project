"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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

interface CitationGraphProps {
  projectId?: string;
}

export function CitationGraph({ projectId }: CitationGraphProps) {
  const queryClient = useQueryClient();
  const [elements, setElements] = useState<cytoscape.ElementDefinition[]>([]);
  const [selectedNodeData, setSelectedNodeData] = useState<Record<string, unknown> | null>(null);
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectId || null);
  const [graphType, setGraphType] = useState<"TOPIC_CLUSTER" | "CO_AUTHORSHIP">("TOPIC_CLUSTER");
  const [nodeSearch, setNodeSearch] = useState("");
  const [currentGraphData, setCurrentGraphData] = useState<GraphData | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(projectId);
    }
  }, [projectId]);

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

  // Auto-generate/fetch graph if projectId is provided
  useEffect(() => {
    if (projectId && !currentGraphData && !generateGraphMutation.isPending) {
      generateGraphMutation.mutate({ projectId, type: graphType });
    }
    // Only run on mount or when projectId/type changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, graphType]);

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
        'background-color': '#fff',
        'label': 'data(label)',
        'font-family': 'Inter, system-ui, sans-serif',
        'font-weight': '500',
        'font-size': '11px',
        'color': '#0f172a', // slate-900
        'text-margin-y': 6,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'width': (ele: cytoscape.NodeSingular) => ele.data('size') || 30,
        'height': (ele: cytoscape.NodeSingular) => ele.data('size') || 30,
        'border-width': 1,
        'border-color': '#94a3b8', // slate-400
        'transition-property': 'border-color, border-width, background-color, width, height',
        'transition-duration': '200ms',
        'text-wrap': 'wrap',
        'text-max-width': 100,
      }
    },
    {
      selector: 'node[type="work"]',
      style: {
        'background-color': '#eff6ff', // blue-50
        'border-color': '#3b82f6', // blue-500
        'shape': 'ellipse',
      }
    },
    {
      selector: 'node[type="author"]',
      style: {
        'background-color': '#f0fdf4', // green-50
        'border-color': '#22c55e', // green-500
        'shape': 'round-rectangle',
        'width': 24,
        'height': 24
      }
    },
    {
      selector: 'node[type="topic"]',
      style: {
        'background-color': '#fefce8', // yellow-50
        'border-color': '#eab308', // yellow-500
        'shape': 'round-hexagon',
      }
    },
    {
      selector: 'node[type="journal"]',
      style: {
        'background-color': '#faf5ff', // purple-50
        'border-color': '#a855f7', // purple-500
        'shape': 'tag',
      }
    },
    {
      selector: 'node[type="core"]',
      style: {
        'background-color': '#0f172a', // slate-900
        'border-color': '#0f172a',
        'color': '#fff',
      }
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'border-color': '#0f172a', // slate-900
        'shadow-blur': 10,
        'shadow-color': 'rgba(0,0,0,0.1)',
      }
    },
    {
      selector: 'node.highlighted',
      style: {
        'background-color': '#3b82f6', // blue-500
        'border-color': '#1d4ed8', // blue-700
        'color': '#1d4ed8',
        'font-weight': 'bold',
      }
    },
    {
      selector: 'node.dimmed',
      style: {
        'opacity': 0.3,
        'color': '#cbd5e1', // slate-300
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 1.5,
        'line-color': '#cbd5e0',
        'line-style': 'solid',
        'curve-style': 'bezier',
        'target-arrow-shape': 'none',
        'opacity': 0.4
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
    <div className="space-y-6 h-full flex flex-col bg-slate-50/50">
      <header className="flex justify-between items-center px-6 pt-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Network Analysis</h1>
          <p className="text-sm text-slate-500">Visualize citations, co-authorship, and topic clusters.</p>
        </div>
        <div className="flex gap-3">
          {!isEmpty && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("png")}
                className="h-8 text-xs uppercase tracking-wider"
              >
                <Download className="w-3.5 h-3.5 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setElements([]);
                  setCurrentGraphData(null);
                }}
                className="h-8 text-xs uppercase tracking-wider"
              >
                Clear
              </Button>
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

      {/* Onboarding State */}
      {isEmpty ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center space-y-8 bg-slate-50/50">
          <div className="w-20 h-20 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm">
            <Network className="w-8 h-8 text-slate-400" />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Start Mapping</h2>
            <p className="text-slate-500 text-base leading-relaxed">
              Visualize connections between papers, authors, and topics.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-xl">
            <OnboardingCard
              icon={<Database className="w-5 h-5 text-blue-600" />}
              title="Connect Project"
              description="Map your current systematic review studies."
              onClick={() => setShowProjectSelect(true)}
            />
            <OnboardingCard
              icon={<Upload className="w-5 h-5 text-violet-600" />}
              title="Import Bibliography"
              description="Upload RIS/BibTeX files."
              onClick={() => setShowImportDialog(true)}
            />
          </div>

          {/* Import Bibliography Dialog */}
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogContent className="sm:max-w-lg bg-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">Import Bibliography</DialogTitle>
                <p className="text-slate-500 text-sm mt-1">
                  Upload a file to visualize historical citations.
                </p>
              </DialogHeader>

              <div className="py-6">
                {!importFile ? (
                  <div className="group relative">
                    <label
                      htmlFor="bibliography-upload"
                      className="relative flex flex-col items-center justify-center w-full aspect-[2/1] border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all duration-200"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                        <div className="p-3 bg-slate-100 rounded-full mb-3 group-hover:bg-blue-100 transition-colors">
                          <Upload className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                        </div>
                        <p className="text-sm font-medium text-slate-700">
                          Click to upload <span className="text-slate-400 font-normal">or drag and drop</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-2 uppercase tracking-wide font-medium">
                          RIS, BibTeX, CSV
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
                  <div className="relative flex items-center p-3 border border-slate-200 rounded-lg bg-slate-50">
                    <div className="p-2 bg-white border border-slate-200 rounded md:mr-3 shadow-sm">
                      <FileText className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0 ml-3">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {importFile.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(importFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => setImportFile(null)}
                      className="p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-md transition-colors"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowImportDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleBibliographyImport}
                  disabled={!importFile || isImporting}
                  className="min-w-[120px]"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <>
          {/* Visualizer Shell */}
          <div className="absolute inset-0 w-full h-full z-0 bg-slate-50/30">
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

          {/* Controls */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
            <div className="bg-white/90 backdrop-blur border border-slate-200 shadow-sm p-1.5 flex flex-col gap-1 rounded-lg">
              <GraphControl icon={<ZoomIn className="w-4 h-4" />} label="Zoom In" onClick={handleZoomIn} />
              <GraphControl icon={<ZoomOut className="w-4 h-4" />} label="Zoom Out" onClick={handleZoomOut} />
              <GraphControl icon={<Maximize className="w-4 h-4" />} label="Fit View" onClick={handleFitView} />
            </div>
          </div>

          {/* Search & Legend */}{/* NOTE: Updated styles for Search/Legend container to match modern look */}
          <div className="absolute top-4 right-4 flex flex-col gap-4 z-10 w-64">
            <div className="bg-white/90 backdrop-blur border border-slate-200 shadow-sm p-3 space-y-3 rounded-lg">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search nodes..."
                  value={nodeSearch}
                  onChange={(e) => handleNodeSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 pl-8 pr-2 py-1.5 text-xs rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                />
                {nodeSearch && (
                  <button
                    onClick={() => handleNodeSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Legend</h4>
                <div className="space-y-1">
                  {/* Legend Items using generic component but passing new classes if needed, assuming component handles classes */}
                  {/* We might need to update GraphLegendItem too, but for now we rely on the component accepting these props or being simple enough */}
                  {/* Actually, let's just inline the map logic or trust currentGraphData structure */}
                  {currentGraphData?.nodes.some((n) => n.type === "work") && (
                    <GraphLegendItem color="bg-blue-500" label="Papers" />
                  )}
                  {currentGraphData?.nodes.some((n) => n.type === "author") && (
                    <GraphLegendItem color="bg-green-500" label="Authors" />
                  )}
                  {currentGraphData?.nodes.some((n) => n.type === "topic") && (
                    <GraphLegendItem color="bg-yellow-500" label="Topics" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Selection Panel */}
          <AnimatePresence>
            {selectedNodeData && (
              <motion.div
                initial={{ x: 350, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 350, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute top-0 right-0 h-full w-80 bg-white border-l border-slate-200 shadow-xl z-20 p-6 overflow-y-auto"
              >
                <div className="flex justify-between items-start mb-6">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] uppercase font-bold tracking-wider rounded">
                    {String(selectedNodeData.type)}
                  </span>
                  <button onClick={() => {
                    setSelectedNodeData(null);
                    cyRef.current?.nodes().unselect();
                  }} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"><XIcon className="w-4 h-4" /></button>
                </div>

                <h3 className="text-xl font-bold text-slate-900 leading-snug mb-2">{String(selectedNodeData.label)}</h3>

                {/* Placeholder Stats */}
                <div className="space-y-4 mt-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase font-medium">Degree</p>
                      <p className="text-lg font-semibold text-slate-900">{(Math.random() * 20).toFixed(0)}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded border border-slate-100">
                      <p className="text-[10px] text-slate-500 uppercase font-medium">Centrality</p>
                      <p className="text-lg font-semibold text-slate-900">{(Math.random()).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-4">ACTIONS</p>
                  <Button className="w-full mb-2 bg-blue-600 hover:bg-blue-700">Explore Connections</Button>
                  <Button variant="outline" className="w-full">View Details</Button>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {
        !isEmpty && insights && (
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
        )
      }

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
    </div >
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
