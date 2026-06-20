import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { api } from '../api';
import { getRiskProperties } from '../components/RiskBadge';
import AccountSlideOver from '../components/AccountSlideOver';

export default function GraphView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const accountId = searchParams.get('accountId');
  const alertId = searchParams.get('alertId');

  const fgRef = useRef();
  
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Slide-over state
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  
  // Replay animation state
  const [isReplaying, setIsReplaying] = useState(false);
  const [allEdges, setAllEdges] = useState([]);
  const [visibleEdges, setVisibleEdges] = useState([]);
  const replayTimerRef = useRef(null);

  // Load Graph Data
  const loadGraph = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Clear previous graph & states
      setGraphData({ nodes: [], links: [] });
      setAllEdges([]);
      setVisibleEdges([]);
      setIsReplaying(false);
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);

      const params = {
        accountId: accountId || undefined,
        alertId: alertId || undefined,
        depth: 2
      };
      
      // Default to acc_0042 if nothing is provided (per PRD center node default)
      if (!accountId && !alertId) {
        params.accountId = 'acc_0042';
      }

      const res = await api.getGraph(params);
      
      // Map the backend structure to force-graph standard: nodes: [...], links: [...] (matching edges: source/target)
      const nodes = res.nodes || [];
      const edges = (res.edges || []).map(edge => ({
        ...edge,
        source: typeof edge.source === 'object' ? edge.source.id : edge.source,
        target: typeof edge.target === 'object' ? edge.target.id : edge.target
      }));

      // Sort edges by timestamp for replay
      const sortedEdges = [...edges].sort((a, b) => new Date(a.last_timestamp) - new Date(b.last_timestamp));
      
      setGraphData({ nodes, links: edges });
      setAllEdges(sortedEdges);
      setVisibleEdges(edges); // initially all are visible
      
      // If we queried a center node, open slide-over for it by default
      if (accountId) {
        setSelectedAccountId(accountId);
      } else if (res.center_id) {
        setSelectedAccountId(res.center_id);
      }

    } catch (err) {
      console.error(err);
      setError('Failed to download graph trail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
    return () => {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    };
  }, [accountId, alertId]);

  // Handle double click: follow the money / expand node
  const handleNodeDoubleClick = async (node) => {
    try {
      setLoading(true);
      const res = await api.getGraph({ accountId: node.id, depth: 2 });
      
      // Merge nodes
      const existingNodeIds = new Set(graphData.nodes.map(n => n.id));
      const newNodes = [...graphData.nodes];
      res.nodes.forEach(n => {
        if (!existingNodeIds.has(n.id)) {
          newNodes.push(n);
        }
      });

      // Merge edges
      const existingEdgeIds = new Set(graphData.links.map(e => e.id));
      const newEdges = [...graphData.links];
      res.edges.forEach(e => {
        if (!existingEdgeIds.has(e.id)) {
          newEdges.push({
            ...e,
            source: typeof e.source === 'object' ? e.source.id : e.source,
            target: typeof e.target === 'object' ? e.target.id : e.target
          });
        }
      });

      setGraphData({ nodes: newNodes, links: newEdges });
      setAllEdges([...newEdges].sort((a, b) => new Date(a.last_timestamp) - new Date(b.last_timestamp)));
      setVisibleEdges(newEdges);
      setSelectedAccountId(node.id);
    } catch (err) {
      console.error(err);
      setError('Expansion failed.');
    } finally {
      setLoading(false);
    }
  };

  // Replay Animation Controls
  const startReplay = () => {
    if (allEdges.length === 0) return;
    
    setIsReplaying(true);
    setVisibleEdges([]); // hide everything
    
    let currentIndex = 0;
    if (replayTimerRef.current) clearInterval(replayTimerRef.current);

    replayTimerRef.current = setInterval(() => {
      if (currentIndex >= allEdges.length) {
        clearInterval(replayTimerRef.current);
        setIsReplaying(false);
      } else {
        setVisibleEdges(prev => [...prev, allEdges[currentIndex]]);
        currentIndex++;
      }
    }, 1200); // 1.2s delay per edge
  };

  const stopReplay = () => {
    if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    setIsReplaying(false);
    setVisibleEdges(allEdges); // show all edges
  };

  // Reset graph layout / center zoom
  const handleResetZoom = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 50);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen relative bg-aura-bg select-none text-aura-textLight">
      {/* Legend & Controls Toolbar */}
      <div className="absolute top-4 left-4 z-10 glass-panel p-4 rounded-lg flex flex-col gap-3 max-w-xs sm:max-w-sm pointer-events-auto">
        <div className="flex items-center justify-between border-b border-aura-border pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">Graph Legend</h3>
          <button 
            onClick={handleResetZoom}
            className="p-1 text-[10px] text-aura-accent hover:underline font-mono"
          >
            RESET_CAMERA
          </button>
        </div>
        
        {/* Risk levels */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-aura-critical" />
            <span>Critical Risk (&ge;90)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-aura-high" />
            <span>High Risk (70-89)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-aura-medium" />
            <span>Medium Risk (40-69)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-aura-low" />
            <span>Low Risk (&lt;40)</span>
          </div>
        </div>

        {/* Account Types */}
        <div className="border-t border-aura-border/50 pt-2 space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 border border-white bg-aura-panelLight" />
            <span>Shell Account (Square)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full border border-white bg-aura-panelLight" />
            <span>Corporate / Indiv (Circle)</span>
          </div>
        </div>

        {/* Edge Styles */}
        <div className="border-t border-aura-border/50 pt-2 space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-6 h-0.5 bg-aura-critical" />
            <span className="text-aura-critical font-semibold">Suspicious Transfer Loop</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-0.5 bg-aura-border" />
            <span>Standard Transfer</span>
          </div>
        </div>

        {/* Replay controller */}
        <div className="border-t border-aura-border/50 pt-3 flex items-center justify-between gap-3">
          <span className="text-[10px] text-aura-textMuted font-mono">FLOW REPLAY</span>
          <div className="flex items-center gap-2">
            {isReplaying ? (
              <button 
                onClick={stopReplay}
                className="px-2.5 py-1 text-xs font-semibold bg-aura-critical/20 border border-aura-critical/40 text-aura-critical hover:bg-aura-critical/30 rounded transition-all"
              >
                Stop Replay
              </button>
            ) : (
              <button 
                onClick={startReplay}
                disabled={allEdges.length === 0}
                className="px-2.5 py-1 text-xs font-semibold bg-aura-accent/20 border border-aura-accent/40 text-aura-accent hover:bg-aura-accent/30 rounded transition-all disabled:opacity-50"
              >
                Play Timeline
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating alert/dossier notification bar if loaded an alert */}
      {alertId && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 glass-panel px-6 py-3 rounded-lg border border-aura-critical/30 flex items-center gap-4 max-w-2xl text-center">
          <div className="w-2.5 h-2.5 rounded-full bg-aura-critical animate-ping" />
          <div className="text-left">
            <span className="text-xs font-mono font-bold text-aura-critical block">THREAT_VECTOR_ALERT: {alertId}</span>
            <span className="text-xs text-white">Double click nodes to follow flow. Red pulses indicate cycling transactions.</span>
          </div>
        </div>
      )}

      {/* Error/Loading */}
      {error && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10 p-3 rounded border border-aura-critical/30 bg-aura-critical/10 text-aura-critical text-xs font-mono">
          {error}
        </div>
      )}

      {loading && (
        <div className="absolute bottom-4 left-4 z-10 glass-panel px-4 py-2 rounded flex items-center gap-3">
          <svg className="animate-spin h-4 w-4 text-aura-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs font-mono">Updating topology...</span>
        </div>
      )}

      {/* Graph Area */}
      <div className="flex-1 w-full h-full min-h-[90vh]">
        {graphData.nodes.length > 0 ? (
          <ForceGraph2D
            ref={fgRef}
            graphData={{ 
              nodes: graphData.nodes, 
              links: visibleEdges.map(edge => ({
                ...edge,
                source: typeof edge.source === 'object' ? edge.source.id : edge.source,
                target: typeof edge.target === 'object' ? edge.target.id : edge.target
              }))
            }}
            backgroundColor="#0B0E14"
            
            // Link formatting
            linkWidth={d => Math.max(1, Math.min(5, Math.log10(d.amount / 1000)))}
            linkColor={d => d.suspicious ? '#F85149' : '#30363D'}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            
            // Suspect edges show flow animation particles
            linkDirectionalParticles={d => d.suspicious ? 5 : 0}
            linkDirectionalParticleWidth={3}
            linkDirectionalParticleSpeed={0.012}
            linkDirectionalParticleColor={() => '#00F0FF'}

            // Node Canvas custom drawing
            nodeCanvasObject={(node, ctx, globalScale) => {
              const config = getRiskProperties(node.risk_score);
              const isCenter = node.is_center;
              const isShell = node.account_type === 'shell';
              
              // Scale size with risk
              const radius = 5 + (node.risk_score / 20); 
              
              ctx.save();
              
              // 1. Draw glowing accent ring for center node
              if (isCenter) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI, false);
                ctx.strokeStyle = '#00F0FF';
                ctx.lineWidth = 1.5;
                ctx.stroke();
              }

              // 2. Draw Node Body shape (shell = square, others = circle)
              ctx.beginPath();
              if (isShell) {
                // Square
                const size = radius * 2;
                ctx.rect(node.x - radius, node.y - radius, size, size);
              } else {
                // Circle
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
              }
              ctx.fillStyle = config.hex;
              ctx.fill();
              
              // Light outline
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 0.5;
              ctx.stroke();

              // 3. Draw Labels (only visible when zoomed in)
              if (globalScale > 0.8) {
                const label = node.label || node.id;
                ctx.font = `${8 / globalScale}px 'JetBrains Mono', monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                
                // Draw label background for readability
                ctx.fillStyle = 'rgba(11, 14, 20, 0.8)';
                const textWidth = ctx.measureText(label).width;
                ctx.fillRect(node.x - textWidth / 2 - 2, node.y + radius + 2, textWidth + 4, 9 / globalScale);
                
                // Draw label text
                ctx.fillStyle = '#C9D1D9';
                ctx.fillText(label, node.x, node.y + radius + 3);
              }

              ctx.restore();
            }}

            // Node Interactions
            onNodeClick={node => setSelectedAccountId(node.id)}
            onNodeRightClick={node => navigate(`/account/${node.id}`)}
            onNodeDragEnd={node => {
              // lock node position on drag
              node.fx = node.x;
              node.fy = node.y;
            }}
            cooldownTicks={100}
          />
        ) : (
          !loading && (
            <div className="h-full flex items-center justify-center flex-col gap-4 text-center">
              <svg className="w-12 h-12 text-aura-textMuted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <div>
                <h3 className="font-bold text-white text-lg">No Money Trail Loaded</h3>
                <p className="text-sm text-aura-textMuted max-w-sm mt-1">
                  Load a target node from the Dashboard, or select a transaction loop in the Alerts Feed.
                </p>
              </div>
            </div>
          )
        )}
      </div>

      {/* Slide-over panel */}
      {selectedAccountId && (
        <AccountSlideOver 
          accountId={selectedAccountId} 
          onClose={() => setSelectedAccountId(null)} 
        />
      )}
    </div>
  );
}
