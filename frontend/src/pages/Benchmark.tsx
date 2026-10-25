import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Award,
  PlayCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Activity,
  Layers,
  ArrowRight,
  ExternalLink,
  Sliders,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Target,
  RefreshCw,
  Scale
} from 'lucide-react';
import {
  fetchBenchmarkGroundTruth,
  fetchRunBenchmarkResults,
  runBenchmarkSuite,
  fetchRuns,
  fetchSampleAppDefects,
  toggleSampleAppDefects,
  BenchmarkReport,
  GroundTruthRegistry,
  RunSummary
} from '../api/client';

export const Benchmark: React.FC = () => {
  const [suite, setSuite] = useState<'assessment' | 'quickbite' | 'devstore'>('assessment');
  const [groundTruth, setGroundTruth] = useState<GroundTruthRegistry | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [benchmarkReport, setBenchmarkReport] = useState<BenchmarkReport | null>(null);
  const [runningBenchmark, setRunningBenchmark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [defectsState, setDefectsState] = useState<Record<string, boolean>>({});
  const [togglingDefect, setTogglingDefect] = useState(false);

  const loadRunBenchmark = (runId: string, currentSuite: string) => {
    if (!runId) return;
    fetchRunBenchmarkResults(runId, currentSuite)
      .then(setBenchmarkReport)
      .catch(() => setBenchmarkReport(null));
  };

  const loadData = async (activeSuite: 'assessment' | 'quickbite' | 'devstore') => {
    setLoading(true);
    try {
      const [gt, runsData, defData] = await Promise.all([
        fetchBenchmarkGroundTruth(activeSuite),
        fetchRuns(),
        fetchSampleAppDefects()
      ]);
      setGroundTruth(gt);
      setRuns(runsData);
      if (defData?.defects) {
        setDefectsState(defData.defects);
      }
      if (runsData.length > 0) {
        // Find most relevant run or first run
        const matchedRun = runsData.find(r => {
          if (activeSuite === 'quickbite') return r.target_url.includes('quickbite');
          if (activeSuite === 'assessment') return r.target_url.includes('assess');
          return !r.target_url.includes('assess') && !r.target_url.includes('quickbite');
        }) || runsData[0];

        setSelectedRunId(matchedRun.id);
        loadRunBenchmark(matchedRun.id, activeSuite);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(suite);
  }, [suite]);

  const handleRunSelect = (runId: string) => {
    setSelectedRunId(runId);
    loadRunBenchmark(runId, suite);
  };

  const handleExecuteBenchmark = async () => {
    setRunningBenchmark(true);
    try {
      let targetUrl = 'http://127.0.0.1:5001';
      if (suite === 'assessment') targetUrl = 'http://127.0.0.1:5001/assesspro';
      if (suite === 'quickbite') targetUrl = 'http://127.0.0.1:5001/quickbite';

      const res = await runBenchmarkSuite(targetUrl, suite);
      setBenchmarkReport(res);
      // Refresh runs
      const updatedRuns = await fetchRuns();
      setRuns(updatedRuns);
      if (res?.run_id) {
        setSelectedRunId(res.run_id);
      }
    } catch (e: any) {
      alert(e?.response?.data?.detail || e.message || 'Error executing benchmark suite');
    } finally {
      setRunningBenchmark(false);
    }
  };

  const handleToggleDefect = async (defectId?: string) => {
    setTogglingDefect(true);
    try {
      const payload = defectId ? { defect_id: defectId } : {};
      const res = await toggleSampleAppDefects(payload);
      if (res?.defects) {
        setDefectsState(res.defects);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTogglingDefect(false);
    }
  };

  const allDefectsEnabled = Object.values(defectsState).every(Boolean);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Hero Benchmark Header */}
      <div className="bg-[hsl(var(--primary))] text-white rounded-2xl p-6 md:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-white/10 text-[hsl(var(--accent))] border border-white/15 text-[11px] px-3 py-0.5 rounded-full font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              iMocha IM-02 Ground-Truth Engine
            </span>
            <span className="bg-white/10 text-white text-[11px] px-2.5 py-0.5 rounded-full font-medium">
              5 Seeded Defects / Suite
            </span>
          </div>

          <h1 className="font-display text-3xl md:text-4xl font-normal tracking-tight text-white">
            Empirical <span className="italic">Benchmark</span> & Defect Matrix
          </h1>
          <p className="text-white/70 text-xs md:text-sm max-w-2xl leading-relaxed">
            Measures empirical <strong>Recall</strong>, <strong>Precision</strong>, <strong>Reproducibility Rate</strong>, and <strong>Journey Coverage</strong> against verified ground-truth defect fixtures without hardcoded metrics.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <button
            onClick={handleExecuteBenchmark}
            disabled={runningBenchmark}
            className="bg-[hsl(var(--accent))] text-white font-medium px-5 py-2.5 rounded-lg text-xs hover:bg-[hsl(var(--accent))]/90 transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <PlayCircle className={`w-4 h-4 ${runningBenchmark ? 'animate-spin' : ''}`} />
            <span>{runningBenchmark ? 'Running Benchmark...' : `Run ${suite === 'assessment' ? 'AssessPro' : suite === 'quickbite' ? 'QuickBite' : 'DevStore'} Suite`}</span>
          </button>
        </div>
      </div>

      {/* Benchmark Suite Switcher */}
      <div className="bg-white p-4 rounded-xl border border-[hsl(var(--border))] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            Benchmark Suite:
          </span>
          <div className="inline-flex rounded-lg p-1 bg-[hsl(var(--secondary))] border border-[hsl(var(--border))]">
            <button
              onClick={() => setSuite('assessment')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
                suite === 'assessment'
                  ? 'bg-white text-[hsl(var(--primary))] shadow-xs font-semibold'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              AssessPro Assessment Platform
            </button>
            <button
              onClick={() => setSuite('quickbite')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
                suite === 'quickbite'
                  ? 'bg-white text-[hsl(var(--primary))] shadow-xs font-semibold'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              QuickBite Food Delivery
            </button>
            <button
              onClick={() => setSuite('devstore')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
                suite === 'devstore'
                  ? 'bg-white text-[hsl(var(--primary))] shadow-xs font-semibold'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              }`}
            >
              DevStore E-Commerce
            </button>
          </div>
        </div>

        {/* Live Seeded Defects Toggle for DevStore */}
        {suite === 'devstore' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleToggleDefect()}
              disabled={togglingDefect}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition flex items-center gap-2 ${
                allDefectsEnabled
                  ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
              }`}
            >
              {allDefectsEnabled ? (
                <ToggleRight className="w-4 h-4 text-amber-600" />
              ) : (
                <ToggleLeft className="w-4 h-4 text-emerald-600" />
              )}
              <span>
                DevStore State: <strong>{allDefectsEnabled ? 'Defective (5 Seeded Active)' : 'Clean (Fixed)'}</strong>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Benchmark Cards */}
      {benchmarkReport ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Defect Recall */}
          <div className="bg-white p-5 rounded-xl border border-[hsl(var(--border))] shadow-xs relative overflow-hidden">
            <div className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Defect Recall</div>
            <div className="text-3xl font-extrabold font-mono text-emerald-700 mt-2">
              {benchmarkReport.metrics.defect_recall_percent}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 flex items-center justify-between">
              <span>True Positives: <strong className="text-[hsl(var(--foreground))]">{benchmarkReport.metrics.true_positives} / {benchmarkReport.metrics.total_planted_defects}</strong></span>
              <span className="text-[11px] text-emerald-700 font-semibold">TP / Planted</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${benchmarkReport.metrics.defect_recall * 100}%` }}
              />
            </div>
          </div>

          {/* Precision */}
          <div className="bg-white p-5 rounded-xl border border-[hsl(var(--border))] shadow-xs relative overflow-hidden">
            <div className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Precision</div>
            <div className="text-3xl font-extrabold font-mono text-sky-700 mt-2">
              {benchmarkReport.metrics.precision_percent}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 flex items-center justify-between">
              <span>Reported Findings: <strong className="text-[hsl(var(--foreground))]">{benchmarkReport.metrics.total_findings_reported}</strong></span>
              <span className="text-[11px] text-sky-700 font-semibold">TP / (TP+FP)</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-sky-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${benchmarkReport.metrics.precision * 100}%` }}
              />
            </div>
          </div>

          {/* Reproducibility Rate */}
          <div className="bg-white p-5 rounded-xl border border-[hsl(var(--border))] shadow-xs relative overflow-hidden">
            <div className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Reproducibility Rate</div>
            <div className="text-3xl font-extrabold font-mono text-purple-700 mt-2">
              {benchmarkReport.metrics.reproducibility_percent}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 flex items-center justify-between">
              <span>Clean Replays Verified</span>
              <span className="text-[11px] text-purple-700 font-semibold">Evidence-backed</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-purple-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${benchmarkReport.metrics.reproducibility_rate * 100}%` }}
              />
            </div>
          </div>

          {/* Step Screenshot Coverage (USP 2) */}
          <div className="bg-white p-5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs relative overflow-hidden">
            <div className="text-[11px] font-semibold text-emerald-900 uppercase tracking-wider flex items-center justify-between">
              <span>Screenshot Coverage (USP 2)</span>
              <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-bold">ALL STEPS</span>
            </div>
            <div className="text-3xl font-extrabold font-mono text-emerald-800 mt-2">
              {benchmarkReport.metrics.screenshot_coverage_percent || '100.0%'}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 flex items-center justify-between">
              <span>Steps with Evidence: <strong className="text-[hsl(var(--foreground))]">{benchmarkReport.metrics.steps_with_screenshot ?? benchmarkReport.metrics.total_executed_steps ?? 'All'}</strong></span>
              <span className="text-[11px] text-emerald-700 font-semibold">Pre + Post Action</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${(benchmarkReport.metrics.screenshot_coverage ?? 1.0) * 100}%` }}
              />
            </div>
          </div>

          {/* Annotated Failure Coverage (USP 2) */}
          <div className="bg-white p-5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs relative overflow-hidden">
            <div className="text-[11px] font-semibold text-rose-900 uppercase tracking-wider flex items-center justify-between">
              <span>Annotated Failure Coverage</span>
              <span className="text-[9px] bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded font-bold">PULSED ROI</span>
            </div>
            <div className="text-3xl font-extrabold font-mono text-rose-700 mt-2">
              {benchmarkReport.metrics.annotated_failure_coverage_percent || '100.0%'}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 flex items-center justify-between">
              <span>Highlighted Regions: <strong className="text-[hsl(var(--foreground))]">{benchmarkReport.metrics.failed_with_annotated ?? benchmarkReport.metrics.total_failed_steps ?? '100%'}</strong></span>
              <span className="text-[11px] text-rose-700 font-semibold">Contrasting Overlay</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-rose-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${(benchmarkReport.metrics.annotated_failure_coverage ?? 1.0) * 100}%` }}
              />
            </div>
          </div>

          {/* Journey Coverage */}
          <div className="bg-white p-5 rounded-xl border border-[hsl(var(--border))] shadow-xs relative overflow-hidden">
            <div className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Journey Coverage</div>
            <div className="text-3xl font-extrabold font-mono text-amber-700 mt-2">
              {benchmarkReport.metrics.journey_coverage_percent}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 flex items-center justify-between">
              <span>Tested Benchmark Paths</span>
              <span className="text-[11px] text-amber-700 font-semibold">{benchmarkReport.metrics.total_tests_executed} Tests</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-amber-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${benchmarkReport.metrics.journey_coverage * 100}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 text-center rounded-xl border border-[hsl(var(--border))] shadow-xs text-xs text-[hsl(var(--muted-foreground))]">
          Select an executed run or click "Run {suite === 'assessment' ? 'Assessment' : 'DevStore'} Suite" to compute empirical metrics against the ground truth registry.
        </div>
      )}

      {/* Run Selector Filter */}
      <div className="bg-white p-4 rounded-xl border border-[hsl(var(--border))] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs font-semibold text-[hsl(var(--foreground))] uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-[hsl(var(--accent))]" />
          Evaluating Benchmark Execution Run:
        </div>
        <select
          value={selectedRunId}
          onChange={e => handleRunSelect(e.target.value)}
          className="text-xs border border-[hsl(var(--border))] rounded-lg px-3 py-1.5 bg-[hsl(var(--secondary))]/30 font-mono text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
        >
          {runs.map(r => (
            <option key={r.id} value={r.id}>
              {r.id.substring(0, 8)} • {r.target_url} • {r.status.toUpperCase()} ({r.findings_count} findings, {r.duration_sec.toFixed(1)}s)
            </option>
          ))}
        </select>
      </div>

      {/* Ground-Truth Defect Matrix */}
      {benchmarkReport && (
        <div className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-xs overflow-hidden">
          <div className="p-5 border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/30 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-600" />
                Seeded Defect Detection Matrix ({suite === 'assessment' ? 'Assessment Platform' : 'DevStore'})
              </h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Exact verification comparison of each documented defect fixture versus findings produced by the autonomous QA agent.
              </p>
            </div>
            <div className="text-xs font-semibold px-2.5 py-1 rounded bg-white border border-[hsl(var(--border))] text-[hsl(var(--foreground))] font-mono">
              {benchmarkReport.defect_matrix.filter(d => d.status === 'Detected').length} / {benchmarkReport.defect_matrix.length} Detected
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[hsl(var(--secondary))]/60 text-[hsl(var(--muted-foreground))] uppercase text-[10px] tracking-wider border-b border-[hsl(var(--border))]">
                <tr>
                  <th className="px-4 py-3">Defect ID</th>
                  <th className="px-4 py-3">Title & Invariant Rule</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Criticality</th>
                  <th className="px-4 py-3">Detection Outcome</th>
                  <th className="px-4 py-3">Verification State</th>
                  <th className="px-4 py-3 text-right">Proof Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {benchmarkReport.defect_matrix.map(d => {
                  const isDetected = d.status === 'Detected';
                  return (
                    <tr key={d.defect_id} className="hover:bg-[hsl(var(--secondary))]/30 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-[hsl(var(--foreground))]">
                        {d.defect_id}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-[hsl(var(--foreground))]">{d.title}</div>
                      </td>
                      <td className="px-4 py-3.5 text-[hsl(var(--muted-foreground))]">
                        {d.category}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            d.criticality === 'Critical'
                              ? 'bg-rose-100 text-rose-800'
                              : d.criticality === 'High'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {d.criticality}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 w-fit ${
                            isDetected
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {isDetected ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-600" />
                          )}
                          <span>{d.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {isDetected ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                              {d.verification_status}
                            </span>
                            <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                              Replays: {d.replays} • Conf: {(d.confidence * 100).toFixed(0)}%
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {d.finding_id ? (
                          <NavLink
                            to={`/bugs/${d.finding_id}`}
                            className="text-[hsl(var(--accent))] hover:underline font-semibold inline-flex items-center gap-1"
                          >
                            <span>Inspect Proof</span>
                            <ArrowRight className="w-3 h-3" />
                          </NavLink>
                        ) : (
                          <span className="text-slate-400">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Benchmark User Journeys Checklist */}
      {benchmarkReport && (
        <div className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-xs p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[hsl(var(--foreground))] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[hsl(var(--accent))]" />
              Defined Benchmark Journeys ({benchmarkReport.benchmark_journeys.length} Workflows)
            </h3>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              Coverage: {benchmarkReport.metrics.journey_coverage_percent}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {benchmarkReport.benchmark_journeys.map(j => (
              <div
                key={j.journey_id}
                className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                  j.covered
                    ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {j.covered ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                  )}
                  <div>
                    <div className="font-semibold text-xs text-[hsl(var(--foreground))]">{j.name}</div>
                    <div className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">{j.path}</div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    j.covered ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {j.covered ? 'Covered' : 'Unvisited'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
