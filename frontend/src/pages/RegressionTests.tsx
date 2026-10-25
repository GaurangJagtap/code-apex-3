import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  Play,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Award,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  fetchRegressionTests,
  rerunRegressionTest,
  rerunAllRegressionTests,
  approveRegressionTest,
  autoPromoteRegressionTests,
  deleteRegressionTest,
  RegressionTest,
  RegressionRunResult,
  RegressionSuiteResult
} from '../api/client';

export const RegressionTests: React.FC = () => {
  const [tests, setTests] = useState<RegressionTest[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningSuite, setRunningSuite] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RegressionRunResult | null>(null);
  const [suiteResult, setSuiteResult] = useState<RegressionSuiteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      let data = await fetchRegressionTests();
      if (data.length === 0) {
        // Automatically scan and seed passed tests from completed runs if initial load is empty
        try {
          await autoPromoteRegressionTests();
          data = await fetchRegressionTests();
        } catch (e) {
          console.log('Auto-promote check', e);
        }
      }
      setTests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAutoPromote = async () => {
    setPromoting(true);
    try {
      const res = await autoPromoteRegressionTests();
      setActionNotice(res.message);
      setTimeout(() => setActionNotice(null), 5000);
      const updated = await fetchRegressionTests();
      setTests(updated);
    } catch (e: any) {
      alert(e?.response?.data?.detail || e.message || 'Error auto-promoting regression tests.');
    } finally {
      setPromoting(false);
    }
  };

  const handleDelete = async (testId: string) => {
    if (!confirm('Are you sure you want to remove this test from the regression suite?')) return;
    try {
      await deleteRegressionTest(testId);
      setActionNotice('Regression test removed from suite.');
      setTimeout(() => setActionNotice(null), 4000);
      const updated = await fetchRegressionTests();
      setTests(updated);
    } catch (e: any) {
      alert(e?.response?.data?.detail || e.message || 'Error deleting regression test.');
    }
  };

  const handleRunTest = async (testId: string) => {
    setRunningId(testId);
    setLastResult(null);
    try {
      const res = await rerunRegressionTest(testId);
      setLastResult(res);
      const updated = await fetchRegressionTests();
      setTests(updated);
    } catch (e: any) {
      alert(e?.response?.data?.detail || e.message || 'Error executing regression test.');
    } finally {
      setRunningId(null);
    }
  };

  const handleRunAll = async () => {
    setRunningSuite(true);
    setSuiteResult(null);
    setLastResult(null);
    try {
      const res = await rerunAllRegressionTests();
      setSuiteResult(res);
      const updated = await fetchRegressionTests();
      setTests(updated);
    } catch (e: any) {
      alert(e?.response?.data?.detail || e.message || 'Error executing regression suite.');
    } finally {
      setRunningSuite(false);
    }
  };

  const handleApprove = async (testId: string) => {
    try {
      await approveRegressionTest(testId);
      setActionNotice('Test approval status updated.');
      setTimeout(() => setActionNotice(null), 4000);
      const updated = await fetchRegressionTests();
      setTests(updated);
    } catch (e: any) {
      alert(e?.response?.data?.detail || e.message || 'Error approving test.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider text-[hsl(var(--accent))] uppercase flex items-center gap-1">
              <History className="w-3.5 h-3.5" /> Reusable Regression Suites
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[hsl(var(--foreground))]">
            Automated Regression Memory
          </h1>
          <p className="text-xs md:text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Verified exploratory journeys and bug reproduction steps promoted to persistent regression suites with diff tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))] font-mono">
            {tests.length} Saved Regression Test(s)
          </div>
          <button
            onClick={handleAutoPromote}
            disabled={promoting}
            className="text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
            title="Scan completed test runs and promote all verified passing journeys to regression memory"
          >
            <Sparkles className={`w-3.5 h-3.5 ${promoting ? 'animate-spin' : ''}`} />
            <span>{promoting ? 'Promoting...' : 'Auto-Promote Passing Tests'}</span>
          </button>
          {tests.length > 0 && (
            <button
              onClick={handleRunAll}
              disabled={runningSuite || runningId !== null}
              className="text-xs font-medium bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${runningSuite ? 'animate-spin' : ''}`} />
              <span>{runningSuite ? 'Running Full Suite...' : 'Run Entire Suite'}</span>
            </button>
          )}
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Regression Suite Batch Result Banner */}
      {suiteResult && (
        <div className="bg-white rounded-xl border border-[hsl(var(--border))] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-sm text-[hsl(var(--foreground))]">
                Regression Suite Execution Summary
              </h3>
            </div>
            <button
              onClick={() => setSuiteResult(null)}
              className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline"
            >
              Close Summary
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-[hsl(var(--secondary))]/40 p-3 rounded-lg border border-[hsl(var(--border))]">
              <div className="text-[11px] text-[hsl(var(--muted-foreground))] font-medium">Total Tests</div>
              <div className="text-lg font-bold font-mono text-[hsl(var(--foreground))]">{suiteResult.total_executed}</div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              <div className="text-[11px] text-emerald-700 font-medium">Passed</div>
              <div className="text-lg font-bold font-mono text-emerald-800">{suiteResult.passed}</div>
            </div>
            <div className="bg-rose-50 p-3 rounded-lg border border-rose-200">
              <div className="text-[11px] text-rose-700 font-medium">Failed</div>
              <div className="text-lg font-bold font-mono text-rose-800">{suiteResult.failed}</div>
            </div>
            <div className={`p-3 rounded-lg border ${suiteResult.regressions_detected > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[11px] font-medium text-amber-800">Regressions</div>
              <div className="text-lg font-bold font-mono text-amber-900">{suiteResult.regressions_detected}</div>
            </div>
            <div className="bg-teal-50 p-3 rounded-lg border border-teal-200">
              <div className="text-[11px] text-teal-700 font-medium">Fixes Verified</div>
              <div className="text-lg font-bold font-mono text-teal-800">{suiteResult.fixes_detected}</div>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[hsl(var(--border))]">
            <div className="text-xs font-semibold text-[hsl(var(--foreground))]">Journey Diffs:</div>
            {suiteResult.details.map((r) => (
              <div
                key={r.test_id}
                className="flex items-center justify-between text-xs p-2 bg-[hsl(var(--secondary))]/20 rounded border border-[hsl(var(--border))]"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[11px] text-[hsl(var(--foreground))]">{r.test_id}</span>
                  <span className="text-[hsl(var(--foreground))]">{r.name}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className={r.status === 'Passed' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                    {r.status}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-[hsl(var(--muted-foreground))]">{r.diff_summary}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regression Run Result Diff Banner */}
      {lastResult && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between text-xs transition-all ${
            lastResult.status === 'Passed'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          <div className="space-y-1">
            <div className="font-bold text-sm flex items-center gap-2">
              {lastResult.status === 'Passed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-600" />
              )}
              Regression Execution Outcome: {lastResult.status.toUpperCase()}
            </div>
            <div className="font-mono text-xs">{lastResult.diff_summary}</div>
            <div className="text-[11px] opacity-80">
              Duration: {lastResult.duration_sec.toFixed(2)}s • Executed at: {lastResult.executed_at.substring(11, 19)}
            </div>
          </div>
          <button
            onClick={() => setLastResult(null)}
            className="text-xs underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Regression Tests List */}
      <div className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[hsl(var(--muted-foreground))]">
            <RotateCcw className="w-6 h-6 animate-spin mx-auto mb-2 text-[hsl(var(--accent))]" />
            Loading regression memory suite...
          </div>
        ) : tests.length === 0 ? (
          <div className="p-12 text-center text-xs text-[hsl(var(--muted-foreground))] space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--accent))] flex items-center justify-center mx-auto mb-2">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-base text-[hsl(var(--foreground))]">No regression tests in suite yet.</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 max-w-md mx-auto">
                Auto-promote verified passing exploratory journeys from your completed test runs, or seed ground-truth benchmark baselines to immediately activate regression memory.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleAutoPromote}
                disabled={promoting}
                className="text-xs font-semibold bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 text-[hsl(var(--accent))] ${promoting ? 'animate-spin' : ''}`} />
                <span>{promoting ? 'Promoting...' : 'Auto-Promote Verified Passing Tests'}</span>
              </button>
              <Link
                to="/new-run"
                className="text-xs font-medium border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] px-4 py-2 rounded-xl flex items-center gap-1.5 transition"
              >
                <span>Launch New Run</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[hsl(var(--border))]">
            {tests.map(test => {
              const isRunning = runningId === test.id;
              const isPassed = test.last_status === 'Passed';
              const isFailed = test.last_status === 'Failed';
              const isExpanded = expandedId === test.id;

              return (
                <div key={test.id} className="transition-colors">
                  <div className="p-5 hover:bg-[hsl(var(--secondary))]/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-[hsl(var(--foreground))]">
                          {test.id}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPassed
                              ? 'bg-emerald-100 text-emerald-800'
                              : isFailed
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {test.last_status}
                        </span>
                        {test.is_approved ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            Approved
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            Provisional
                          </span>
                        )}
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">Executions: <strong>{test.executions_count}</strong></span>
                      </div>

                      <h3 className="font-bold text-sm text-[hsl(var(--foreground))]">{test.name}</h3>
                      <div className="text-xs text-[hsl(var(--muted-foreground))] flex flex-wrap items-center gap-3">
                        <span>Target: <code className="text-[hsl(var(--foreground))] font-mono">{test.target_url}</code></span>
                        <span>•</span>
                        <span>Steps: {test.steps_count}</span>
                        <span>•</span>
                        <span>Assertions: {test.assertions_count}</span>
                        {test.last_run_at && (
                          <>
                            <span>•</span>
                            <span>Last run: {test.last_run_at.substring(0, 10)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : test.id)}
                        className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] transition flex items-center gap-1"
                        title="Inspect step sequence and assertions"
                      >
                        <Layers className="w-3.5 h-3.5 text-slate-500" />
                        <span>{isExpanded ? 'Hide Steps' : 'Inspect Steps'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleApprove(test.id)}
                        className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition ${
                          test.is_approved
                            ? 'border-slate-200 text-slate-500 hover:bg-slate-50'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                        title="Toggle approval state"
                      >
                        {test.is_approved ? 'Unapprove' : 'Approve'}
                      </button>

                      <button
                        onClick={() => handleRunTest(test.id)}
                        disabled={isRunning}
                        className="text-xs font-medium bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
                      >
                        <Play className={`w-3.5 h-3.5 text-[hsl(var(--accent))] ${isRunning ? 'animate-spin' : ''}`} />
                        <span>{isRunning ? 'Re-executing...' : 'Rerun Journey'}</span>
                      </button>

                      <button
                        onClick={() => handleDelete(test.id)}
                        className="p-1.5 rounded-lg border border-[hsl(var(--border))] hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                        title="Remove from regression suite"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Step Inspector Accordion */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 bg-slate-50/70 border-t border-[hsl(var(--border))] space-y-3 animate-in fade-in duration-150">
                      <div className="text-xs font-semibold text-[hsl(var(--foreground))] flex items-center gap-1">
                        <span>Replay Action Sequence ({test.structured_steps?.length || test.steps_count || 0})</span>
                      </div>
                      <div className="space-y-1.5">
                        {test.structured_steps && test.structured_steps.length > 0 ? (
                          test.structured_steps.map((st, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200 text-xs">
                              <span className="font-mono text-[10px] font-bold uppercase bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                Step {idx + 1}: {st.action}
                              </span>
                              {st.selector && (
                                <code className="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-1 rounded truncate max-w-xs">
                                  {st.selector}
                                </code>
                              )}
                              <span className="text-[hsl(var(--foreground))] flex-1">{st.description}</span>
                              {st.value && (
                                <span className="font-mono text-[10px] text-slate-500 bg-slate-50 px-1 py-0.5 rounded">
                                  val: "{st.value}"
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400 italic">Pre-compiled Playwright journey.</div>
                        )}
                      </div>

                      {test.assertions && test.assertions.length > 0 && (
                        <div className="pt-2">
                          <div className="text-xs font-semibold text-[hsl(var(--foreground))] mb-1.5">
                            Automated Invariants Checked ({test.assertions.length}):
                          </div>
                          <div className="space-y-1">
                            {test.assertions.map((asr, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 p-1.5 bg-emerald-50/50 border border-emerald-100 rounded">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="font-mono text-[10px] font-semibold text-emerald-800">{asr.type}</span>
                                <span className="text-[11px] text-slate-600">{asr.message || asr.target}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

