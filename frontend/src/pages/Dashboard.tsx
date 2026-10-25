import React, { useEffect, useState, useRef } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import {
  PlayCircle,
  Bug,
  History,
  Compass,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Layers,
  Activity,
  Award,
  Maximize2,
  Minimize2,
  RefreshCw,
  Globe,
  MousePointer,
  Type,
  Lock,
  ExternalLink,
  Sliders,
  Sparkles,
  Terminal,
  Radio,
  Eye,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import {
  fetchRuns,
  fetchBugs,
  fetchRegressionTests,
  fetchRunStepExecutions,
  fetchRunEvents,
  createRun,
  RunSummary,
  BugFinding,
  RegressionTest,
  TestStepExecution,
  RunEvent
} from '../api/client';

interface TargetPreset {
  id: string;
  name: string;
  badge: string;
  url: string;
  desc: string;
  baseline_profile: string;
  objectives: string[];
}

const TARGET_PRESETS: TargetPreset[] = [
  {
    id: 'assesspro',
    name: 'AssessPro Exam Platform',
    badge: '5 Seeded Defects',
    url: 'http://127.0.0.1:5001/assesspro',
    desc: 'Online testing with timer, palette navigation, state persistence, and score calculation',
    baseline_profile: 'assessment',
    objectives: ['Functional testing', 'Form validation', 'Business-rule testing', 'Negative testing']
  },
  {
    id: 'quickbite',
    name: 'QuickBite Food Delivery',
    badge: '5 Seeded Defects',
    url: 'http://127.0.0.1:5001/quickbite',
    desc: 'Multi-step food order flow with cart calculation, coupon, and address validation',
    baseline_profile: 'ecommerce',
    objectives: ['Functional testing', 'Business logic and calculations', 'Form validation and input boundaries', 'Transaction and workflow integrity']
  },
  {
    id: 'devstore',
    name: 'DevStore E-Commerce',
    badge: '5 Seeded Defects',
    url: 'http://127.0.0.1:5001',
    desc: 'E-commerce store with email format validation, cart subtotal, and checkout flow',
    baseline_profile: 'ecommerce',
    objectives: ['Functional testing', 'Form validation', 'Business-rule testing', 'Negative testing']
  }
];

export const Dashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [bugs, setBugs] = useState<BugFinding[]>([]);
  const [regressionTests, setRegressionTests] = useState<RegressionTest[]>([]);
  const [loading, setLoading] = useState(true);

  // Live Browser Session Simulator State
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [stepExecutions, setStepExecutions] = useState<TestStepExecution[]>([]);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [runEvents, setRunEvents] = useState<RunEvent[]>([]);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'annotated' | 'before' | 'after'>('annotated');
  const [isZoomOpen, setIsZoomOpen] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Quick Launcher State
  const [targetUrlInput, setTargetUrlInput] = useState<string>(
    localStorage.getItem('codeapex_active_target_url') || TARGET_PRESETS[0].url
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>(TARGET_PRESETS[0].id);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);

  const filmstripRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // 1. Initial Data Load & Priority Run Selection
  useEffect(() => {
    Promise.all([
      fetchRuns(),
      fetchBugs(),
      fetchRegressionTests()
    ])
      .then(([runsData, bugsData, regData]) => {
        setRuns(runsData);
        setBugs(bugsData);
        setRegressionTests(regData);

        // Priority 1: URL search param ?run_id=... or ?selected=...
        const urlRunId = searchParams.get('run_id') || searchParams.get('selected');
        // Priority 2: Stored active run ID from localStorage (e.g. set by NewRun.tsx)
        const storedRunId = localStorage.getItem('codeapex_active_run_id');

        let targetId = '';
        if (urlRunId && runsData.some(r => r.id === urlRunId)) {
          targetId = urlRunId;
        } else if (storedRunId && runsData.some(r => r.id === storedRunId)) {
          targetId = storedRunId;
        } else {
          // Priority 3: Any run currently active (newest first)
          const active = runsData.find(r => ['running', 'exploring', 'planning', 'executing'].includes(r.status));
          targetId = active ? active.id : (runsData[0]?.id || '');
        }

        setSelectedRunId(targetId);
        if (targetId) {
          localStorage.setItem('codeapex_active_run_id', targetId);
          const matchedRun = runsData.find(r => r.id === targetId);
          if (matchedRun?.target_url) {
            setTargetUrlInput(matchedRun.target_url);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Sync when URL search params change
  useEffect(() => {
    const qRunId = searchParams.get('run_id') || searchParams.get('selected');
    if (qRunId && qRunId !== selectedRunId) {
      setSelectedRunId(qRunId);
      localStorage.setItem('codeapex_active_run_id', qRunId);
      setAutoFollow(true);
      setSelectedStepIndex(0);
    }
  }, [searchParams]);

  // Sync across tabs or when NewRun sets localStorage
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'codeapex_active_run_id' && e.newValue && e.newValue !== selectedRunId) {
        setSelectedRunId(e.newValue);
        setAutoFollow(true);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [selectedRunId]);

  // Current active run object
  const activeRun = runs.find(r => r.id === selectedRunId) || runs[0];
  const isRunActive = activeRun ? ['running', 'exploring', 'planning', 'executing'].includes(activeRun.status) : false;

  // 2. Fetch Steps and Events for Selected Run
  const refreshRunEvidence = (runId: string) => {
    if (!runId) return;
    Promise.all([
      fetchRunStepExecutions(runId),
      fetchRunEvents(runId)
    ])
      .then(([steps, events]) => {
        setStepExecutions(steps);
        setRunEvents(events);
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (!selectedRunId) return;
    refreshRunEvidence(selectedRunId);
  }, [selectedRunId]);

  // 3. Real-Time Polling & SSE Stream for Active Run
  useEffect(() => {
    if (!selectedRunId) return;

    // Polling interval if run is currently active
    let intervalId: any = null;
    if (isRunActive) {
      intervalId = setInterval(() => {
        refreshRunEvidence(selectedRunId);
        fetchRuns().then(latestRuns => {
          setRuns(latestRuns);
        }).catch(console.error);
      }, 1500);
    }

    // Server-Sent Events (SSE) listener
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/v1/runs/${selectedRunId}/events/stream`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.event_type) {
            refreshRunEvidence(selectedRunId);
          }
        } catch (e) {
          // ignore keepalive parse
        }
      };
    } catch (e) {
      // SSE fallback to polling
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (eventSource) eventSource.close();
    };
  }, [selectedRunId, isRunActive]);

  // 4. Auto-Follow: advance to the newest step as it arrives
  useEffect(() => {
    if (autoFollow && stepExecutions.length > 0) {
      setSelectedStepIndex(stepExecutions.length - 1);
      // Auto-scroll filmstrip to the right
      if (filmstripRef.current) {
        filmstripRef.current.scrollTo({
          left: filmstripRef.current.scrollWidth,
          behavior: 'smooth'
        });
      }
    }
  }, [stepExecutions.length, autoFollow]);

  // Current step to display in the live viewport
  const currentStep: TestStepExecution | undefined = stepExecutions[selectedStepIndex] || stepExecutions[stepExecutions.length - 1];

  // Determine current screenshot URL based on viewMode
  const getScreenshotUrl = (step?: TestStepExecution): string | null => {
    if (!step) return null;
    if (viewMode === 'before' && step.screenshot_before_url) return step.screenshot_before_url;
    if (viewMode === 'after' && step.screenshot_after_url) return step.screenshot_after_url;
    // Default to annotated if failure, or after, or before
    return step.screenshot_annotated_url || step.screenshot_failure_url || step.screenshot_after_url || step.screenshot_before_url || null;
  };

  const activeScreenshotUrl = getScreenshotUrl(currentStep);

  // Run Selection Handler
  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
    localStorage.setItem('codeapex_active_run_id', runId);
    setSearchParams({ run_id: runId });
    setAutoFollow(true);
    setSelectedStepIndex(0);

    const matched = runs.find(r => r.id === runId);
    if (matched?.target_url) {
      setTargetUrlInput(matched.target_url);
      localStorage.setItem('codeapex_active_target_url', matched.target_url);
    }
  };

  // Quick Launch Handler for ANY Target URL
  const handleLaunchRun = async () => {
    const trimmedUrl = targetUrlInput.trim();
    if (!trimmedUrl) return;
    setIsLaunching(true);
    setLaunchMessage(`Initializing Playwright session on ${trimmedUrl}...`);

    try {
      const preset = TARGET_PRESETS.find(p => p.url === trimmedUrl);
      const baselineProfile = preset
        ? preset.baseline_profile
        : (trimmedUrl.includes('assess') || trimmedUrl.includes('exam') ? 'assessment' : (trimmedUrl.includes('food') || trimmedUrl.includes('shop') || trimmedUrl.includes('store') ? 'ecommerce' : 'universal'));
      
      const objectives = preset
        ? preset.objectives
        : ['Functional testing', 'Form validation', 'Business-rule testing', 'Negative testing'];

      const res = await createRun({
        target_url: trimmedUrl,
        description: preset ? preset.desc : `Autonomous verification run on ${trimmedUrl}`,
        objectives: objectives,
        baseline_profile: baselineProfile,
        test_mode: 'deep_verification',
        mode: 'demo'
      });

      setLaunchMessage(`Launched Run [${res.run_id}]. Connecting live screenshot stream...`);
      localStorage.setItem('codeapex_active_run_id', res.run_id);
      localStorage.setItem('codeapex_active_target_url', trimmedUrl);
      setSearchParams({ run_id: res.run_id });

      // Refresh runs list and switch to new run immediately
      const updatedRuns = await fetchRuns();
      setRuns(updatedRuns);
      setSelectedRunId(res.run_id);
      setAutoFollow(true);
      setStepExecutions([]);
      setSelectedStepIndex(0);

      setTimeout(() => {
        setLaunchMessage(null);
        setIsLaunching(false);
      }, 2500);
    } catch (err: any) {
      setLaunchMessage(`Failed to launch: ${err?.message || 'Error'}`);
      setIsLaunching(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Metrics KPI calculations
  const totalRuns = runs.length;
  const totalTestsExecuted = runs.reduce((acc, r) => acc + (r.total_tests || 0), 0);
  const totalPassed = runs.reduce((acc, r) => acc + (r.passed_count || 0), 0);
  const totalFailed = runs.reduce((acc, r) => acc + (r.failed_count || 0), 0);
  const totalBlocked = runs.reduce((acc, r) => acc + (r.blocked_count || 0), 0);
  const confirmedBugs = bugs.filter(b => b.status === 'Confirmed' || b.status === 'Verified').length;
  const suspectedBugs = bugs.filter(b => b.status === 'Suspected' || b.status === 'Likely').length;

  const testDistributionData = [
    { name: 'Passed', value: totalPassed || 0, color: '#10b981' },
    { name: 'Failed', value: totalFailed || 0, color: '#ef4444' },
    { name: 'Blocked', value: totalBlocked || 0, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const severityData = [
    { name: 'Critical', count: bugs.filter(b => b.severity === 'Critical').length },
    { name: 'High', count: bugs.filter(b => b.severity === 'High').length },
    { name: 'Medium', count: bugs.filter(b => b.severity === 'Medium').length },
    { name: 'Low', count: bugs.filter(b => b.severity === 'Low').length },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* 1. Welcome Header Banner */}
      <div className="bg-[hsl(var(--primary))] text-white rounded-2xl p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="bg-white/10 text-[hsl(var(--accent))] border border-white/15 text-[11px] px-3 py-1 rounded-full font-medium uppercase tracking-wider inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] animate-pulse" />
            Live Playwright Verification Engine
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-normal mt-3 tracking-tight text-white">
            Operational <span className="italic">Verification</span> Workspace
          </h2>
          <p className="text-white/70 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
            Real-time autonomous browser execution. Watch live screenshots as the AI agent navigates, fills forms, verifies invariant business rules, and highlights visual defects.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 shrink-0">
          <NavLink
            to="/test-cases"
            className="bg-white/10 border border-white/20 text-white font-medium px-4 py-2 rounded-lg text-xs hover:bg-white/20 transition flex items-center gap-1.5"
          >
            <span>All Test Cases</span>
          </NavLink>
          <NavLink
            to="/benchmark"
            className="bg-white/10 border border-white/20 text-white font-medium px-4 py-2 rounded-lg text-xs hover:bg-white/20 transition flex items-center gap-1.5"
          >
            <Award className="w-3.5 h-3.5 text-[hsl(var(--accent))]" />
            <span>Benchmarks</span>
          </NavLink>
          <NavLink
            to="/new-run"
            className="bg-[hsl(var(--accent))] text-white font-medium px-4 py-2 rounded-lg text-xs hover:bg-[hsl(var(--accent))]/90 transition shadow-xs flex items-center gap-1.5"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Advanced Config</span>
          </NavLink>
        </div>
      </div>

      {/* 2. LIVE BROWSER EXECUTION CONSOLE (High-Prominence Developer Centerpiece) */}
      <div className="bg-white rounded-2xl border border-[hsl(var(--border))] shadow-md overflow-hidden">
        {/* Top Console Bar: Target Selector & Quick Launcher */}
        <div className="bg-slate-900 text-white px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${isRunActive ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`} />
              <span className={`w-3 h-3 rounded-full ${isRunActive ? 'bg-rose-500' : 'bg-emerald-500'} -ml-5`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-wide text-white">
                  {isRunActive ? '🔴 LIVE PLAYWRIGHT EXECUTION STREAM' : '🟢 INTERACTIVE TEST REPLAY & EVIDENCE'}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                  {activeRun?.id || 'No Run'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Targeting: <span className="font-mono text-emerald-400">{activeRun?.target_url || targetUrlInput}</span>
              </p>
            </div>
          </div>

          {/* Quick Target Launch Strip for ANY URL */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Presets shortcut pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-[11px] text-slate-400 mr-1 hidden md:inline">Presets:</span>
              {TARGET_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedPresetId(preset.id);
                    setTargetUrlInput(preset.url);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 shrink-0 ${
                    targetUrlInput === preset.url
                      ? 'bg-emerald-500 text-white font-semibold shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  <span>{preset.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>

            {/* Custom URL Input & Run Button */}
            <div className="flex items-center gap-2">
              <div className="flex-1 sm:w-64 bg-slate-800 rounded-lg border border-slate-700 px-2.5 py-1 flex items-center gap-1.5 focus-within:border-emerald-500">
                <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <input
                  type="text"
                  value={targetUrlInput}
                  onChange={(e) => setTargetUrlInput(e.target.value)}
                  placeholder="Paste any target URL (http://...)"
                  className="bg-transparent text-xs text-white placeholder-slate-400 font-mono w-full focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleLaunchRun}
                disabled={isLaunching || !targetUrlInput.trim()}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 shrink-0 shadow-xs ${
                  isLaunching
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <PlayCircle className={`w-3.5 h-3.5 ${isLaunching ? 'animate-spin' : ''}`} />
                <span>{isLaunching ? 'Starting...' : '▶ Run Live Test'}</span>
              </button>
            </div>
          </div>
        </div>

        {launchMessage && (
          <div className="bg-emerald-950/60 border-b border-emerald-800 px-5 py-2 text-xs text-emerald-300 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            <span>{launchMessage}</span>
          </div>
        )}

        {/* Live Simulator Body: Browser Window Chrome + Live Viewport */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[hsl(var(--border))]">
          {/* Left 8 Cols: Main Live Browser Window */}
          <div className="lg:col-span-8 p-4 md:p-6 bg-slate-50 flex flex-col justify-between">
            {/* Realistic Browser Top Chrome */}
            <div className="bg-white rounded-t-xl border border-[hsl(var(--border))] border-b-0 px-4 py-3 flex items-center justify-between gap-3 shadow-xs">
              {/* Window Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-3 h-3 rounded-full bg-rose-400 border border-rose-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-400 border border-emerald-500 inline-block" />
              </div>

              {/* Nav & Address Bar */}
              <div className="flex-1 flex items-center gap-2 max-w-xl mx-2">
                <div className="flex items-center gap-1 text-slate-400 shrink-0">
                  <button
                    type="button"
                    disabled={selectedStepIndex <= 0}
                    onClick={() => {
                      setAutoFollow(false);
                      setSelectedStepIndex(prev => Math.max(0, prev - 1));
                    }}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Previous Step"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={selectedStepIndex >= stepExecutions.length - 1}
                    onClick={() => {
                      setSelectedStepIndex(prev => Math.min(stepExecutions.length - 1, prev + 1));
                    }}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Next Step"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => refreshRunEvidence(selectedRunId)}
                    className="p-1 rounded hover:bg-slate-100"
                    title="Refresh Live Frame"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRunActive ? 'animate-spin text-emerald-600' : ''}`} />
                  </button>
                </div>

                {/* URL Input Bar */}
                <div className="flex-1 bg-slate-100 rounded-lg border border-slate-200 px-3 py-1 text-xs flex items-center justify-between gap-2 overflow-hidden">
                  <div className="flex items-center gap-1.5 truncate text-slate-700">
                    <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="font-mono truncate select-all">
                      {currentStep?.url_after || activeRun?.target_url || 'http://127.0.0.1:5001'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(currentStep?.url_after || activeRun?.target_url || '')}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                      title="Copy URL"
                    >
                      {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                    <a
                      href={currentStep?.url_after || activeRun?.target_url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                      title="Open in new window"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Viewport Info & Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                  1280×800
                </span>
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(true)}
                  disabled={!activeScreenshotUrl}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition disabled:opacity-40"
                  title="Expand Fullscreen View"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Main Screen Viewport Container */}
            <div className="relative bg-slate-950 rounded-b-xl border border-[hsl(var(--border))] border-t-0 aspect-16/10 flex items-center justify-center overflow-hidden group shadow-inner">
              {activeScreenshotUrl ? (
                <>
                  <img
                    src={activeScreenshotUrl}
                    alt={`Step ${selectedStepIndex + 1} - ${currentStep?.action || 'screenshot'}`}
                    className="w-full h-full object-contain cursor-zoom-in transition duration-200"
                    onClick={() => setIsZoomOpen(true)}
                  />

                  {/* Floating Action HUD Badge (Top Left) */}
                  <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg border border-slate-700/80 shadow-lg flex items-center gap-2.5 text-xs max-w-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <div>
                      <div className="font-semibold flex items-center gap-1.5">
                        <span className="uppercase text-[10px] tracking-wider text-emerald-400 font-mono">
                          Step {currentStep?.step_index || selectedStepIndex + 1}/{stepExecutions.length || 1}:
                        </span>
                        <span className="font-mono text-white capitalize">{currentStep?.action || 'navigate'}</span>
                        {currentStep?.duration_sec && (
                          <span className="text-[10px] text-slate-400 font-normal">({currentStep.duration_sec}s)</span>
                        )}
                      </div>
                      {currentStep?.selector && (
                        <div className="text-[11px] text-slate-300 font-mono truncate max-w-xs mt-0.5">
                          {currentStep.selector}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Floating Verification HUD Badge (Top Right) */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {currentStep?.status === 'Failed' ? (
                      <span className="bg-rose-500/95 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg border border-rose-400 shadow-md flex items-center gap-1.5 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Defect Highlighted</span>
                      </span>
                    ) : (
                      <span className="bg-emerald-600/95 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg border border-emerald-400 shadow-md flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified Pass</span>
                      </span>
                    )}
                  </div>

                  {/* Failure Comparative Perspective Switcher (Bottom Center) */}
                  {currentStep && (currentStep.screenshot_annotated_url || currentStep.screenshot_failure_url) && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700 shadow-xl flex items-center gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setViewMode('annotated')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition ${
                          viewMode === 'annotated' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        🎯 Highlighted Bug
                      </button>
                      {currentStep.screenshot_before_url && (
                        <button
                          type="button"
                          onClick={() => setViewMode('before')}
                          className={`px-2.5 py-1 rounded-lg font-medium transition ${
                            viewMode === 'before' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          ⏮ Before
                        </button>
                      )}
                      {currentStep.screenshot_after_url && (
                        <button
                          type="button"
                          onClick={() => setViewMode('after')}
                          className={`px-2.5 py-1 rounded-lg font-medium transition ${
                            viewMode === 'after' ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          ⏭ After
                        </button>
                      )}
                    </div>
                  )}

                  {/* Click to Zoom Overlay Hint */}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="bg-slate-900/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Click to view full-resolution screenshot</span>
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center p-8 text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-3 text-emerald-400">
                    <Globe className={`w-6 h-6 ${isRunActive ? 'animate-spin' : ''}`} />
                  </div>
                  <h4 className="text-sm font-semibold text-white">
                    {isRunActive ? 'Playwright Session Initializing...' : 'No Active Session Recorded'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    {isRunActive
                      ? 'The autonomous agent is negotiating DOM controls and preparing live step screenshots.'
                      : 'Launch a live run above or select a completed test run to inspect the live screenshot filmstrip.'}
                  </p>
                  {!isRunActive && (
                    <button
                      type="button"
                      onClick={handleLaunchRun}
                      className="mt-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition inline-flex items-center gap-1.5"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Start Autonomous Test Run</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Step Filmstrip / Reel Carousel */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Execution Timeline ({stepExecutions.length} Steps)</span>
                </span>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoFollow}
                    onChange={(e) => setAutoFollow(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Auto-sync with live runner</span>
                </label>
              </div>

              {stepExecutions.length === 0 ? (
                <div className="bg-white rounded-xl border border-[hsl(var(--border))] p-4 text-center text-xs text-slate-400">
                  Awaiting step execution records from test runner...
                </div>
              ) : (
                <div
                  ref={filmstripRef}
                  className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-slate-300"
                >
                  {stepExecutions.map((step, idx) => {
                    const isSelected = idx === selectedStepIndex;
                    const thumbUrl = step.screenshot_annotated_url || step.screenshot_after_url || step.screenshot_before_url;
                    return (
                      <button
                        key={step.id || idx}
                        type="button"
                        onClick={() => {
                          setAutoFollow(false);
                          setSelectedStepIndex(idx);
                        }}
                        className={`shrink-0 w-28 text-left rounded-xl border transition p-1.5 group flex flex-col justify-between ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {/* Thumbnail Viewport */}
                        <div className="w-full h-16 bg-slate-900 rounded-lg overflow-hidden relative mb-1.5 border border-slate-200">
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={`Step ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-150"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 font-mono">
                              No Art
                            </div>
                          )}
                          <span
                            className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                              step.status === 'Failed' ? 'bg-rose-500' : 'bg-emerald-400'
                            }`}
                          />
                        </div>

                        {/* Step Details */}
                        <div className="flex items-center justify-between text-[11px] leading-tight">
                          <span className="font-bold text-slate-900">#{idx + 1}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                              step.status === 'Failed'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {step.action}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {step.selector || step.url_after?.split('/').pop() || 'goto'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right 4 Cols: Live Run Status & Real-Time Event Terminal */}
          <div className="lg:col-span-4 p-4 md:p-6 bg-white flex flex-col justify-between gap-4">
            <div>
              {/* Header: Run Switcher */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Inspected Session
                </span>
                <NavLink
                  to={`/runs?selected=${selectedRunId}`}
                  className="text-xs text-emerald-700 font-semibold hover:underline flex items-center gap-1"
                >
                  <span>Detailed Trace</span>
                  <ArrowRight className="w-3 h-3" />
                </NavLink>
              </div>

              {/* Run Selector Dropdown */}
              <select
                value={selectedRunId}
                onChange={(e) => handleSelectRun(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {runs.map(r => {
                  const isLive = ['running', 'exploring', 'planning', 'executing'].includes(r.status);
                  return (
                    <option key={r.id} value={r.id}>
                      {isLive ? '🔴 [LIVE NOW] ' : '⚪ '}
                      {r.id} — {r.target_url} ({r.status})
                    </option>
                  );
                })}
              </select>

              {/* Active Run Telemetry Cards */}
              <div className="grid grid-cols-2 gap-2.5 mt-3.5">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Steps</div>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                    {stepExecutions.length}
                  </div>
                  <div className="text-[10px] text-slate-500">Chronological evidence</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Defects Verified</div>
                  <div className="text-lg font-bold text-rose-600 font-mono mt-0.5">
                    {activeRun?.findings_count || 0}
                  </div>
                  <div className="text-[10px] text-rose-700">With annotated evidence</div>
                </div>
              </div>

              {/* Active Run Baseline Profile & Auto-Selected Objectives */}
              <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Applied Baseline Profile</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {activeRun?.baseline_profile === 'assessment'
                      ? 'AssessPro / iMocha Baseline'
                      : activeRun?.baseline_profile === 'ecommerce'
                      ? 'E-Commerce / Food Baseline'
                      : activeRun?.baseline_profile === 'universal'
                      ? 'Universal Invariants'
                      : (activeRun?.baseline_profile || 'Default Invariants')}
                  </span>
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-600" />
                    <span>Auto-Selected Objectives</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(activeRun?.objectives && activeRun.objectives.length > 0
                      ? activeRun.objectives
                      : ['Functional testing', 'Form validation', 'Business-rule testing', 'Negative testing']
                    ).map((obj: string) => (
                      <span
                        key={obj}
                        className="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-medium"
                      >
                        ✓ {obj}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Selected Step Inspector Card */}
              {currentStep && (
                <div className="mt-3.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                  <div className="font-semibold text-slate-900 flex items-center justify-between">
                    <span>Selected Step #{currentStep.step_index || selectedStepIndex + 1}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        currentStep.status === 'Failed'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {currentStep.status}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] mt-1 leading-snug">
                    {currentStep.description || `${currentStep.action} on ${currentStep.selector || currentStep.url_after}`}
                  </p>
                  {currentStep.error_message && (
                    <div className="mt-2 bg-rose-50 text-rose-900 border border-rose-200 p-2 rounded-lg text-[11px]">
                      <span className="font-bold">Assertion Failure: </span>
                      {currentStep.error_message}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Live Action Ticker / Terminal */}
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Real-Time Action Log</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {runEvents.length} events
                </span>
              </div>

              <div className="bg-slate-950 text-slate-300 font-mono text-[11px] p-3 rounded-xl border border-slate-800 h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 space-y-2">
                {runEvents.length === 0 ? (
                  <div className="text-slate-500 italic py-4 text-center">
                    Awaiting live Playwright engine log stream...
                  </div>
                ) : (
                  runEvents.slice(-15).map((ev, i) => (
                    <div key={ev.id || i} className="leading-tight">
                      <span className="text-slate-500 text-[10px]">
                        {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '--:--:--'}
                      </span>{' '}
                      <span
                        className={`font-semibold ${
                          ev.event_type.includes('FAIL') || ev.event_type.includes('BUG')
                            ? 'text-rose-400'
                            : ev.event_type.includes('PASS')
                            ? 'text-emerald-400'
                            : ev.event_type.includes('STEP')
                            ? 'text-blue-400'
                            : 'text-amber-400'
                        }`}
                      >
                        [{ev.agent_role.toUpperCase()}]
                      </span>{' '}
                      <span className="text-slate-200">{ev.message}</span>
                    </div>
                  ))
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Metrics KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 md:p-5 rounded-xl border border-[hsl(var(--border))] shadow-xs">
          <div className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Total Runs</div>
          <div className="text-2xl md:text-3xl font-bold text-[hsl(var(--foreground))] mt-1.5 font-mono">{totalRuns}</div>
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] font-medium mt-1 flex items-center gap-1">
            <Activity className="w-3 h-3 text-[hsl(var(--accent))]" />
            <span>Recorded Sessions</span>
          </div>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-xl border border-[hsl(var(--border))] shadow-xs">
          <div className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Tests Executed</div>
          <div className="text-2xl md:text-3xl font-bold text-[hsl(var(--foreground))] mt-1.5 font-mono">{totalTestsExecuted}</div>
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
            <NavLink to="/test-cases" className="text-[hsl(var(--accent))] hover:underline font-medium">
              View all cases →
            </NavLink>
          </div>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-xl border border-[hsl(var(--border))] shadow-xs">
          <div className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Confirmed Bugs</div>
          <div className="text-2xl md:text-3xl font-bold text-rose-600 mt-1.5 font-mono">{confirmedBugs}</div>
          <div className="text-[11px] text-rose-700 font-medium mt-1">Verified with replay</div>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-xl border border-[hsl(var(--border))] shadow-xs">
          <div className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Suspected Findings</div>
          <div className="text-2xl md:text-3xl font-bold text-amber-600 mt-1.5 font-mono">{suspectedBugs}</div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">Under investigation</div>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-xl border border-[hsl(var(--border))] shadow-xs col-span-2 md:col-span-1">
          <div className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Regression Tests</div>
          <div className="text-2xl md:text-3xl font-bold text-[hsl(var(--foreground))] mt-1.5 font-mono">{regressionTests.length}</div>
          <div className="text-[11px] text-[hsl(var(--muted-foreground))] font-medium mt-1">
            <NavLink to="/regression" className="text-[hsl(var(--accent))] hover:underline font-medium">
              Saved suites →
            </NavLink>
          </div>
        </div>
      </div>

      {/* 4. Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Execution Distribution */}
        <div className="bg-white p-6 rounded-xl border border-[#e2e8f0] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-base text-[#0f172a]">Test Execution Distribution</h3>
              <p className="text-xs text-[#64748b]">Passed vs Failed vs Blocked assertions</p>
            </div>
            <TrendingUp className="w-4 h-4 text-[#047857]" />
          </div>
          {testDistributionData.length > 0 ? (
            <div className="h-64 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={testDistributionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                    label
                  >
                    {testDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 pl-4 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#10b981]" />
                  <span>Passed ({totalPassed})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
                  <span>Failed ({totalFailed})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                  <span>Blocked ({totalBlocked})</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-[#94a3b8]">
              No test executions recorded yet. Start a new test run to populate metrics.
            </div>
          )}
        </div>

        {/* Defects by Severity */}
        <div className="bg-white p-6 rounded-xl border border-[#e2e8f0] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-base text-[#0f172a]">Finding Distribution by Severity</h3>
              <p className="text-xs text-[#64748b]">Impact policy classification</p>
            </div>
            <Layers className="w-4 h-4 text-[#047857]" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="#047857" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Recent Autonomous Test Runs Table */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#e2e8f0] flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base text-[#0f172a]">Recent Autonomous Test Runs</h3>
            <p className="text-xs text-[#64748b]">History of targeted applications and browser sessions</p>
          </div>
          <NavLink
            to="/runs"
            className="text-xs text-[#047857] hover:underline font-semibold flex items-center gap-1"
          >
            <span>View All Runs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>

        {runs.length === 0 ? (
          <div className="p-8 text-center">
            <Compass className="w-8 h-8 text-[#94a3b8] mx-auto mb-2" />
            <p className="text-sm text-[#64748b]">No test runs recorded in database.</p>
            <NavLink
              to="/new-run"
              className="inline-block mt-3 text-xs font-semibold text-[#047857] bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200"
            >
              Start First Autonomous Run
            </NavLink>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f8fafc] text-[#64748b] text-xs font-semibold border-b border-[#e2e8f0]">
                <tr>
                  <th className="py-3 px-5">Run ID</th>
                  <th className="py-3 px-5">Target Application</th>
                  <th className="py-3 px-5">Mode</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Tests (P/F/B)</th>
                  <th className="py-3 px-5">Findings</th>
                  <th className="py-3 px-5">Duration</th>
                  <th className="py-3 px-5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {runs.slice(0, 5).map(run => (
                  <tr key={run.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="py-3.5 px-5 font-mono text-xs font-semibold text-[#0f172a]">{run.id}</td>
                    <td className="py-3.5 px-5 text-xs text-[#334155] max-w-xs truncate">{run.target_url}</td>
                    <td className="py-3.5 px-5">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                        {run.mode}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          run.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : run.status === 'failed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-xs">
                      <span className="text-emerald-700 font-semibold">{run.passed_count}</span> /{' '}
                      <span className="text-rose-700 font-semibold">{run.failed_count}</span> /{' '}
                      <span className="text-amber-700 font-semibold">{run.blocked_count}</span>
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-xs text-[#dc2626]">{run.findings_count}</td>
                    <td className="py-3.5 px-5 text-xs text-[#64748b]">{run.duration_sec ? `${run.duration_sec.toFixed(1)}s` : '--'}</td>
                    <td className="py-3.5 px-5 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRunId(run.id);
                          window.scrollTo({ top: 180, behavior: 'smooth' });
                        }}
                        className="text-xs text-emerald-700 hover:underline font-semibold"
                      >
                        Live Replay
                      </button>
                      <NavLink
                        to={`/runs?selected=${run.id}`}
                        className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                      >
                        Inspect
                      </NavLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Proof-Carrying Bug Findings */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#e2e8f0] flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base text-[#0f172a]">Proof-Carrying Bug Findings</h3>
            <p className="text-xs text-[#64748b]">Verified defects backed by replay attempts and DOM evidence</p>
          </div>
          <NavLink
            to="/bugs"
            className="text-xs text-[#047857] hover:underline font-semibold flex items-center gap-1"
          >
            <span>View All Reports</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>

        {bugs.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#64748b]">
            No bug findings recorded. Run a test against the demo application to detect seeded defects.
          </div>
        ) : (
          <div className="divide-y divide-[#e2e8f0]">
            {bugs.slice(0, 4).map(bug => (
              <div key={bug.id} className="p-4 hover:bg-[#f8fafc] flex items-center justify-between transition-colors">
                <div className="flex items-start gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5 ${
                      bug.severity === 'Critical'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : bug.severity === 'High'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                  >
                    {bug.severity}
                  </span>
                  <div>
                    <NavLink
                      to={`/bugs/${bug.id}`}
                      className="font-semibold text-sm text-[#0f172a] hover:text-[#047857] transition"
                    >
                      [{bug.id}] {bug.title}
                    </NavLink>
                    <div className="text-xs text-[#64748b] mt-0.5 flex items-center gap-3">
                      <span>Target: <code className="text-[#334155]">{bug.affected_url}</code></span>
                      <span>&bull;</span>
                      <span className="text-[#047857] font-medium">{bug.status} ({bug.replay_attempts} replays)</span>
                    </div>
                  </div>
                </div>
                <NavLink
                  to={`/bugs/${bug.id}`}
                  className="text-xs font-semibold text-[#047857] bg-emerald-50 px-3 py-1.5 rounded border border-emerald-200 hover:bg-emerald-100 transition"
                >
                  Inspect Evidence
                </NavLink>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7. Full-Resolution Zoom Lightbox Modal */}
      {isZoomOpen && activeScreenshotUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 md:p-8"
          onClick={() => setIsZoomOpen(false)}
        >
          {/* Top Modal Bar */}
          <div
            className="flex items-center justify-between text-white mb-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">
                Step {currentStep?.step_index || selectedStepIndex + 1}: {currentStep?.action}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {currentStep?.url_after || activeRun?.target_url}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Press ESC or click anywhere to exit</span>
              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                className="bg-white/10 hover:bg-white/20 text-white rounded-lg p-2 text-xs font-semibold"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Modal Image Viewport */}
          <div
            className="flex-1 flex items-center justify-center overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeScreenshotUrl}
              alt="Full resolution live screenshot"
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
};
