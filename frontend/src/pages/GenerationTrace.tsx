import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  GitCommit,
  Compass,
  Layers,
  Sparkles,
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Play,
  RotateCcw,
  Search,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  Eye,
  Activity,
  Terminal,
  FileCode,
  ArrowRight,
  Filter,
  Check,
  Pause,
  HelpCircle,
  Maximize2
} from 'lucide-react';
import {
  fetchRuns,
  fetchRunGenerationTrace,
  fetchRunEvents,
  createRunEventSource,
  RunSummary,
  RunEvent,
  GenerationTraceData,
  CuriosityOpportunity
} from '../api/client';

export const GenerationTrace: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>(searchParams.get('run_id') || '');
  const [traceData, setTraceData] = useState<GenerationTraceData | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Filters & Selected states
  const [activeTab, setActiveTab] = useState<'pipeline' | 'properties' | 'curiosity' | 'agents' | 'provenance' | 'events'>('pipeline');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<'all' | 'pages' | 'controls' | 'forms' | 'signals' | 'evidence'>('all');
  const [propertySearch, setPropertySearch] = useState('');
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<string | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [selectedPropertyObsId, setSelectedPropertyObsId] = useState<string | null>(null);

  // Initial runs fetch
  useEffect(() => {
    fetchRuns().then(data => {
      setRuns(data);
      if (!selectedRunId && data.length > 0) {
        setSelectedRunId(data[0].id);
      }
    }).catch(console.error);
  }, []);

  // Fetch Trace & Connect Live Event Stream
  useEffect(() => {
    if (!selectedRunId) return;
    let isMounted = true;
    setLoading(true);

    const loadTrace = () => {
      fetchRunGenerationTrace(selectedRunId)
        .then(data => {
          if (!isMounted) return;
          setTraceData(data);
          if (data.test_cases.length > 0 && !selectedTestCaseId) {
            setSelectedTestCaseId(data.test_cases[0].id);
          }
          if (data.curiosity_opportunities.length > 0 && !selectedOpportunityId) {
            setSelectedOpportunityId(data.curiosity_opportunities[0].opportunity_id);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          if (isMounted) setLoading(false);
        });
    };

    loadTrace();

    fetchRunEvents(selectedRunId)
      .then(evs => {
        if (isMounted) setEvents(evs);
      })
      .catch(console.error);

    // Live Server-Sent Events stream
    const unsubscribeSSE = createRunEventSource(
      selectedRunId,
      (newEvent) => {
        if (!isMounted) return;
        setEvents(prev => {
          if (prev.some(e => e.id === newEvent.id)) return prev;
          return [...prev, newEvent];
        });
        // On significant stage transitions, reload trace snapshot
        if (['PAGES_EXPLORED', 'OPPORTUNITIES_IDENTIFIED', 'TEST_PLAN_APPROVED', 'TEST_PASSED', 'TEST_FAILED', 'BUG_VERIFIED'].includes(newEvent.event_type)) {
          loadTrace();
        }
      },
      (_status) => {
        if (isMounted) loadTrace();
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
    setSelectedTestCaseId(null);
    setSelectedOpportunityId(null);
  };

  const selectedRun = runs.find(r => r.id === selectedRunId);
  const selectedTestCase = traceData?.test_cases.find(t => t.id === selectedTestCaseId);
  const selectedOpportunity = traceData?.curiosity_opportunities.find(o => o.opportunity_id === selectedOpportunityId);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    if (eventFilter === 'all') return events;
    if (eventFilter === 'errors') return events.filter(e => e.stage === 'failed' || e.event_type.includes('ERROR') || e.event_type.includes('FAIL'));
    if (eventFilter === 'scout') return events.filter(e => e.agent_role === 'scout' || e.stage === 'explore');
    if (eventFilter === 'curiosity') return events.filter(e => e.agent_role === 'curiosity' || e.event_type.includes('OPPORTUNIT'));
    if (eventFilter === 'tester') return events.filter(e => e.agent_role === 'tester' || e.stage === 'execute');
    if (eventFilter === 'verifier') return events.filter(e => e.agent_role === 'verifier' || e.stage === 'verify');
    return events;
  }, [events, eventFilter]);

  // Stage indicator badge helper
  const renderStagePill = (label: string, stageKey: keyof GenerationTraceData['stages'], stageLetter: string) => {
    const status = traceData ? traceData.stages[stageKey] : 'Pending';
    let bg = 'bg-gray-100 text-gray-500 border-gray-200';
    let icon = <Clock className="w-3.5 h-3.5 text-gray-400" />;

    if (status === 'Completed') {
      bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    } else if (status === 'Running') {
      bg = 'bg-violet-50 text-violet-700 border-violet-300 animate-pulse';
      icon = <Activity className="w-3.5 h-3.5 text-violet-600 animate-spin" />;
    } else if (status === 'Failed') {
      bg = 'bg-red-50 text-red-700 border-red-200';
      icon = <XCircle className="w-3.5 h-3.5 text-red-600" />;
    }

    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${bg}`}>
        <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center font-bold text-[10px] shadow-2xs">
          {stageLetter}
        </span>
        <div className="flex flex-col">
          <span className="font-semibold">{label}</span>
          <span className="text-[10px] capitalize opacity-85">{status}</span>
        </div>
        <div className="ml-auto">{icon}</div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner & Run Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F0EFFF] flex items-center justify-center text-[#635BFF] border border-[#635BFF]/20 shadow-2xs">
              <GitCommit className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                Live Generation Trace
                <span className="text-[10px] font-semibold bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full border border-violet-200">
                  Explainable AI QA
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                See how live website observations become verified executable test cases.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="trace-run-select" className="text-xs font-semibold text-gray-600">Select Test Run:</label>
          <select
            id="trace-run-select"
            value={selectedRunId}
            onChange={e => handleSelectRun(e.target.value)}
            className="text-xs font-mono border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
          >
            {runs.map(r => (
              <option key={r.id} value={r.id}>
                {r.id.substring(0, 8)} ({r.status.toUpperCase()}) — {r.target_url}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Target Run Meta Summary */}
      {traceData && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white border border-gray-200 rounded-xl p-4 text-xs shadow-xs">
          <div>
            <span className="text-gray-400 font-medium">Target URL:</span>
            <div className="font-mono text-gray-900 font-semibold truncate mt-0.5" title={traceData.target_url}>
              {traceData.target_url}
            </div>
          </div>
          <div>
            <span className="text-gray-400 font-medium">Run Status:</span>
            <div className="flex items-center gap-1.5 mt-0.5 font-bold capitalize text-gray-800">
              <span className={`w-2 h-2 rounded-full ${traceData.status === 'completed' ? 'bg-emerald-500' : 'bg-violet-500 animate-pulse'}`} />
              {traceData.status}
            </div>
          </div>
          <div>
            <span className="text-gray-400 font-medium">Pages Discovered:</span>
            <div className="font-semibold text-gray-900 mt-0.5">
              {traceData.pages_explored.length} page states
            </div>
          </div>
          <div>
            <span className="text-gray-400 font-medium">Curiosity Opportunities:</span>
            <div className="font-semibold text-[#635BFF] mt-0.5">
              {traceData.curiosity_opportunities.length} prioritized
            </div>
          </div>
          <div>
            <span className="text-gray-400 font-medium">Generated Tests:</span>
            <div className="font-semibold text-gray-900 mt-0.5">
              {traceData.test_cases.length} cases ({traceData.passed_count} passed, {traceData.failed_count} failed)
            </div>
          </div>
        </div>
      )}

      {/* 7-Stage Chronological Pipeline Overview */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#635BFF]" />
            Autonomous QA Generation & Execution Pipeline
          </div>
          <span className="text-[11px] text-gray-500">Real-time status of all 7 generation stages</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {renderStagePill("Exploration", "exploration", "A")}
          {renderStagePill("Properties", "properties", "B")}
          {renderStagePill("Curiosity", "curiosity", "C")}
          {renderStagePill("Test Design", "generation", "D")}
          {renderStagePill("Validation", "validation", "E")}
          {renderStagePill("Execution", "execution", "F")}
          {renderStagePill("Verification", "verification", "G")}
        </div>
      </div>

      {/* Navigation Tabs for Feature Sections */}
      <div className="border-b border-gray-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'pipeline', label: 'Generation Timeline', icon: Clock },
            { id: 'properties', label: `Captured Properties (${traceData?.captured_properties?.interactive_elements?.length || 0})`, icon: Layers },
            { id: 'curiosity', label: `Curiosity Engine (${traceData?.curiosity_opportunities?.length || 0})`, icon: Sparkles },
            { id: 'provenance', label: `Generated Tests & Provenance (${traceData?.test_cases?.length || 0})`, icon: ShieldCheck },
            { id: 'agents', label: 'Agent Handshake & LLM Roles', icon: Cpu },
            { id: 'events', label: `Live Event Stream (${events.length})`, icon: Terminal },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#635BFF] text-[#635BFF]'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-medium ${
              autoScroll ? 'bg-violet-50 text-[#635BFF] border-violet-200' : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}
          >
            {autoScroll ? <Activity className="w-3 h-3 animate-spin text-[#635BFF]" /> : <Pause className="w-3 h-3 text-gray-500" />}
            Auto-follow {autoScroll ? 'ON' : 'PAUSED'}
          </button>
        </div>
      </div>

      {/* TAB 1: GENERATION TIMELINE & STAGE DETAIL */}
      {activeTab === 'pipeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Live Flow Steps */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Compass className="w-4 h-4 text-[#635BFF]" />
                Live Exploration & Generation Feed
              </h3>

              <div className="relative border-l-2 border-gray-200 pl-4 space-y-4 ml-2">
                {events.length === 0 ? (
                  <div className="text-xs text-gray-400 py-4">No execution events recorded yet.</div>
                ) : (
                  events.slice(-15).map((ev, idx) => (
                    <div key={ev.id || idx} className="relative group">
                      <div className={`absolute -left-[23px] top-1.5 w-3 h-3 rounded-full border-2 bg-white ${
                        ev.stage === 'failed' ? 'border-red-500 bg-red-100' : 'border-[#635BFF] bg-violet-100'
                      }`} />
                      <div className="bg-gray-50 hover:bg-violet-50/40 border border-gray-200 rounded-lg p-3 transition-colors">
                        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                          <span className="font-mono text-gray-400">
                            {new Date(ev.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="uppercase text-[9px] font-bold px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-600">
                            {ev.agent_role.toUpperCase()} • {ev.stage.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-gray-800">{ev.message}</div>
                        {ev.details && Object.keys(ev.details).length > 0 && (
                          <div className="mt-2 text-[11px] font-mono bg-white p-2 rounded border border-gray-200 text-gray-700 overflow-x-auto max-h-24">
                            {JSON.stringify(ev.details, null, 2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Col: Interactive Visual Inspector */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-[#635BFF]" />
                Explored Page States
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Pages and route surfaces explored by the Scout Agent during this run.
              </p>

              <div className="space-y-2">
                {traceData?.pages_explored.map((p, idx) => (
                  <div key={p.id || idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-violet-300 transition-colors">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-900">
                      <span className="truncate max-w-[200px]" title={p.url}>{p.url}</span>
                      <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-mono">
                        depth {p.depth}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 flex items-center justify-between">
                      <span>{p.controls_count} interactive controls</span>
                      <span>{p.links.length} links</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seeded Defect Demonstration Checklist */}
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 shadow-xs text-xs">
              <h4 className="font-bold text-emerald-900 flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Live Judge Demonstration Guide
              </h4>
              <p className="text-emerald-800 text-[11px] leading-relaxed">
                Click any generated test case in the <strong>Generated Tests & Provenance</strong> tab to reveal the full audit trail:
              </p>
              <ul className="list-disc pl-4 mt-2 space-y-1 text-emerald-900 font-medium text-[11px]">
                <li><strong>What did the browser observe?</strong> (Raw DOM tags, selectors, labels)</li>
                <li><strong>Why did Curiosity pick it?</strong> (Impact, novelty, and uncertainty scores)</li>
                <li><strong>How did agents generate the test?</strong> (Deterministic invariants + LLM)</li>
                <li><strong>What was the execution proof?</strong> (Step-by-step logs, verified screenshots)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CAPTURED PROPERTIES (STAGE B) */}
      {activeTab === 'properties' && traceData && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#635BFF]" />
                  Stage B — Captured Website Properties & Observations
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ground-truth observations extracted directly from live DOM, accessibility tree, and browser runtime.
                </p>
              </div>

              {/* Filter controls */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search controls or selectors..."
                    value={propertySearch}
                    onChange={e => setPropertySearch(e.target.value)}
                    className="text-xs pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                  />
                </div>
                <select
                  value={propertyFilter}
                  onChange={e => setPropertyFilter(e.target.value as any)}
                  className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"
                >
                  <option value="all">All Properties</option>
                  <option value="controls">Buttons & Inputs</option>
                  <option value="pages">Pages ({traceData.captured_properties.pages.length})</option>
                  <option value="signals">Runtime Signals</option>
                  <option value="evidence">Visual Evidence</option>
                </select>
              </div>
            </div>

            {/* Properties Table / Grid */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3">Observation ID</th>
                    <th className="py-2.5 px-3">Property / Element</th>
                    <th className="py-2.5 px-3">Type & Role</th>
                    <th className="py-2.5 px-3">Selector / Locator</th>
                    <th className="py-2.5 px-3">Accessible Label</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {traceData.captured_properties.interactive_elements
                    .filter(c => {
                      if (!propertySearch) return true;
                      const q = propertySearch.toLowerCase();
                      return (
                        (c.text && c.text.toLowerCase().includes(q)) ||
                        (c.selector && c.selector.toLowerCase().includes(q)) ||
                        (c.id && c.id.toLowerCase().includes(q)) ||
                        (c.obs_id && c.obs_id.toLowerCase().includes(q))
                      );
                    })
                    .map((item, idx) => (
                      <tr
                        key={item.obs_id || idx}
                        onClick={() => setSelectedPropertyObsId(item.obs_id)}
                        className={`hover:bg-violet-50/40 cursor-pointer transition-colors ${
                          selectedPropertyObsId === item.obs_id ? 'bg-violet-50 font-medium' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-mono text-[11px] text-[#635BFF]">{item.obs_id || `obs-ctrl-${idx + 1}`}</td>
                        <td className="py-2 px-3 font-medium text-gray-900">{item.text || item.name || item.tag}</td>
                        <td className="py-2 px-3 text-gray-600">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-[10px]">
                            {item.role || item.tag} ({item.type || 'standard'})
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-gray-700 max-w-[200px] truncate" title={item.selector}>
                          {item.selector}
                        </td>
                        <td className="py-2 px-3 text-gray-600 truncate max-w-[150px]">
                          {item.accessible_name || item.label || item.placeholder || <span className="text-gray-400 italic">None</span>}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.enabled !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {item.enabled !== false ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-500 text-[11px]">{item.source || 'DOM Parser'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CURIOSITY ENGINE ANALYSIS (STAGE C) */}
      {activeTab === 'curiosity' && traceData && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[#635BFF]" />
              Stage C — Explainable Curiosity Engine Decision Matrix
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              How the Curiosity Engine scores testing opportunities based on Impact, Uncertainty, Novelty, and Coverage Gaps.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Opportunities List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Identified Opportunities ({traceData.curiosity_opportunities.length})
                </h4>
                {traceData.curiosity_opportunities.map(opp => (
                  <div
                    key={opp.opportunity_id}
                    onClick={() => setSelectedOpportunityId(opp.opportunity_id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedOpportunityId === opp.opportunity_id
                        ? 'border-[#635BFF] bg-violet-50/50 shadow-xs ring-1 ring-[#635BFF]'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-[#635BFF]">{opp.opportunity_id}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {opp.selection_status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-gray-900">{opp.target}</div>
                    <div className="text-[11px] text-gray-500 line-clamp-2 mt-1">{opp.what_noticed}</div>
                  </div>
                ))}
              </div>

              {/* Opportunity Deep Dive Inspector */}
              <div className="lg:col-span-2">
                {selectedOpportunity ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                      <div>
                        <span className="font-mono text-xs font-bold text-[#635BFF]">{selectedOpportunity.opportunity_id}</span>
                        <h4 className="text-sm font-bold text-gray-900 mt-0.5">{selectedOpportunity.target}</h4>
                      </div>
                      <span className="text-xs bg-violet-100 text-[#635BFF] px-2.5 py-1 rounded-lg font-semibold">
                        Page: {selectedOpportunity.page_url}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-white p-3.5 rounded-lg border border-gray-200">
                        <span className="text-[11px] font-bold text-gray-400 uppercase">What was noticed:</span>
                        <p className="text-xs text-gray-800 mt-1">{selectedOpportunity.what_noticed}</p>
                      </div>

                      <div className="bg-white p-3.5 rounded-lg border border-gray-200">
                        <span className="text-[11px] font-bold text-gray-400 uppercase">Testing Hypothesis:</span>
                        <p className="text-xs text-gray-800 mt-1">{selectedOpportunity.hypothesis}</p>
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-lg border border-gray-200">
                      <span className="text-[11px] font-bold text-gray-400 uppercase">Selection Reason:</span>
                      <p className="text-xs text-gray-800 mt-1 font-medium">{selectedOpportunity.selection_reason}</p>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-gray-400 uppercase block mb-1.5">Supporting Observations:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedOpportunity.supporting_observations.map((obs, idx) => (
                          <span key={idx} className="font-mono text-[11px] bg-violet-100/70 text-[#635BFF] px-2 py-0.5 rounded border border-violet-200">
                            {obs}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    Select an opportunity on the left to inspect its detailed hypothesis.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GENERATED TEST CASES & FULL PROVENANCE (STAGE D, E, F, G) */}
      {activeTab === 'provenance' && traceData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Test Cases List (4 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center justify-between">
              <span>Generated Test Cases ({traceData.test_cases.length})</span>
              <span className="text-[11px] text-gray-400 font-normal">Ranked by Curiosity</span>
            </h4>

            {traceData.test_cases.map(tc => {
              const isSelected = selectedTestCaseId === tc.id;
              const isPassed = tc.status === 'Passed';
              const isFailed = tc.status === 'Failed';

              return (
                <div
                  key={tc.id}
                  onClick={() => setSelectedTestCaseId(tc.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#635BFF] bg-violet-50/40 shadow-xs ring-1 ring-[#635BFF]'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-gray-700">{tc.id.substring(tc.id.indexOf('-') + 1)}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono bg-violet-100 text-[#635BFF] px-1.5 py-0.5 rounded font-bold">
                        ★ {tc.priority_score.toFixed(2)}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isPassed ? 'bg-emerald-100 text-emerald-800' : (isFailed ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600')
                      }`}>
                        {tc.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-gray-900 leading-snug">{tc.title}</div>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
                    <span>{tc.steps.length} steps</span>
                    <span>•</span>
                    <span>{tc.assertions.length} assertions</span>
                    <span>•</span>
                    <span className="text-[#635BFF] font-medium">{tc.provenance.validation_status}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Full Provenance & Evidence Explorer (7 cols) */}
          <div className="lg:col-span-7">
            {selectedTestCase ? (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5 shadow-xs">
                {/* Header */}
                <div className="border-b border-gray-200 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#635BFF]">{selectedTestCase.id}</span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      selectedTestCase.status === 'Passed' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedTestCase.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mt-1">{selectedTestCase.title}</h3>
                  <p className="text-xs text-gray-600 mt-1">{selectedTestCase.objective}</p>
                </div>

                {/* Provenance Audit Chain (Judges' Key Deliverable) */}
                <div className="bg-violet-50/50 border border-violet-200 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-violet-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#635BFF]" />
                    Observation → Reasoning → Test Provenance Trail
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-gray-500 min-w-[130px]">1. Origin Route:</span>
                      <span className="font-mono text-gray-800">{selectedTestCase.provenance.source_page}</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="font-bold text-gray-500 min-w-[130px]">2. Supporting Obs:</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedTestCase.provenance.supporting_observations.map((obs, i) => (
                          <span key={i} className="font-mono text-[10px] bg-white text-[#635BFF] px-1.5 py-0.5 rounded border border-violet-200">
                            {obs}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="font-bold text-gray-500 min-w-[130px]">3. Curiosity Rationale:</span>
                      <span className="text-gray-800">{selectedTestCase.curiosity_breakdown?.reasoning || 'Prioritized by Curiosity Engine'}</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="font-bold text-gray-500 min-w-[130px]">4. Generating Agent:</span>
                      <span className="text-gray-800 font-medium">{selectedTestCase.provenance.generating_agent}</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="font-bold text-gray-500 min-w-[130px]">5. Validation Status:</span>
                      <span className="text-emerald-700 font-semibold">{selectedTestCase.provenance.validation_notes}</span>
                    </div>
                  </div>
                </div>

                {/* Ordered Execution Steps */}
                <div>
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-2">Ordered Execution Steps</h4>
                  <div className="space-y-1.5">
                    {selectedTestCase.steps.map((st, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                        <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center font-bold text-[10px] text-gray-600 border border-gray-200">
                          {idx + 1}
                        </span>
                        <span className="font-mono uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-[#635BFF]">
                          {st.action}
                        </span>
                        <span className="text-gray-800 truncate flex-1">{st.description}</span>
                        {st.selector && <span className="font-mono text-[10px] text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200">{st.selector}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step Screenshots & Visual Verification */}
                {selectedTestCase.execution.screenshot_urls.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wide mb-2">Visual Execution Evidence</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedTestCase.execution.screenshot_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block group relative overflow-hidden rounded-lg border border-gray-200">
                          <img src={url} alt={`Execution evidence ${i + 1}`} className="w-full h-32 object-cover object-top group-hover:scale-105 transition-transform" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1">
                            <Maximize2 className="w-3.5 h-3.5" /> View Screenshot
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                Select a test case on the left to inspect its complete provenance audit trail.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: AGENTS HANDSHAKE & LLM ROLES */}
      {activeTab === 'agents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Scout */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 font-bold text-xs">
              01
            </div>
            <h4 className="font-bold text-sm text-gray-900">Scout Agent</h4>
            <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Autonomous Exploration</span>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              Explores application routes via breadth-first traversal in Playwright. Captures DOM elements, forms, accessibility tree, and HTTP navigation edges.
            </p>
          </div>

          {/* Curiosity Engine */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-violet-50 text-[#635BFF] flex items-center justify-center border border-violet-200 font-bold text-xs">
              02
            </div>
            <h4 className="font-bold text-sm text-gray-900">Curiosity Engine</h4>
            <span className="text-[10px] font-semibold bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full">Explainable Prioritization</span>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              Calculates normalized priority scores across Impact, Uncertainty, Novelty, and Coverage Gaps to select high-value testing opportunities.
            </p>
          </div>

          {/* Tester Agent */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 font-bold text-xs">
              03
            </div>
            <h4 className="font-bold text-sm text-gray-900">Tester Agent</h4>
            <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Test Design & Execution</span>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              Synthesizes structured journeys with assertions grounded in discovered selectors. Validates actionable steps before executing in isolated contexts.
            </p>
          </div>

          {/* Verifier Agent */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2 shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 font-bold text-xs">
              04
            </div>
            <h4 className="font-bold text-sm text-gray-900">Verifier Agent</h4>
            <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Root Cause & Evidence</span>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              Replays failing steps in independent clean browser contexts to confirm reproducibility. Computes evidence trust scores and eliminates false alarms.
            </p>
          </div>
        </div>
      )}

      {/* TAB 6: RAW EVENT LOG STREAM */}
      {activeTab === 'events' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#635BFF]" />
              Real-time Server-Sent Events (SSE) Audit Feed
            </h3>
            <select
              value={eventFilter}
              onChange={e => setEventFilter(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"
            >
              <option value="all">All Events ({events.length})</option>
              <option value="scout">Scout Agent</option>
              <option value="curiosity">Curiosity Engine</option>
              <option value="tester">Tester Agent</option>
              <option value="verifier">Verifier Agent</option>
              <option value="errors">Errors / Failures</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto font-mono text-xs">
            {filteredEvents.map(e => (
              <div key={e.id} className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-3">
                <span className="text-gray-400 text-[10px] whitespace-nowrap">{new Date(e.timestamp).toLocaleTimeString()}</span>
                <span className="font-bold text-[#635BFF] text-[10px] uppercase px-1.5 py-0.5 rounded bg-violet-100">{e.agent_role}</span>
                <span className="font-bold text-gray-700 text-[10px]">{e.event_type}</span>
                <span className="text-gray-900 flex-1">{e.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
