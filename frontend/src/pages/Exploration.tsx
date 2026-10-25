import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Compass,
  Layers,
  Network,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  MousePointer,
  RotateCcw
} from 'lucide-react';
import {
  fetchRuns,
  fetchRunSiteMap,
  fetchRunEvents,
  createRunEventSource,
  RunSummary,
  RunEvent
} from '../api/client';

export const Exploration: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>(searchParams.get('run_id') || '');
  
  const [siteMap, setSiteMap] = useState<{ nodes: any[]; edges: any[]; total_nodes: number; total_edges: number } | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  // Load runs list
  useEffect(() => {
    fetchRuns().then(data => {
      setRuns(data);
      if (!selectedRunId && data.length > 0) {
        setSelectedRunId(data[0].id);
      }
    });
  }, []);

  // Connect real-time Server-Sent Events (SSE) stream and initial site map load
  useEffect(() => {
    if (!selectedRunId) return;

    let isMounted = true;

    // Initial fetch of site map and history
    fetchRunSiteMap(selectedRunId)
      .then(mapData => {
        if (!isMounted) return;
        setSiteMap(mapData);
        if (mapData.nodes.length > 0 && !selectedNode) {
          setSelectedNode(mapData.nodes[0]);
        }
      })
      .catch(console.error);

    fetchRunEvents(selectedRunId)
      .then(eventsData => {
        if (!isMounted) return;
        setEvents(eventsData);
      })
      .catch(console.error);

    // Live real-time event streaming via SSE
    const unsubscribeSSE = createRunEventSource(
      selectedRunId,
      (newEvent) => {
        if (!isMounted) return;
        setEvents(prev => {
          if (prev.some(e => e.id === newEvent.id)) return prev;
          return [...prev, newEvent];
        });
        // If new pages discovered or run progresses, refresh site map
        if (newEvent.stage === 'explore' || newEvent.event_type === 'PAGES_EXPLORED') {
          fetchRunSiteMap(selectedRunId).then(mapData => {
            if (isMounted) setSiteMap(mapData);
          });
        }
      },
      (_status) => {
        // Run reached terminal state: final refresh of site map
        if (isMounted) {
          fetchRunSiteMap(selectedRunId).then(setSiteMap);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribeSSE();
    };
  }, [selectedRunId]);

  const handleSelectRun = (id: string) => {
    setSelectedRunId(id);
    setSearchParams({ run_id: id });
    setSelectedNode(null);
  };

  const selectedRun = runs.find(r => r.id === selectedRunId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header and Run Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#171717] flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#635BFF]" />
            Application Exploration & Site Map
          </h2>
          <p className="text-xs text-[#525866] mt-0.5">
            Real-time visual map of pages, DOM controls, and navigation transitions discovered by the Scout Agent.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="run-selector" className="text-xs font-semibold text-[#525866]">Select Run:</label>
          <select
            id="run-selector"
            value={selectedRunId}
            onChange={e => handleSelectRun(e.target.value)}
            className="text-xs font-mono border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white text-[#171717] focus:outline-none focus:ring-1 focus:ring-[#635BFF]"
          >
            {runs.map(r => (
              <option key={r.id} value={r.id}>
                {r.id.substring(0, 8)} ({r.status}) — {r.target_url}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedRun && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[#F0EFFF]/50 border border-[#635BFF]/30 rounded-xl p-4 text-xs">
          <div>
            <span className="text-[#635BFF] font-semibold">Target Origin:</span>
            <div className="font-mono text-[#171717] truncate mt-0.5">{selectedRun.target_url}</div>
          </div>
          <div>
            <span className="text-[#635BFF] font-semibold">Status:</span>
            <div className="font-bold text-[#171717] capitalize mt-0.5">{selectedRun.status}</div>
          </div>
          <div>
            <span className="text-[#635BFF] font-semibold">Pages Discovered:</span>
            <div className="text-[#171717] font-bold mt-0.5">{siteMap?.total_nodes || 0}</div>
          </div>
          <div>
            <span className="text-[#635BFF] font-semibold">Navigation Transitions:</span>
            <div className="text-[#171717] font-bold mt-0.5">{siteMap?.total_edges || 0}</div>
          </div>
        </div>
      )}

      {/* Main Exploration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Discovered Site Map Graph & Nodes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-[#171717] flex items-center gap-2">
                <Network className="w-4 h-4 text-[#635BFF]" />
                Discovered Application Topology
              </h3>
              <span className="text-xs text-[#525866]">Click a page to inspect discovered controls</span>
            </div>

            {(!siteMap || siteMap.nodes.length === 0) ? (
              <div className="p-8 text-center text-sm text-[#525866]">
                {loading ? 'Scout Agent is exploring pages...' : 'No exploration data found for this run.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {siteMap.nodes.map(node => {
                  const isSelected = selectedNode?.id === node.id;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedNode(node)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-[#635BFF] bg-[#F0EFFF]/60 shadow-xs ring-1 ring-[#635BFF]'
                          : 'border-[#E5E7EB] bg-white hover:border-[#635BFF]/40'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {node.status}
                        </span>
                        <span className="text-xs text-[#525866] flex items-center gap-1">
                          <MousePointer className="w-3 h-3 text-[#635BFF]" />
                          {node.controls_count} controls
                        </span>
                      </div>
                      <div className="font-semibold text-sm text-[#171717] mt-2 truncate">
                        {node.label}
                      </div>
                      <div className="font-mono text-[11px] text-[#525866] truncate mt-0.5">
                        {node.url}
                      </div>

                      {node.associated_tests?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[#E5E7EB] text-[11px] text-[#635BFF]">
                          <strong>Targeted by:</strong> {node.associated_tests[0]}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Page Control Inspector */}
          {selectedNode && (
            <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-xs">
              <h4 className="font-semibold text-sm text-[#171717] mb-2 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#635BFF]" />
                Interactive Controls Discovered on: <span className="font-mono text-xs">{selectedNode.url}</span>
              </h4>
              <p className="text-xs text-[#525866] mb-3">
                Accessibility roles, buttons, and form inputs recorded by Scout DOM inspection.
              </p>
              <div className="bg-[#F8F9FB] border border-[#E5E7EB] rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs text-[#171717] space-y-1">
                <div>Route: <code>{selectedNode.url}</code></div>
                <div>Title: <code>{selectedNode.label}</code></div>
                <div>Interactive Controls Count: <code>{selectedNode.controls_count}</code></div>
                {selectedNode.associated_tests && (
                  <div>Associated Test Candidates: <code>{selectedNode.associated_tests.join(', ') || 'None'}</code></div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live Exploration Event Timeline */}
        <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-xs flex flex-col h-[600px]">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] shrink-0">
            <h3 className="font-semibold text-sm text-[#171717] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#635BFF]" />
              Agent Event Stream
            </h3>
            <span className="text-[11px] text-[#525866]">{events.length} events</span>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-3">
            {events.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#525866]">
                No orchestration events recorded yet.
              </div>
            ) : (
              events.map((evt, i) => {
                const isScout = evt.agent_role === 'scout';
                const isTester = evt.agent_role === 'tester';
                const isVerifier = evt.agent_role === 'verifier';
                const isConfirmed = evt.event_type.includes('CONFIRMED');

                return (
                  <div key={evt.id || i} className="text-xs flex gap-2.5 items-start">
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        isConfirmed
                          ? 'bg-rose-500 ring-2 ring-rose-200'
                          : isVerifier
                          ? 'bg-amber-500'
                          : isTester
                          ? 'bg-[#635BFF]'
                          : 'bg-emerald-500'
                      }`}
                    />
                    <div className="flex-1 bg-[#F8F9FB] p-2.5 rounded-lg border border-[#E5E7EB]">
                      <div className="flex items-center justify-between text-[10px] text-[#525866] mb-1">
                        <span className="font-bold uppercase tracking-wider text-[#635BFF]">
                          {evt.agent_role} &bull; {evt.event_type}
                        </span>
                        <span className="font-mono">{evt.timestamp.substring(11, 19)}</span>
                      </div>
                      <div className="text-[#171717] font-medium">{evt.message}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
