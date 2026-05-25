import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Page } from '../types';
import { parseWikiLinks } from '../lib/backlinks';
import { cn } from '../lib/utils';
import { GitGraph, Maximize2, Minimize2, RefreshCw } from 'lucide-react';

interface BacklinksGraphProps {
  pages: Page[];
  backlinks: string[];
  currentPageId: string | null;
  onNavigateToPage: (pageId: string) => void;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface NodePosition {
  id: string;
  title: string;
  icon: string;
  isCurrent: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Interactive Force-Directed Graph Layout for page relationships.
 * Pure React + SVG with physics simulation, dragging, hover effects, and flow animations.
 */
export function BacklinksGraph({ pages, backlinks, currentPageId, onNavigateToPage }: BacklinksGraphProps) {
  const [expanded, setExpanded] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [alpha, setAlpha] = useState(1.0);
  const [simNodes, setSimNodes] = useState<NodePosition[]>([]);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Width & height of viewport
  const width = 500;
  const height = 500;

  // Build edges statically based on the pages and backlinks data
  const edges = useMemo(() => {
    const relevantPages = new Set<string>();

    if (currentPageId) relevantPages.add(currentPageId);
    for (const bid of backlinks) relevantPages.add(bid);

    const currentPage = pages.find(p => p.id === currentPageId);
    if (currentPage) {
      const outLinks = parseWikiLinks(currentPage.blocks.map(b => b.content).join(' '));
      for (const title of outLinks) {
        const linked = pages.find(p => p.title === title);
        if (linked) relevantPages.add(linked.id);
      }
    }

    const graphEdges: GraphEdge[] = [];
    for (const page of pages) {
      if (!relevantPages.has(page.id)) continue;
      const outLinks = parseWikiLinks(page.blocks.map(b => b.content).join(' '));
      for (const title of outLinks) {
        const linked = pages.find(p => p.title === title && relevantPages.has(p.id));
        if (linked && linked.id !== page.id) {
          const exists = graphEdges.some(
            e => (e.source === page.id && e.target === linked.id) ||
                 (e.source === linked.id && e.target === page.id)
          );
          if (!exists) {
            graphEdges.push({ source: page.id, target: linked.id });
          }
        }
      }
    }

    return graphEdges;
  }, [pages, backlinks, currentPageId]);

  // Determine connected components for highlighting
  const connectedNodes = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const connected = new Set<string>([hoveredNode]);
    edges.forEach(edge => {
      if (edge.source === hoveredNode) connected.add(edge.target);
      if (edge.target === hoveredNode) connected.add(edge.source);
    });
    return connected;
  }, [hoveredNode, edges]);

  // Re-initialize or update nodes when pages/currentPage/backlinks change
  const initializeLayout = useCallback(() => {
    const relevantPages = new Set<string>();
    if (currentPageId) relevantPages.add(currentPageId);
    for (const bid of backlinks) relevantPages.add(bid);

    const currentPage = pages.find(p => p.id === currentPageId);
    if (currentPage) {
      const outLinks = parseWikiLinks(currentPage.blocks.map(b => b.content).join(' '));
      for (const title of outLinks) {
        const linked = pages.find(p => p.title === title);
        if (linked) relevantPages.add(linked.id);
      }
    }

    setSimNodes(prevNodes => {
      const nextNodes: NodePosition[] = [];
      const prevMap = new Map(prevNodes.map(n => [n.id, n]));
      const pageIds = Array.from(relevantPages);
      const cx = width / 2;
      const cy = height / 2;

      pageIds.forEach((pid, i) => {
        const page = pages.find(p => p.id === pid);
        if (!page) return;
        const prev = prevMap.get(pid);

        if (prev) {
          nextNodes.push({
            ...prev,
            title: page.title || 'Untitled',
            icon: page.icon || '📄',
            isCurrent: page.id === currentPageId,
          });
        } else {
          const angle = (2 * Math.PI * i) / Math.max(pageIds.length, 1);
          const radius = 130 + Math.random() * 20;
          nextNodes.push({
            id: page.id,
            title: page.title || 'Untitled',
            icon: page.icon || '📄',
            isCurrent: page.id === currentPageId,
            x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 10,
            y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 10,
            vx: 0,
            vy: 0,
          });
        }
      });

      return nextNodes;
    });

    setAlpha(1.0);
  }, [pages, backlinks, currentPageId]);

  useEffect(() => {
    initializeLayout();
  }, [initializeLayout]);

  // Handle Dragging interaction
  useEffect(() => {
    if (!draggedNode) return;

    const handleMouseMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * width;
      const y = ((e.clientY - rect.top) / rect.height) * height;

      setSimNodes(prev =>
        prev.map(node => {
          if (node.id === draggedNode.id) {
            return {
              ...node,
              x: Math.max(30, Math.min(width - 30, x + draggedNode.offsetX)),
              y: Math.max(30, Math.min(height - 30, y + draggedNode.offsetY)),
              vx: 0,
              vy: 0,
            };
          }
          return node;
        })
      );
      setAlpha(1.0); // Keep simulation active
    };

    const handleMouseUp = () => {
      setDraggedNode(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedNode]);

  // Force-directed physics calculation loop
  useEffect(() => {
    if (alpha <= 0.005 || simNodes.length === 0) return;

    let frameId: number;

    const tick = () => {
      setSimNodes(currentNodes => {
        // Create copies of the nodes to mutate physics values
        const nodes = currentNodes.map(n => ({ ...n }));

        const cx = width / 2;
        const cy = height / 2;

        const repulsionStrength = 3200;
        const springStrength = 0.07;
        const desiredLength = 110;
        const gravity = 0.03;
        const damping = 0.76;

        // 1. Repulsion force between all node pairs
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const u = nodes[i];
            const v = nodes[j];
            let dx = u.x - v.x;
            let dy = u.y - v.y;
            if (dx === 0) dx = 0.1;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq);

            const force = repulsionStrength / Math.max(distSq, 100);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            // Do not move the dragged node
            if (!draggedNode || draggedNode.id !== u.id) {
              u.vx += fx;
              u.vy += fy;
            }
            if (!draggedNode || draggedNode.id !== v.id) {
              v.vx -= fx;
              v.vy -= fy;
            }
          }
        }

        // 2. Attraction force along edges (springs)
        edges.forEach(edge => {
          const source = nodes.find(n => n.id === edge.source);
          const target = nodes.find(n => n.id === edge.target);
          if (!source || !target) return;

          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

          const force = (dist - desiredLength) * springStrength;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (!draggedNode || draggedNode.id !== source.id) {
            source.vx += fx;
            source.vy += fy;
          }
          if (!draggedNode || draggedNode.id !== target.id) {
            target.vx -= fx;
            target.vy -= fy;
          }
        });

        // 3. Central gravity and integration step
        nodes.forEach(node => {
          if (draggedNode && draggedNode.id === node.id) {
            return; // Skip position calculation for dragged node
          }

          const dx = cx - node.x;
          const dy = cy - node.y;
          node.vx += dx * gravity;
          node.vy += dy * gravity;

          node.vx *= damping;
          node.vy *= damping;

          node.x += node.vx;
          node.y += node.vy;

          // Keep nodes bounds friendly
          node.x = Math.max(30, Math.min(width - 30, node.x));
          node.y = Math.max(30, Math.min(height - 30, node.y));
        });

        return nodes;
      });

      setAlpha(a => a * 0.95);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [alpha, edges, draggedNode, simNodes.length]);

  const handleNodeMouseDown = (e: React.MouseEvent<SVGGElement>, node: NodePosition) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const y = ((e.clientY - rect.top) / rect.height) * height;

    setDraggedNode({
      id: node.id,
      offsetX: node.x - x,
      offsetY: node.y - y,
    });
    setAlpha(1.0);
  };

  if (simNodes.length <= 1) {
    return (
      <div className="text-center py-8 bg-gray-50/50 dark:bg-stone-800/20 rounded-xl border border-dashed border-gray-200 dark:border-stone-800">
        <GitGraph size={28} className="mx-auto text-gray-300 dark:text-stone-600 mb-2 animate-pulse" />
        <p className="text-xs text-gray-400 italic">Not enough linked pages to show a graph.</p>
        <p className="text-[11px] text-gray-500 dark:text-stone-400 mt-1 max-w-[240px] mx-auto">
          Use the <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-stone-800 font-mono text-[10px]">[[Page Title]]</code> syntax in editor to connect pages.
        </p>
      </div>
    );
  }

  const graphHeight = expanded ? 500 : 320;

  return (
    <div ref={containerRef} className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-stone-400 flex items-center gap-1.5">
          <GitGraph size={13} className="text-purple-500" />
          Page Connection Map ({simNodes.length} pages)
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={initializeLayout}
            title="Reset layout physics"
            className="p-1 rounded text-gray-400 hover:text-purple-600 hover:bg-gray-100 dark:hover:bg-stone-800 transition-colors"
          >
            <RefreshCw size={11} className={cn(alpha > 0.1 && "animate-spin")} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1 font-medium bg-purple-50 dark:bg-purple-950/20 px-2 py-0.5 rounded-full transition-all"
          >
            {expanded ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      <div
        className="relative rounded-xl border border-gray-200 dark:border-stone-700/80 bg-white dark:bg-[#1E1E1E] overflow-hidden transition-all duration-300"
        style={{ height: graphHeight }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full select-none"
        >
          <defs>
            {/* Dot grid pattern */}
            <pattern id="grid-pattern" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" className="fill-gray-200/60 dark:fill-stone-800/50" />
            </pattern>

            {/* Glowing filter for nodes */}
            <filter id="node-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Edge arrowhead markers */}
            <marker
              id="arrow-in"
              viewBox="0 0 10 10"
              refX="33"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" className="fill-purple-400/80 dark:fill-purple-500/80" />
            </marker>

            <marker
              id="arrow-out"
              viewBox="0 0 10 10"
              refX="28"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" className="fill-purple-500/80 dark:fill-purple-400/80" />
            </marker>

            <marker
              id="arrow-normal"
              viewBox="0 0 10 10"
              refX="24"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" className="fill-gray-300 dark:fill-stone-700" />
            </marker>
          </defs>

          {/* Embedded micro-animations */}
          <style>{`
            @keyframes flow-reverse {
              to {
                stroke-dashoffset: 20;
              }
            }
            @keyframes flow-forward {
              to {
                stroke-dashoffset: -20;
              }
            }
            .flow-line-in {
              stroke-dasharray: 5 5;
              animation: flow-reverse 1.5s linear infinite;
            }
            .flow-line-out {
              stroke-dasharray: 5 5;
              animation: flow-forward 1.5s linear infinite;
            }
            .pulse-active {
              animation: active-pulse 2s ease-in-out infinite;
            }
            @keyframes active-pulse {
              0%, 100% {
                transform: scale(1);
                filter: drop-shadow(0 0 4px rgba(139, 92, 246, 0.4));
              }
              50% {
                transform: scale(1.03);
                filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.7));
              }
            }
          `}</style>

          {/* Grid Background */}
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />

          {/* Connecting Edges */}
          {edges.map((edge, i) => {
            const source = simNodes.find(n => n.id === edge.source);
            const target = simNodes.find(n => n.id === edge.target);
            if (!source || !target) return null;

            const isRelated = hoveredNode === null || connectedNodes.has(edge.source) && connectedNodes.has(edge.target);
            const isDirectlyHovered = hoveredNode !== null && (edge.source === hoveredNode || edge.target === hoveredNode);
            
            const isSourceCurrent = source.isCurrent;
            const isTargetCurrent = target.isCurrent;
            const connectsToCurrent = isSourceCurrent || isTargetCurrent;

            // Direct connection styles
            let strokeColor = "stroke-gray-200 dark:stroke-stone-800/80";
            let markerId = "arrow-normal";
            let lineClass = "";

            if (connectsToCurrent) {
              strokeColor = "stroke-purple-300 dark:stroke-purple-900/60";
              if (isSourceCurrent) {
                lineClass = "flow-line-out";
                markerId = "arrow-out";
              } else {
                lineClass = "flow-line-in";
                markerId = "arrow-in";
              }
            }

            if (isDirectlyHovered) {
              strokeColor = "stroke-purple-500 dark:stroke-purple-400";
              lineClass = isSourceCurrent || edge.source === hoveredNode ? "flow-line-out" : "flow-line-in";
            }

            return (
              <g key={`edge-${i}`} className="transition-all duration-300" opacity={isRelated ? (isDirectlyHovered ? 1.0 : 0.6) : 0.15}>
                {/* Secondary thick glow background line for active links */}
                {(isDirectlyHovered || (connectsToCurrent && !hoveredNode)) && (
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    strokeWidth={5}
                    className="stroke-purple-400/20 dark:stroke-purple-500/10 pointer-events-none"
                  />
                )}
                {/* Main line */}
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  strokeWidth={isDirectlyHovered ? 2.5 : 1.5}
                  className={cn(strokeColor, lineClass, "transition-all duration-300")}
                  markerEnd={`url(#${markerId})`}
                />
              </g>
            );
          })}

          {/* Node Elements */}
          {simNodes.map((node) => {
            const isNodeRelated = hoveredNode === null || connectedNodes.has(node.id);
            const isDirectHover = hoveredNode === node.id;
            const isCurrentDrag = draggedNode?.id === node.id;

            return (
              <g
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                onClick={() => {
                  if (!isCurrentDrag) {
                    onNavigateToPage(node.id);
                  }
                }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className={cn(
                  "cursor-grab active:cursor-grabbing transition-opacity duration-300",
                  node.isCurrent && "pulse-active"
                )}
                style={{
                  transform: `translate(${node.x}px, ${node.y}px)`,
                  transition: isCurrentDrag ? 'none' : 'transform 0.05s ease-out, opacity 0.3s ease',
                }}
                opacity={isNodeRelated ? 1.0 : 0.15}
              >
                {/* Glowing Aura for hovered or current page node */}
                {(isDirectHover || node.isCurrent) && (
                  <circle
                    r={node.isCurrent ? 28 : 22}
                    className="fill-purple-500/10 dark:fill-purple-500/5 animate-pulse"
                    filter="url(#node-glow)"
                  />
                )}

                {/* Node Outer Ring / Border */}
                <circle
                  r={node.isCurrent ? 22 : 18}
                  className={cn(
                    "transition-all duration-300",
                    node.isCurrent
                      ? "fill-gradient-to-br from-purple-500 to-indigo-600 stroke-purple-600 dark:stroke-purple-400 stroke-2"
                      : "fill-white dark:fill-[#2A2A2A] stroke-gray-300 dark:stroke-stone-700/80 stroke-1.5",
                    isDirectHover && !node.isCurrent && "stroke-purple-400 dark:stroke-purple-600 scale-110",
                    isCurrentDrag && "stroke-purple-500 scale-105 shadow-lg"
                  )}
                  style={{
                    fill: node.isCurrent ? 'url(#purpleGradient)' : undefined
                  }}
                />

                {/* Node Icon */}
                <text
                  textAnchor="middle"
                  y={node.isCurrent ? 5 : 5}
                  fontSize={node.isCurrent ? 18 : 14}
                  className="pointer-events-none select-none font-sans"
                >
                  {node.icon}
                </text>

                {/* Label text */}
                <text
                  textAnchor="middle"
                  y={node.isCurrent ? 36 : 30}
                  fontSize={node.isCurrent ? 10 : 9}
                  fontWeight={node.isCurrent ? 600 : 500}
                  className={cn(
                    "pointer-events-none select-none tracking-wide transition-all duration-300",
                    node.isCurrent
                      ? "fill-purple-600 dark:fill-purple-400 font-semibold"
                      : "fill-[#37352F] dark:fill-[#C8C8C8]",
                    isDirectHover && !node.isCurrent && "fill-purple-700 dark:fill-purple-400 font-medium translate-y-1"
                  )}
                >
                  {node.title.length > 14 ? node.title.substring(0, 11) + '…' : node.title}
                </text>
              </g>
            );
          })}

          {/* Linear Gradients definitions */}
          <defs>
            <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
          </defs>
        </svg>

        {/* Legend overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 text-[9px] bg-white/70 dark:bg-stone-900/60 backdrop-blur-md px-2 py-1.5 rounded-lg border border-gray-100 dark:border-stone-800 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shadow-sm" />
            <span className="text-gray-600 dark:text-stone-300 font-medium">Current Page</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white dark:bg-[#2A2A2A] border border-gray-300 dark:border-stone-700" />
            <span className="text-gray-500 dark:text-stone-400">Linked Page</span>
          </div>
        </div>

        {/* Selected / Hovered page context card */}
        {hoveredNode && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 px-3 py-2 rounded-lg bg-white/95 dark:bg-[#1A1A1A]/95 backdrop-blur-md border border-gray-200 dark:border-stone-800 shadow-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-[#37352F] dark:text-[#E3E3E3] flex items-center gap-1.5">
                <span>{simNodes.find(n => n.id === hoveredNode)?.icon}</span>
                <span className="truncate max-w-[250px]">{simNodes.find(n => n.id === hoveredNode)?.title || 'Untitled'}</span>
              </div>
              <span className="text-[8px] uppercase tracking-wider font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-1.5 py-0.5 rounded">
                {hoveredNode === currentPageId ? 'Active' : backlinks.includes(hoveredNode) ? 'Inbound' : 'Outbound'}
              </span>
            </div>
            <div className="text-[10px] text-gray-400 dark:text-stone-400 mt-1 flex items-center gap-1">
              <span>{hoveredNode === currentPageId ? 'You are viewing this page' : 'Click to navigate to this page'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Build the full relationship map: for every page, collect inbound and outbound links.
 */
export function usePageRelations(pages: Page[]) {
  return useMemo(() => {
    const map = new Map<string, { inbound: string[]; outbound: string[] }>();

    for (const page of pages) {
      const outLinks = parseWikiLinks(page.blocks.map(b => b.content).join(' '));
      const outIds = outLinks
        .map(title => pages.find(p => p.title === title)?.id)
        .filter((id): id is string => id !== undefined && id !== page.id);

      map.set(page.id, { inbound: [], outbound: outIds });
    }

    for (const [pageId, rel] of map.entries()) {
      for (const outId of rel.outbound) {
        const target = map.get(outId);
        if (target && !target.inbound.includes(pageId)) {
          target.inbound.push(pageId);
        }
      }
    }

    return map;
  }, [pages]);
}
