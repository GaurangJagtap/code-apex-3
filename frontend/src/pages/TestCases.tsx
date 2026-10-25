import React, { useEffect, useState } from 'react';
import {
  FileCheck2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Terminal,
  Activity,
  ArrowRight,
  Eye,
  SlidersHorizontal,
  BookmarkPlus,
  Image as ImageIcon,
  Maximize2,
  ChevronLeft
} from 'lucide-react';
import {
  fetchTestCases,
  fetchTestCase,
  saveRegressionTest,
  TestCaseDetail,
  RunSummary,
  fetchRuns,
  fetchTestStepExecutions,
  TestStepExecution
} from '../api/client';

export const TestCases: React.FC = () => {
  const [testCases, setTestCases] = useState<TestCaseDetail[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [activeTestCase, setActiveTestCase] = useState<TestCaseDetail | null>(null);
  const [stepExecutions, setStepExecutions] = useState<TestStepExecution[]>([]);
  const [selectedStepForEvidence, setSelectedStepForEvidence] = useState<TestStepExecution | null>(null);
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const allRuns = await fetchRuns();
      setRuns(allRuns);

      const params: any = {};
      if (selectedRunId) params.run_id = selectedRunId;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      if (sourceFilter !== 'all') params.source = sourceFilter;
      if (search.trim()) params.search = search.trim();

      const cases = await fetchTestCases(params);
      setTestCases(cases);
    } catch (err) {
      console.error('Failed to load test cases', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedRunId, statusFilter, categoryFilter, priorityFilter, sourceFilter]);

  const handleOpenDetail = async (id: string) => {
    setModalLoading(true);
    setSelectedStepForEvidence(null);
    try {
      const detail = await fetchTestCase(id);
      setActiveTestCase(detail);
      const steps = await fetchTestStepExecutions(id).catch(() => []);
      setStepExecutions(steps);
    } catch (err) {
      console.error('Failed to load test case detail', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveRegression = async (testId: string, runId: string) => {
    try {
      const res = await saveRegressionTest(testId, runId);
      setActionNotice(`Saved to regression suite: ${res.id}`);
      setTimeout(() => setActionNotice(null), 4000);
      if (activeTestCase?.id === testId) {
        handleOpenDetail(testId);
      }
    } catch (err) {
      setActionNotice('Failed to save test as regression');
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Passed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Passed
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Failed
          </span>
        );
      case 'Inconclusive':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Inconclusive
          </span>
        );
      case 'Blocked':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <AlertTriangle className="w-3 h-3 text-slate-500" />
            Blocked
          </span>
        );
      case 'Skipped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-400" />
            Skipped
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            {status || 'Pending'}
          </span>
        );
    }
  };

  const getSourceBadge = (source?: string) => {
    if (!source) return null;
    const isBaseline = source.toLowerCase().includes('baseline') || source.toLowerCase().includes('requirement');
    const isInvariant = source.toLowerCase().includes('invariant') || source.toLowerCase().includes('deterministic');
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
          isBaseline
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
            : isInvariant
            ? 'bg-purple-50 text-purple-700 border-purple-200'
            : 'bg-slate-50 text-slate-600 border-slate-200'
        }`}
      >
        {source}
      </span>
    );
  };

  const categories = [
    'Functional behavior and navigation',
    'Form validation and input boundaries',
    'Business logic and calculations',
    'Transaction and workflow integrity',
    'Data persistence and state consistency',
    'Authentication and authorization',
    'Session, recovery, and interrupted workflows',
    'UI, accessibility, and responsive behavior',
    'API integration, reliability, and performance',
    'Security findings'
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider text-[hsl(var(--accent))] uppercase flex items-center gap-1">
              <FileCheck2 className="w-3.5 h-3.5" /> Explainable Test Plan & Execution
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[hsl(var(--foreground))]">
            Test Cases & Verification Evidence
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Every executed, passing, failed, or inconclusive test case with step-by-step ordered traces, assertions, and expectation provenance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--secondary))] text-xs font-medium text-[hsl(var(--foreground))] transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-[hsl(var(--border))] rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              placeholder="Search title, objective, expected result, steps..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadData()}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))] bg-[hsl(var(--secondary))]/30"
            />
          </div>

          {/* Run Filter */}
          <div>
            <select
              value={selectedRunId}
              onChange={e => setSelectedRunId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-xs bg-[hsl(var(--secondary))]/30 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            >
              <option value="">All Test Runs</option>
              {runs.map((r: RunSummary) => (
                <option key={r.id} value={r.id}>
                  {r.target_url} ({r.id.substring(0, 8)}) - {r.status}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-xs bg-[hsl(var(--secondary))]/30 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            >
              <option value="all">All Statuses</option>
              <option value="Passed">Passed</option>
              <option value="Failed">Failed</option>
              <option value="Inconclusive">Inconclusive</option>
              <option value="Blocked">Blocked</option>
              <option value="Skipped">Skipped</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-xs bg-[hsl(var(--secondary))]/30 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            >
              <option value="all">All Expectation Sources</option>
              <option value="deterministic_invariant">Deterministic Invariant</option>
              <option value="user_requirement">User Requirement</option>
              <option value="behavioral_baseline">Behavioral Baseline</option>
              <option value="llm_hypothesis">AI Hypothesis</option>
            </select>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-[hsl(var(--border))] text-xs">
          <span className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase px-2 shrink-0">
            Category:
          </span>
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
              categoryFilter === 'all'
                ? 'bg-[hsl(var(--primary))] text-white'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]'
            }`}
          >
            All Categories ({testCases.length})
          </button>
          {categories.map(cat => {
            const count = testCases.filter((t: TestCaseDetail) => t.category === cat).length;
            if (count === 0 && categoryFilter !== cat) return null;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
                  categoryFilter === cat
                    ? 'bg-[hsl(var(--primary))] text-white'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]'
                }`}
              >
                {cat.split(' ')[0]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Table / Grid */}
      <div className="bg-white border border-[hsl(var(--border))] rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-[hsl(var(--muted-foreground))] flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[hsl(var(--accent))]" />
            <span>Loading test cases and execution history...</span>
          </div>
        ) : testCases.length === 0 ? (
          <div className="p-12 text-center text-xs text-[hsl(var(--muted-foreground))] space-y-2">
            <FileCheck2 className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="font-semibold text-sm text-[hsl(var(--foreground))]">No test cases found</div>
            <p>Launch a new exploration run to generate and execute autonomous test cases.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[hsl(var(--secondary))]/60 text-[hsl(var(--muted-foreground))] uppercase font-semibold text-[10px] tracking-wider border-b border-[hsl(var(--border))]">
                <tr>
                  <th className="py-3 px-4">Test ID / Title</th>
                  <th className="py-3 px-4">Category & Provenance</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assertions</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {testCases.map((tc: TestCaseDetail) => {
                  const exec = tc.execution;
                  const status = exec?.status || (tc as any).status || 'Pending';
                  const assertionResults = (exec?.assertion_results && exec.assertion_results.length > 0)
                    ? exec.assertion_results
                    : ((tc as any).assertion_results || []);
                  const totalAssertions = assertionResults.length || exec?.assertions?.length || (tc as any).assertions?.length || 0;
                  const passedAssertions = assertionResults.filter((a: any) => a.passed).length;
                  const durationSec = exec?.duration_sec ?? (tc as any).duration_sec ?? 0;

                  return (
                    <tr
                      key={tc.id}
                      onClick={() => handleOpenDetail(tc.id)}
                      className="hover:bg-[hsl(var(--secondary))]/40 transition cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--accent))] transition">
                          {tc.title}
                        </div>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))] font-mono">
                          {tc.id}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[hsl(var(--foreground))]">{tc.category}</div>
                        <div className="mt-0.5">{getSourceBadge(tc.expectation_source)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            tc.priority === 'High'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : tc.priority === 'Medium'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-50 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {tc.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(status)}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs">
                          {passedAssertions}/{totalAssertions}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[hsl(var(--muted-foreground))] font-mono">
                        {durationSec ? `${durationSec.toFixed(1)}s` : '0.0s'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenDetail(tc.id)}
                            className="p-1 rounded hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition"
                            title="Inspect Test Case Timeline"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {tc.run_id && (
                            <button
                              onClick={() => handleSaveRegression(tc.id, tc.run_id)}
                              className="p-1 rounded hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--accent))] transition"
                              title="Save as Regression Test"
                            >
                              <BookmarkPlus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Execution Timeline Modal */}
      {activeTestCase && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[hsl(var(--border))] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            {(() => {
              const exec = activeTestCase.execution;
              const status = exec?.status || (activeTestCase as any).status || 'Pending';
              const steps = (Array.isArray(exec?.steps) && exec.steps.length > 0)
                ? exec.steps
                : (Array.isArray((activeTestCase as any).steps) ? (activeTestCase as any).steps : []);
              const assertionResults = (Array.isArray(exec?.assertion_results) && exec.assertion_results.length > 0)
                ? exec.assertion_results
                : (Array.isArray((activeTestCase as any).assertion_results) ? (activeTestCase as any).assertion_results : []);
              const assertions = (Array.isArray(exec?.assertions) && exec.assertions.length > 0)
                ? exec.assertions
                : (Array.isArray((activeTestCase as any).assertions) ? (activeTestCase as any).assertions : []);
              const durationSec = exec?.duration_sec ?? (activeTestCase as any).duration_sec ?? 0;
              const curiosity = exec?.curiosity_breakdown || (activeTestCase as any).curiosity_breakdown;
              const networkObs = (Array.isArray(exec?.network_observations) && exec.network_observations.length > 0)
                ? exec.network_observations
                : (Array.isArray((activeTestCase as any).network_observations) ? (activeTestCase as any).network_observations : []);
              const relatedBugs = (Array.isArray(activeTestCase.related_bugs) && activeTestCase.related_bugs.length > 0)
                ? activeTestCase.related_bugs
                : ((activeTestCase as any).finding_id ? [{ id: (activeTestCase as any).finding_id, title: activeTestCase.title, severity: activeTestCase.priority, status: 'Confirmed' }] : []);

              return (
                <>
                  <div className="p-5 border-b border-[hsl(var(--border))] flex items-start justify-between bg-[hsl(var(--secondary))]/30">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[hsl(var(--muted-foreground))]">{activeTestCase.id}</span>
                        {getStatusBadge(status)}
                        {getSourceBadge(activeTestCase.expectation_source)}
                      </div>
                      <h2 className="text-lg font-bold text-[hsl(var(--foreground))] tracking-tight">
                        {activeTestCase.title}
                      </h2>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        Category: <span className="font-medium text-[hsl(var(--foreground))]">{activeTestCase.category}</span> • Priority:{' '}
                        <span className="font-medium text-[hsl(var(--foreground))]">{activeTestCase.priority}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTestCase(null)}
                      className="p-1.5 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto space-y-6 text-xs">
                    {/* Objective & Why It Matters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3.5 rounded-xl border border-[hsl(var(--border))] bg-slate-50/50 space-y-1">
                        <div className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--accent))]" />
                          Objective & Autonomous Reasoning
                        </div>
                        <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">
                          {activeTestCase.objective || activeTestCase.title}
                        </p>
                        {activeTestCase.why_it_matters && (
                          <div className="mt-2 text-[11px] text-slate-600 border-t border-slate-200 pt-1.5">
                            <span className="font-semibold">Why this matters:</span> {activeTestCase.why_it_matters}
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 rounded-xl border border-[hsl(var(--border))] bg-slate-50/50 space-y-1">
                        <div className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                          Expected Behavior & Provenance
                        </div>
                        <p className="text-[hsl(var(--muted-foreground))] leading-relaxed">
                          {activeTestCase.expected_result || 'Expected behavior matches documented invariant specification.'}
                        </p>
                        <div className="mt-2 text-[11px] text-slate-600 border-t border-slate-200 pt-1.5">
                          <span className="font-semibold">Expectation Source:</span>{' '}
                          <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {activeTestCase.expectation_source || 'deterministic_invariant'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Curiosity Breakdown if available */}
                    {curiosity && (
                      <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/40 flex items-center justify-between text-purple-900">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-purple-600" />
                          <div>
                            <div className="font-semibold text-xs">Curiosity Engine Prioritization</div>
                            <div className="text-[11px] text-purple-700">
                              {curiosity.reasoning || 'Targeted test synthesized based on state uncertainty and coverage gap.'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-sm">
                            {typeof curiosity.priority_score === 'number' ? curiosity.priority_score.toFixed(2) : '0.85'}
                          </div>
                          <div className="text-[10px] text-purple-600">Priority Score</div>
                        </div>
                      </div>
                    )}

                    {/* Step Execution Timeline */}
                    <div className="space-y-3">
                      <div className="font-semibold text-sm text-[hsl(var(--foreground))] flex items-center justify-between">
                        <span>Ordered Execution Steps ({steps.length})</span>
                        <span className="text-[11px] font-normal text-[hsl(var(--muted-foreground))]">
                          Duration: {durationSec ? durationSec.toFixed(1) : '0.0'}s
                        </span>
                      </div>

                      <div className="space-y-2 border-l-2 border-[hsl(var(--border))] ml-2 pl-4">
                        {steps.length > 0 ? (
                          steps.map((st: any, idx: number) => (
                            <div key={idx} className="relative group">
                              <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[hsl(var(--accent))] border-2 border-white ring-1 ring-[hsl(var(--accent))]" />
                              <div className="p-2.5 rounded-lg border border-[hsl(var(--border))] bg-white hover:border-[hsl(var(--accent))]/50 transition">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-semibold text-xs text-[hsl(var(--foreground))] uppercase">
                                    Step {idx + 1}: {st.action}
                                  </span>
                                  {st.selector && (
                                    <code className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono truncate max-w-xs">
                                      {st.selector}
                                    </code>
                                  )}
                                </div>
                                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{st.description}</div>
                                {st.value && (
                                  <div className="text-[11px] text-slate-600 font-mono mt-1 bg-slate-50 p-1 rounded">
                                    Input value: "{st.value}"
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400 italic">No individual steps recorded for this test case.</div>
                        )}
                      </div>
                    </div>

                    {/* Assertion Results */}
                    <div className="space-y-3">
                      <div className="font-semibold text-sm text-[hsl(var(--foreground))]">
                        Deterministic Invariants & Assertions ({assertionResults.length || assertions.length})
                      </div>

                      <div className="space-y-2">
                        {assertionResults.length > 0 ? (
                          assertionResults.map((asr: any, idx: number) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg border flex items-start gap-3 ${
                                asr.passed
                                  ? 'bg-emerald-50/50 border-emerald-200'
                                  : 'bg-rose-50/50 border-rose-200'
                              }`}
                            >
                              {asr.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-semibold text-xs text-[hsl(var(--foreground))]">
                                    {asr.type}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold uppercase ${
                                      asr.passed ? 'text-emerald-700' : 'text-rose-700'
                                    }`}
                                  >
                                    {asr.passed ? 'Assertion Met' : 'Assertion Violated'}
                                  </span>
                                </div>
                                <div className="text-xs text-[hsl(var(--foreground))]">{asr.message}</div>
                                {asr.actual && (
                                  <div className="text-[11px] font-mono text-[hsl(var(--muted-foreground))] bg-white/70 p-1 rounded border border-slate-200">
                                    Actual observed: {asr.actual}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : assertions.length > 0 ? (
                          assertions.map((asr: any, idx: number) => (
                            <div key={idx} className="p-3 rounded-lg border border-[hsl(var(--border))] bg-slate-50 flex items-start gap-3">
                              <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <span className="font-mono font-semibold text-xs">{asr.type}</span>
                                <div className="text-xs text-slate-600">{asr.message || asr.expected}</div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400 italic">No assertions recorded.</div>
                        )}
                      </div>
                    </div>

                    {/* Network Observations & Console Logs */}
                    {networkObs.length > 0 && (
                      <div className="space-y-2">
                        <div className="font-semibold text-xs text-[hsl(var(--foreground))] flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-slate-600" />
                          Network Activity & API Status
                        </div>
                        <div className="bg-slate-900 text-slate-200 p-3 rounded-lg font-mono text-[11px] max-h-36 overflow-y-auto space-y-1">
                          {networkObs.map((net: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-emerald-400 font-bold">{net.status || 'REQ'}</span>
                              <span className="text-slate-400">{net.method || 'GET'}</span>
                              <span className="truncate">{net.url}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Related Bugs or Saved Regression */}
                    {relatedBugs.length > 0 && (
                      <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2">
                        <div className="font-semibold text-xs text-rose-900 flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          Associated Bug Finding
                        </div>
                        {relatedBugs.map((bug: any) => (
                          <div key={bug.id} className="text-xs text-rose-800 flex items-center justify-between">
                            <span>{bug.title} ({bug.severity})</span>
                            <a
                              href={`/bugs/${bug.id}`}
                              className="text-rose-700 hover:underline flex items-center gap-1 font-semibold"
                            >
                              <span>View Bug Finding</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Modal Footer */}
            <div className="p-4 border-t border-[hsl(var(--border))] bg-white flex items-center justify-between">
              <div className="text-[11px] text-[hsl(var(--muted-foreground))]">
                Autonomous test case executed in clean isolated Playwright context.
              </div>
              <div className="flex items-center gap-2">
                {activeTestCase.run_id && (
                  <button
                    onClick={() => handleSaveRegression(activeTestCase.id, activeTestCase.run_id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] text-xs font-medium text-[hsl(var(--foreground))] transition"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 text-[hsl(var(--accent))]" />
                    <span>Promote to Regression Test</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveTestCase(null)}
                  className="px-4 py-1.5 rounded-lg bg-[hsl(var(--primary))] text-white text-xs font-medium hover:bg-[hsl(var(--primary))]/90 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Step Evidence Viewer Modal */}
      {selectedStepForEvidence && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">
                  STEP #{selectedStepForEvidence.step_index + 1}
                </span>
                <span className="font-mono font-bold text-sm text-sky-400 uppercase">
                  {selectedStepForEvidence.action}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold ${
                    selectedStepForEvidence.status === 'Failed'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  }`}
                >
                  {selectedStepForEvidence.status || 'Executed'}
                </span>
                {selectedStepForEvidence.screenshot_annotated_url && (
                  <span className="text-xs px-2 py-0.5 rounded bg-rose-600 text-white font-bold animate-pulse">
                    PULSED FAILURE REGION
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Previous Step Navigation */}
                {(() => {
                  const currIdx = selectedStepForEvidence.step_index;
                  const prevStep = stepExecutions.find(s => s.step_index === currIdx - 1);
                  const nextStep = stepExecutions.find(s => s.step_index === currIdx + 1);

                  return (
                    <div className="flex items-center gap-1.5 mr-2">
                      <button
                        type="button"
                        disabled={!prevStep}
                        onClick={() => prevStep && setSelectedStepForEvidence(prevStep)}
                        className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition ${
                          prevStep
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            : 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev Step</span>
                      </button>
                      <button
                        type="button"
                        disabled={!nextStep}
                        onClick={() => nextStep && setSelectedStepForEvidence(nextStep)}
                        className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 transition ${
                          nextStep
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            : 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <span>Next Step</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })()}

                <button
                  onClick={() => setSelectedStepForEvidence(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Description & Route Metadata */}
            <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs flex items-center justify-between text-slate-300">
              <div>
                <span className="text-slate-400 font-medium">Action Description:</span>{' '}
                <span className="text-white font-semibold">{selectedStepForEvidence.description}</span>
                {selectedStepForEvidence.selector && (
                  <code className="ml-2 text-sky-400 bg-slate-950 px-1.5 py-0.5 rounded text-[11px]">
                    {selectedStepForEvidence.selector}
                  </code>
                )}
              </div>
              <div className="font-mono text-slate-400 text-[11px]">
                Duration: {selectedStepForEvidence.duration_sec?.toFixed(2) || '0.00'}s
              </div>
            </div>

            {/* Evidence Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Pre vs Post Action Comparison */}
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Side-by-Side Journey State: Pre-Action vs Post-Action</span>
                  <span className="text-[11px] text-slate-500 font-normal">Click any screenshot to zoom</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Before */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Pre-Action Baseline (Before)
                      </span>
                      {selectedStepForEvidence.screenshot_before_url && (
                        <button
                          type="button"
                          onClick={() => setZoomImage({ url: selectedStepForEvidence.screenshot_before_url!, title: 'Pre-Action Screenshot' })}
                          className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>Expand</span>
                        </button>
                      )}
                    </div>
                    {selectedStepForEvidence.screenshot_before_url ? (
                      <img
                        src={selectedStepForEvidence.screenshot_before_url}
                        alt="Pre-action screenshot"
                        onClick={() => setZoomImage({ url: selectedStepForEvidence.screenshot_before_url!, title: 'Pre-Action Screenshot' })}
                        className="w-full h-auto rounded-lg border border-slate-800 cursor-zoom-in hover:opacity-95 transition"
                      />
                    ) : (
                      <div className="h-44 flex items-center justify-center text-slate-500 italic border border-slate-800/60 rounded-lg">
                        Pre-action screenshot not captured for this action.
                      </div>
                    )}
                    {selectedStepForEvidence.url_before && (
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        Route: {selectedStepForEvidence.url_before}
                      </div>
                    )}
                  </div>

                  {/* After */}
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-400 text-xs flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-sky-400" />
                        Post-Action State (After)
                      </span>
                      {selectedStepForEvidence.screenshot_after_url && (
                        <button
                          type="button"
                          onClick={() => setZoomImage({ url: selectedStepForEvidence.screenshot_after_url!, title: 'Post-Action Screenshot' })}
                          className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>Expand</span>
                        </button>
                      )}
                    </div>
                    {selectedStepForEvidence.screenshot_after_url ? (
                      <img
                        src={selectedStepForEvidence.screenshot_after_url}
                        alt="Post-action screenshot"
                        onClick={() => setZoomImage({ url: selectedStepForEvidence.screenshot_after_url!, title: 'Post-Action Screenshot' })}
                        className="w-full h-auto rounded-lg border border-slate-800 cursor-zoom-in hover:opacity-95 transition"
                      />
                    ) : (
                      <div className="h-44 flex items-center justify-center text-slate-500 italic border border-slate-800/60 rounded-lg">
                        Post-action screenshot not captured for this action.
                      </div>
                    )}
                    {selectedStepForEvidence.url_after && (
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        Route: {selectedStepForEvidence.url_after}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Defect Highlight Section if Annotated Screenshot Exists */}
              {(selectedStepForEvidence.screenshot_annotated_url || selectedStepForEvidence.screenshot_failure_url) && (
                <div className="p-4 rounded-xl border-2 border-rose-500/60 bg-rose-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span className="font-bold text-rose-300 text-sm">
                        Visual Failure Analysis & Exact Region Highlight
                      </span>
                    </div>
                    <span className="text-[10px] bg-rose-500 text-white font-bold px-2 py-0.5 rounded animate-pulse">
                      ORIGINAL PRESERVED &bull; ANNOTATED COPY GENERATED
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedStepForEvidence.screenshot_failure_url && (
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-slate-300">Observed Failure (Original Unmodified)</div>
                        <img
                          src={selectedStepForEvidence.screenshot_failure_url}
                          alt="Failure Screenshot"
                          onClick={() => setZoomImage({ url: selectedStepForEvidence.screenshot_failure_url!, title: 'Original Failure Screenshot' })}
                          className="w-full h-auto rounded-lg border border-slate-700 cursor-zoom-in"
                        />
                      </div>
                    )}

                    {selectedStepForEvidence.screenshot_annotated_url && (
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-rose-300 flex items-center gap-1">
                          <span>Visual Defect Highlight (Contrasting Bounding Box)</span>
                        </div>
                        <img
                          src={selectedStepForEvidence.screenshot_annotated_url}
                          alt="Annotated Failure Screenshot"
                          onClick={() => setZoomImage({ url: selectedStepForEvidence.screenshot_annotated_url!, title: 'Annotated Failure Highlight' })}
                          className="w-full h-auto rounded-lg border-2 border-rose-500 shadow-lg cursor-zoom-in"
                        />
                        <p className="text-[10px] text-rose-200/80 mt-1">
                          Defective element or region marked with contrasting red boundary and translucent alert overlay.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step Invariant Assertions */}
              {Array.isArray(selectedStepForEvidence.assertion_results) && selectedStepForEvidence.assertion_results.length > 0 && (
                <div className="space-y-2">
                  <div className="font-bold text-slate-400 text-xs uppercase tracking-wider">
                    Assertions Evaluated at this Step ({selectedStepForEvidence.assertion_results.length})
                  </div>
                  <div className="space-y-1.5">
                    {selectedStepForEvidence.assertion_results.map((asr: any, aIdx: number) => (
                      <div
                        key={aIdx}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                          asr.passed
                            ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                            : 'bg-rose-950/40 border-rose-800 text-rose-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {asr.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          <span className="font-mono">{asr.type}</span>
                          <span className="text-slate-300">{asr.message}</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase">
                          {asr.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Proof-Carrying Screenshot Evidence &bull; Preserved in isolated artifact storage
              </span>
              <button
                type="button"
                onClick={() => setSelectedStepForEvidence(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition"
              >
                Back to Journey Timeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Zoom Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-70 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <div className="max-w-6xl w-full flex items-center justify-between text-white pb-3" onClick={e => e.stopPropagation()}>
            <span className="font-semibold text-sm">{zoomImage.title}</span>
            <button
              onClick={() => setZoomImage(null)}
              className="text-slate-400 hover:text-white px-3 py-1 bg-slate-800 rounded-lg text-xs"
            >
              Close Zoom (ESC)
            </button>
          </div>
          <div className="max-w-6xl max-h-[85vh] overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-2" onClick={e => e.stopPropagation()}>
            <img src={zoomImage.url} alt={zoomImage.title} className="w-full h-auto object-contain rounded-lg shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
};
