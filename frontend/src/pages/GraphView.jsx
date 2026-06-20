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
  
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  
  const [isReplaying, setIsReplaying] = useState(false);
  const [allEdges, setAllEdges] = useState([]);
  const [visibleEdges, setVisibleEdges] = useState([]);
  const replayTimerRef = useRef(null);

  const loadGraph = async () => {
    try {
      setLoading(true);
      setError(null);
      
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
      
      if (!accountId && !alertId) {
        params.accountId = 'acc_0042';
      }

      const res = await api.getGraph(params);
      
      const nodes = res.nodes || [];
      const edges = (res.edges || []).map(edge => ({
        ...edge,
        source: typeof edge.source === 'object' ? edge.source.id : edge.source,
        target: typeof edge.target === 'object' ? edge.target.id : edge.target
      }));

      const sortedEdges = [...edges].sort((a, b) => new Date(a.last_timestamp) - new Date(b.last_timestamp));
      
      setGraphData({ nodes, links: edges });
      setAllEdges(sortedEdges);
      setVisibleEdges(edges);
      
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

  const handleNodeDoubleClick = async (node) => {
    try {
      setLoading(true);
      const res = await api.getGraph({ accountId: node.id, depth: 2 });
      
      const existingNodeIds = new Set(graphData.nodes.map(n => n.id));
      const newNodes = [...graphData.nodes];
      res.nodes.forEach(n => {
        if (!existingNodeIds.has(n.id)) {
          newNodes.push(n);
        }
      });

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

  const startReplay = () => {
    if (allEdges.length === 0) return;
    
    setIsReplaying(true);
    setVisibleEdges([]);
    
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
    }, 1200);
  };

  const stopReplay = () => {
    if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    setIsReplaying(false);
    setVisibleEdges(allEdges);
  };

  const handleResetZoom = () => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 50);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen relative bg-aura-bg select-none text-aura-textLight font-mono">
      {/* Legend & Controls Toolbar */}
      <div className="absolute top-4 left-4 z-10 hud-panel p-4 rounded-none flex flex-col gap-3 max-w-xs sm:max-w-sm pointer-events-auto">
        <span className="hud-corner-tl">[TELEMETRY_LEGEND]</span>
        <div className="flex items-center justify-between border-b border-aura-border pb-2 mt-1">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-white">Visual Map Legend</h3>
          <button 
            onClick={handleResetZoom}
            className="text-[8px] text-aura-accent hover:underline font-mono"
          >
            RESET_CAMERA
          </button>
        </div>
        
        {/* Risk levels */}
        <div className="space-y-1.5 text-[10px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-aura-critical rounded-none" />
            <span>CRITICAL RISK (&ge;90)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-aura-high rounded-none" />
            <span>HIGH RISK (70-89)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-aura-medium rounded-none" />
            <span>MEDIUM RISK (40-69)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-aura-low rounded-none" />
            <span>LOW RISK (&lt;40)</span>
          </div>
        </div>

        {/* Account Types */}
        <div className="border-t border-aura-border/40 pt-2 space-y-1.5 text-[10px]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 border border-white bg-aura-panel" />
            <span>SHELL TARGET (SQUARE)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border border-white bg-aura-panel" />
            <span>STANDARD NODE (CIRCLE)</span>
          </div>
        </div>

        {/* Edge Styles */}
        <div className="border-t border-aura-border/40 pt-2 space-y-1.5 text-[10px]">
          <div className="flex items-center gap-2">
            <span className="w-5 h-[2px] bg-aura-critical" />
            <span className="text-aura-critical font-bold">SUSPICIOUS VECTOR</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-[2px] bg-aura-border" />
            <span>VERIFIED ROUTE</span>
          </div>
        </div>

        {/* Replay controller */}
        <div className="border-t border-aura-border/40 pt-3 flex items-center justify-between gap-3 text-[10px]">
          <span>VECTOR_REPLAY</span>
          <div className="flex items-center gap-2">
            {isReplaying ? (
              <button 
                onClick={stopReplay}
                className="px-2 py-0.5 text-[9px] font-bold bg-aura-critical/20 border border-aura-critical/40 text-aura-critical hover:bg-aura-critical/30 transition-all"
              >
                ABORT_TRACE
              </button>
            ) : (
              <button 
                onClick={startReplay}
                disabled={allEdges.length === 0}
                className="px-2 py-0.5 text-[9px] font-bold bg-aura-accent/20 border border-aura-accent/40 text-aura-accent hover:bg-aura-accent/30 transition-all disabled:opacity-50"
              >
                RUN_TRACE
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating HUD alert notice */}
      {alertId && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 hud-panel px-6 py-2.5 border-aura-critical/40 flex items-center gap-4 max-w-2xl text-center">
          <span className="hud-corner-tl" style={{ color: '#FF3B30' }}>[ALERT_LOCK]</span>
          <div className="w-1.5 h-1.5 bg-aura-critical animate-ping" />
          <div className="text-left font-mono mt-1">
            <span className="text-[10px] font-bold text-aura-critical block">TARGETED_THREAT_CYCLE: {alertId}</span>
            <span className="text-[9px] text-aura-textMuted block">Click target nodes to trace counterparties. Active vectors showing flow arrows.</span>
          </div>
        </div>
      )}

      {/* Error/Loading */}
      {error && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-10 p-2 border border-aura-critical/30 bg-aura-critical/10 text-aura-critical text-[10px] font-mono">
          &gt; ERROR: {error}
        </div>
      )}

      {loading && (
        <div className="absolute bottom-4 left-4 z-10 hud-panel px-4 py-1.5 flex items-center gap-2.5">
          <span className="hud-corner-tl">[ONTOLOGY_UPDATE]</span>
          <svg className="animate-spin h-3.5 w-3.5 text-aura-accent mt-1" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-[9px] font-mono mt-1">TRAVERSING DIRECTORY...</span>
        </div>
      )}

      {/* Graph Workspace Canvas */}
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
            
            // Vector style width
            linkWidth={d => Math.max(0.8, Math.min(4, Math.log10(d.amount / 1000)))}
            linkColor={d => d.suspicious ? '#FF3B30' : '#1F2836'}
            linkDirectionalArrowLength={5}
            linkDirectionalArrowRelPos={1}
            
            // Suspect flows animate scanning particles
            linkDirectionalParticles={d => d.suspicious ? 5 : 0}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={0.015}
            linkDirectionalParticleColor={() => '#00E5FF'}

            // Canvas drawing overlay (Target crosshairs, custom fonts/shapes)
            nodeCanvasObject={(node, ctx, globalScale) => {
              const config = getRiskProperties(node.risk_score);
              const isCenter = node.is_center;
              const isShell = node.account_type === 'shell';
              
              const radius = 5 + (node.risk_score / 20); 
              
              ctx.save();
              
              // 1. Draw glowing accent ring for center node (Palantir Target Lock)
              if (isCenter) {
                // outer ring
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI, false);
                ctx.strokeStyle = '#00E5FF';
                ctx.lineWidth = 1;
                ctx.stroke();

                // targeted crosshairs
                ctx.strokeStyle = '#00E5FF';
                ctx.lineWidth = 0.8;
                
                // Horizontal crosshairs
                ctx.beginPath();
                ctx.moveTo(node.x - radius - 8, node.y);
                ctx.lineTo(node.x - radius - 2, node.y);
                ctx.moveTo(node.x + radius + 2, node.y);
                ctx.lineTo(node.x + radius + 8, node.y);
                
                // Vertical crosshairs
                ctx.moveTo(node.x, node.y - radius - 8);
                ctx.lineTo(node.x, node.y - radius - 2);
                ctx.moveTo(node.x, node.y + radius + 2);
                ctx.lineTo(node.x, node.y + radius + 8);
                ctx.stroke();
              }

              // 2. Draw Node Body shape (shell = square, others = circle)
              ctx.beginPath();
              if (isShell) {
                const size = radius * 1.8;
                ctx.rect(node.x - size / 2, node.y - size / 2, size, size);
              } else {
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
              }
              ctx.fillStyle = config.hex;
              ctx.fill();
              
              // black boundary outline
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 1.2;
              ctx.stroke();
              
              // thin neon border
              ctx.strokeStyle = config.hex;
              ctx.lineWidth = 0.5;
              ctx.stroke();

              // 3. Draw Labels (only visible when zoomed in)
              if (globalScale > 0.8) {
                const label = node.label || node.id;
                ctx.font = `${7 / globalScale}px 'JetBrains Mono', monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                
                // Draw label background for readability
                ctx.fillStyle = 'rgba(11, 14, 20, 0.85)';
                const textWidth = ctx.measureText(label).width;
                ctx.fillRect(node.x - textWidth / 2 - 2, node.y + radius + 3, textWidth + 4, 8 / globalScale);
                
                // Draw label text
                ctx.fillStyle = '#B9C6D6';
                ctx.fillText(label, node.x, node.y + radius + 4);
              }

              ctx.restore();
            }}

            onNodeClick={node => setSelectedAccountId(node.id)}
            onNodeRightClick={node => navigate(`/account/${node.id}`)}
            onNodeDragEnd={node => {
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
                <h3 className="font-bold text-white text-lg">No Target Map Active</h3>
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
