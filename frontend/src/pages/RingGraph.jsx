import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { getGraphByAlert, getAlert, getAccount } from '../api';
import RiskBadge from '../components/RiskBadge';
import { useToast } from '../components/Toast';

const riskColor = (level) => {
  switch (level?.toLowerCase()) {
    case 'critical': return '#E24B4A';
    case 'high': return '#F0883E';
    case 'medium': return '#D29922';
    case 'low': return '#3FB950';
    default: return '#3FB950';
  }
};

export default function RingGraph() {
  const { alertId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  
  const fgRef = useRef();
  const containerRef = useRef(null);

  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [alertInfo, setAlertInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMounted, setIsMounted] = useState(false);

  // Selected Account state for slide-over panel
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Container dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Replay animation states
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayLinks, setReplayLinks] = useState([]);
  const [allLinks, setAllLinks] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });

      const handleResize = () => {
        if (containerRef.current) {
          setDimensions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight
          });
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  const loadRingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [graphRes, alertRes] = await Promise.all([
        getGraphByAlert(alertId),
        getAlert(alertId)
      ]);

      const sortedEdges = [...(graphRes.edges || [])].sort((a, b) => b.txn_count - a.txn_count);
      setAllLinks(sortedEdges);

      setGraphData({
        nodes: graphRes.nodes || [],
        links: sortedEdges
      });
      setAlertInfo(alertRes);

      const amount = alertRes?.amount_involved || 0;
      const formattedAmount = (amount / 100000).toFixed(2) + 'L';
      showToast(`Ring loaded — ₹${formattedAmount} involved`, "success");
    } catch (err) {
      console.error(err);
      setError('Could not load ring details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsPlaying(false);
    setReplayLinks([]);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    loadRingData();
  }, [alertId]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startReplay = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setReplayLinks([]);
    setIsPlaying(true);

    let currentIndex = allLinks.length - 1;

    intervalRef.current = setInterval(() => {
      if (currentIndex >= 0) {
        const link = allLinks[currentIndex];
        if (link) {
          const cleanLink = {
            ...link,
            source: typeof link.source === 'object' ? link.source.id : link.source,
            target: typeof link.target === 'object' ? link.target.id : link.target
          };
          setReplayLinks((prev) => [...prev, cleanLink]);
        }
        currentIndex--;
      } else {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsPlaying(false);

        const amount = alertInfo?.amount_involved || 0;
        const formattedAmount = (amount / 100000).toFixed(2) + 'L';
        const numAccounts = alertInfo?.account_ids?.length || 0;
        showToast(`Ring complete — ₹${formattedAmount} cycled through ${numAccounts} accounts`, "success");
      }
    }, 600);
  };

  const stopReplay = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setReplayLinks(allLinks);
    setIsPlaying(false);
  };

  const handleNodeClick = async (node) => {
    try {
      const data = await getAccount(node.id);
      setSelectedAccount(data);
      setIsPanelOpen(true);
    } catch (err) {
      console.error("Failed to load account details", err);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className={`transition-opacity duration-100 ease-in-out ${isMounted ? 'opacity-100' : 'opacity-0'} flex-1 w-full h-full min-h-[90vh] relative bg-aura-bg select-none`}
    >
      {/* Replay Controls - Floating top-right */}
      {!loading && !error && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={isPlaying ? stopReplay : startReplay}
            className="px-4 py-2 font-mono text-xs font-bold border border-aura-border bg-black/60 hover:bg-black/85 text-white rounded-full transition-all flex items-center gap-2 cursor-pointer"
          >
            {isPlaying ? (
              <>
                <span className="text-[#E24B4A]">⏹</span> Stop
              </>
            ) : (
              <>
                <span className="text-[#00E5FF]">▶</span> Replay ring
              </>
            )}
          </button>
        </div>
      )}

      {/* Back button and Info Banner */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 max-w-xl">
        <button
          onClick={() => navigate('/alerts')}
          className="px-3 py-1.5 font-mono text-xs border border-aura-border bg-black/60 text-white hover:bg-black/80 rounded transition-all w-fit"
        >
          ← Back to alerts
        </button>

        {alertInfo && (
          <>
            <div className="bg-[#FAEEDA] border border-[#F0883E]/30 text-[#854F0B] p-4 font-mono shadow-lg space-y-2 rounded">
              <span className="text-[10px] font-bold block uppercase">[ALERT_LOCK: {alertId}]</span>
              <h2 className="text-sm font-bold text-black">{alertInfo.title}</h2>
              <p className="text-xs">{alertInfo.summary}</p>
            </div>
            {alertInfo.narrative && (
              <p className="text-xs text-aura-textMuted italic pl-1">
                {alertInfo.narrative}
              </p>
            )}
          </>
        )}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-aura-bg/85 gap-3">
          <svg className="animate-spin h-6 w-6 text-aura-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs font-mono text-aura-textMuted uppercase tracking-widest">Loading ring...</span>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-aura-bg/95 p-4">
          <span className="text-red-400 font-mono text-sm uppercase tracking-wider">{error}</span>
        </div>
      )}

      {/* Graph Canvas */}
      {!loading && graphData.nodes.length > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={{
            nodes: graphData.nodes.map(n => ({ ...n })),
            links: (isPlaying ? replayLinks : allLinks)
              .filter(Boolean)
              .map(l => ({
                ...l,
                source: typeof l.source === 'object' ? l.source.id : l.source,
                target: typeof l.target === 'object' ? l.target.id : l.target
              }))
          }}
          backgroundColor="transparent"
          nodeId="id"
          nodeLabel="label"
          nodeColor={node => riskColor(node.risk_level)}
          nodeVal={node => Math.max(4, node.risk_score / 10)}
          linkSource="source"
          linkTarget="target"
          linkColor={link => link.suspicious ? '#E24B4A' : '#555'}
          linkWidth={link => Math.max(1, Math.log10((link.amount || 1) + 1))}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={1}
          linkDirectionalParticles={link => link.suspicious ? 4 : 0}
          linkDirectionalParticleColor={() => '#E24B4A'}
          linkDirectionalParticleSpeed={0.004}
          linkDirectionalParticleWidth={2}
          onNodeClick={handleNodeClick}
          cooldownTicks={100}
        />
      )}

      {/* Slide-over panel */}
      <div 
        className={`fixed right-0 top-0 h-full w-80 bg-aura-panel/95 border-l border-aura-border shadow-2xl z-40 transform transition-transform duration-250 ease-out p-6 flex flex-col justify-between ${
          isPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selectedAccount && (
          <>
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-aura-border pb-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider truncate">
                    {selectedAccount.name || selectedAccount.account_id}
                  </h3>
                  <span className="text-[10px] text-aura-textMuted font-mono block truncate">
                    {selectedAccount.account_id}
                  </span>
                </div>
                <button 
                  onClick={() => setIsPanelOpen(false)}
                  className="text-aura-textMuted hover:text-white font-mono text-sm leading-none"
                >
                  ✕
                </button>
              </div>

              {/* Account Type and Risk Badge */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 border border-aura-border bg-black/40 text-aura-textMuted uppercase">
                  {selectedAccount.account_type}
                </span>
                <RiskBadge score={selectedAccount.risk_score} showScore={false} />
              </div>

              {/* Risk Score */}
              <div className="space-y-1">
                <span className="text-[10px] text-aura-textMuted font-mono block">RISK_SCORE</span>
                <span className={`text-4xl font-bold font-mono ${
                  selectedAccount.risk_score >= 90 ? 'text-[#E24B4A]' : selectedAccount.risk_score >= 70 ? 'text-[#F0883E]' : selectedAccount.risk_score >= 40 ? 'text-[#D29922]' : 'text-[#3FB950]'
                }`}>
                  {selectedAccount.risk_score}%
                </span>
              </div>

              {/* Flags */}
              {selectedAccount.flags && selectedAccount.flags.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] text-aura-textMuted font-mono block">THREAT_FLAGS</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedAccount.flags.map(flag => (
                      <span 
                        key={flag} 
                        className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#E24B4A]/10 border border-[#E24B4A]/30 text-[#E24B4A] uppercase"
                      >
                        {flag.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial Telemetry */}
              <div className="space-y-3 pt-2">
                <span className="text-[10px] text-aura-textMuted font-mono block border-b border-aura-border/40 pb-1">FINANCIAL_TELEMETRY</span>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-[9px] text-aura-textMuted block">TOTAL_IN</span>
                    <span className="text-white block mt-0.5">₹{selectedAccount.total_in?.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-aura-textMuted block">TOTAL_OUT</span>
                    <span className="text-white block mt-0.5">₹{selectedAccount.total_out?.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-aura-textMuted block">TRANS_COUNT</span>
                    <span className="text-white block mt-0.5">{selectedAccount.txn_count}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* View Full Profile */}
            <div className="pt-6">
              <button
                onClick={() => navigate(`/account/${selectedAccount.account_id}`)}
                className="w-full py-2 bg-white text-black font-mono text-xs font-bold hover:bg-white/80 active:scale-95 transition-all text-center"
              >
                View full profile →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
