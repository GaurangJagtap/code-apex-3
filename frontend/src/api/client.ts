import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface RunSummary {
  id: string;
  target_url: string;
  description: string;
  status: string;
  mode: string;
  start_time: string;
  end_time?: string;
  duration_sec: number;
  total_tests: number;
  passed_count: number;
  failed_count: number;
  blocked_count: number;
  findings_count: number;
  error_summary?: string;
}

export interface RunEvent {
  id: string;
  run_id: string;
  timestamp: string;
  stage: string;
  agent_role: string;
  event_type: string;
  message: string;
  details: Record<string, any>;
}

export interface ExploredPage {
  id: string;
  url: string;
  title?: string;
  status: string;
  discovered_controls: Array<{
    tag: string;
    type?: string;
    role?: string;
    selector: string;
    text?: string;
  }>;
  navigation_links: string[];
  depth: number;
}

export interface TestCaseExecution {
  id: string;
  test_case_id: string;
  title: string;
  category: string;
  priority: string;
  priority_score: number;
  status: string;
  duration_sec: number;
  retry_count: number;
  preconditions?: string;
  steps: Array<{ action: string; selector?: string; value?: string; description: string }>;
  assertions: Array<{ type: string; target: string; expected?: string; message?: string }>;
  actual_observations?: string;
  assertion_results: Array<{ type: string; passed: boolean; actual: string; message: string }>;
  screenshot_urls: string[];
  console_logs: string[];
  finding_id?: string;
  risk_reason?: string;
  curiosity_breakdown?: {
    impact: number;
    uncertainty: number;
    novelty: number;
    coverage_gap: number;
    priority_score: number;
    reasoning: string;
  };
  regression_eligible?: boolean;
}

export interface TestCaseDetail {
  id: string;
  run_id: string;
  title: string;
  objective?: string;
  category: string;
  priority: string;
  preconditions?: string;
  test_data?: Record<string, any>;
  cleanup_requirements?: string;
  expectation_source?: string;
  expected_result?: string;
  baseline_id?: string;
  risk_level?: string;
  why_it_matters?: string;
  evidence_needed?: string;
  status?: string;
  duration_sec?: number;
  priority_score?: number;
  steps?: Array<{ action: string; selector?: string; value?: string; description: string }>;
  assertions?: Array<{ type: string; target: string; expected?: string; message?: string }>;
  assertion_results?: Array<{ type: string; passed: boolean; actual: string; message: string }>;
  curiosity_breakdown?: any;
  risk_reason?: string;
  execution?: {
    id: string;
    status: string;
    duration_sec: number;
    steps: Array<{ action: string; selector?: string; value?: string; description: string }>;
    assertions: Array<{ type: string; target: string; expected?: string; message?: string }>;
    assertion_results: Array<{ type: string; passed: boolean; actual: string; message: string }>;
    actual_observations?: string;
    network_observations?: Array<Record<string, any>>;
    console_logs: string[];
    screenshot_urls: string[];
    finding_id?: string;
    regression_eligible?: boolean;
    curiosity_breakdown?: {
      impact: number;
      uncertainty: number;
      novelty: number;
      coverage_gap: number;
      priority_score: number;
      reasoning: string;
    };
  };
  related_bugs?: BugFinding[];
  saved_regression?: RegressionTest;
}

export interface BehavioralBaseline {
  id: string;
  title: string;
  domain: string;
  category: string;
  rule_type: string;
  version: string;
  source: string;
  expected_behavior: string;
  invariant_rule?: string;
  is_approved: boolean;
  created_at: string;
}

export interface BaselineCreatePayload {
  title: string;
  domain: string;
  category: string;
  rule_type: string;
  expected_behavior: string;
  invariant_rule?: string;
  source?: string;
}

export interface BugFinding {
  id: string;
  run_id: string;
  test_execution_id?: string;
  title: string;
  description: string;
  affected_url: string;
  category?: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  severity_reason?: string;
  status: 'Confirmed' | 'Suspected' | 'Inconclusive' | 'Dismissed' | 'Verified' | 'Likely' | 'Not reproduced' | 'Not Reproducible';
  confidence_score: number;
  trust_score?: number;
  trust_breakdown?: {
    expectation_strength?: number;
    evidence_completeness?: number;
    reproducibility?: number;
    deterministic_verification?: number;
    alternative_explanations_penalty?: number;
    total_trust_score?: number;
    rationale?: string;
    signals?: string[];
  };
  verification_notes?: string;
  expected_behavior: string;
  actual_behavior: string;
  expectation_source?: string;
  expectation_justification?: string;
  detection_method?: string;
  likely_cause_hypothesis?: string;
  suggested_fix?: string;
  alternative_explanations?: string[] | string;
  reproduction_steps: string[] | string;
  reproduction_outcomes?: Array<{
    attempt: number;
    passed?: boolean;
    clean_context?: boolean;
    outcome?: string;
    status?: string;
    timestamp?: string;
  }> | string;
  screenshot_url?: string;
  annotated_screenshot_url?: string;
  screenshot_before_url?: string;
  screenshot_after_url?: string;
  failed_step_index?: number;
  console_errors: string[] | string;
  network_status?: Record<string, any>;
  regression_test_id?: string;
  replay_attempts: number;
  created_at: string;
}

export interface SampleTarget {
  id: string;
  name: string;
  brand: string;
  category: string;
  base_url: string;
  description: string;
  seeded_defect_count: number;
  expected_duration: string;
  workflows: string[];
  suggested_objectives: string[];
  reset_url: string;
}

export interface TestStepExecution {
  id: string;
  run_id: string;
  test_case_id: string;
  step_index: number;
  action: string;
  description: string;
  selector?: string;
  value?: string;
  status: string;
  duration_sec: number;
  url_before?: string;
  url_after?: string;
  assertion_results?: Array<{ type: string; passed: boolean; actual: string; message: string }>;
  error_message?: string;
  screenshot_before_url?: string;
  screenshot_after_url?: string;
  screenshot_failure_url?: string;
  screenshot_annotated_url?: string;
  created_at?: string;
}

export interface RegressionTest {
  id: string;
  name: string;
  target_url: string;
  original_run_id?: string;
  original_test_id?: string;
  steps_count: number;
  assertions_count: number;
  created_at: string;
  last_run_at?: string;
  last_status: string;
  executions_count: number;
  is_approved?: boolean;
  approval_status?: string;
  provenance?: string;
  structured_steps?: Array<{ action: string; selector?: string; value?: string; description: string }>;
  assertions?: Array<{ type: string; target: string; expected?: string; message?: string }>;
}

export interface RegressionRunResult {
  execution_id: string;
  test_id: string;
  status: string;
  previous_status?: string;
  duration_sec: number;
  diff_summary: string;
  executed_at: string;
}

export interface ConfigStatus {
  llm_provider: string;
  llm_model: string;
  api_key_configured: boolean;
  api_key_masked: string;
  demo_mode_active: boolean;
  allowed_hosts: string[];
  boundaries: {
    max_pages: number;
    max_actions: number;
    max_duration_sec: number;
    max_retries: number;
  };
}

export interface RegressionSuiteResult {
  total_executed: number;
  passed: number;
  failed: number;
  regressions_detected: number;
  fixes_detected: number;
  details: Array<{
    test_id: string;
    name: string;
    status: string;
    previous_status?: string;
    duration_sec: number;
    diff_summary: string;
  }>;
  executed_at: string;
  message?: string;
}

export interface BenchmarkMetrics {
  defect_recall: number;
  defect_recall_percent: string;
  precision: number;
  precision_percent: string;
  reproducibility_rate: number;
  reproducibility_percent: string;
  journey_coverage: number;
  journey_coverage_percent: string;
  screenshot_coverage?: number;
  screenshot_coverage_percent?: string;
  annotated_failure_coverage?: number;
  annotated_failure_coverage_percent?: string;
  total_executed_steps?: number;
  steps_with_screenshot?: number;
  total_failed_steps?: number;
  failed_with_annotated?: number;
  true_positives: number;
  false_positives: number;
  total_planted_defects: number;
  total_findings_reported: number;
  duration_sec: number;
  total_tests_executed: number;
}

export interface BenchmarkDefectItem {
  defect_id: string;
  title: string;
  category: string;
  criticality: string;
  status: 'Detected' | 'Missed';
  verification_status: string;
  confidence: number;
  finding_id?: string;
  replays: number;
}

export interface BenchmarkReport {
  run_id: string;
  target_url: string;
  evaluated_at: string;
  metrics: BenchmarkMetrics;
  defect_matrix: BenchmarkDefectItem[];
  unmatched_findings: Array<{ id: string; title: string; affected_url: string; status: string }>;
  benchmark_journeys: Array<{ journey_id: string; name: string; path: string; covered: boolean }>;
}

export interface GroundTruthRegistry {
  planted_defects: Array<{
    defect_id: string;
    category: string;
    title: string;
    affected_path: string;
    expected_behavior: string;
    actual_behavior: string;
    criticality: string;
  }>;
  benchmark_journeys: Array<{ journey_id: string; name: string; path: string }>;
  total_planted: number;
  total_journeys: number;
}

export const fetchHealth = () => api.get('/health').then(res => res.data);
export const fetchConfigStatus = () => api.get<ConfigStatus>('/config/status').then(res => res.data);

export const createRun = (data: {
  target_url: string;
  description: string;
  objectives: string[];
  boundaries?: Record<string, any>;
  mode?: string;
  test_mode?: string;
  baseline_profile?: string;
}) => api.post<{ run_id: string; status: string; mode: string }>('/runs', data).then(res => res.data);

export const fetchRuns = () => api.get<RunSummary[]>('/runs').then(res => res.data);
export const fetchRun = (id: string) => api.get<RunSummary>(`/runs/${id}`).then(res => res.data);
export const fetchRunEvents = (id: string) => api.get<RunEvent[]>(`/runs/${id}/events`).then(res => res.data);
export const fetchRunTests = (id: string) => api.get<TestCaseExecution[]>(`/runs/${id}/tests`).then(res => res.data);
export const fetchRunExploration = (id: string) => api.get<ExploredPage[]>(`/runs/${id}/exploration`).then(res => res.data);
export const fetchRunSiteMap = (id: string) => api.get<{ nodes: any[]; edges: any[]; total_nodes: number; total_edges: number }>(`/runs/${id}/site-map`).then(res => res.data);
export const cancelRun = (id: string) => api.post(`/runs/${id}/cancel`).then(res => res.data);

// Test Cases API
export const fetchTestCases = (params?: {
  run_id?: string;
  status?: string;
  category?: string;
  priority?: string;
  source?: string;
  search?: string;
}) => api.get<TestCaseDetail[]>('/test-cases', { params }).then(res => res.data);

export const fetchTestCase = (id: string) =>
  api.get<TestCaseDetail>(`/test-cases/${id}`).then(res => res.data);

// Baselines API
export const fetchBaselines = (params?: { domain?: string; category?: string }) =>
  api.get<BehavioralBaseline[]>('/baselines', { params }).then(res => res.data);

export const createBaseline = (payload: BaselineCreatePayload) =>
  api.post<BehavioralBaseline>('/baselines', payload).then(res => res.data);

export const approveBaseline = (id: string) =>
  api.post<{ message: string; id: string }>(`/baselines/${id}/approve`).then(res => res.data);

export const fetchBugs = (params?: { severity?: string; status?: string; category?: string; search?: string }) =>
  api.get<BugFinding[]>('/bugs', { params }).then(res => res.data);
export const fetchBug = (id: string) => api.get<BugFinding>(`/bugs/${id}`).then(res => res.data);
export const fetchRunBugs = (runId: string) => api.get<BugFinding[]>(`/runs/${runId}/bugs`).then(res => res.data);

export const fetchRegressionTests = () => api.get<RegressionTest[]>('/regression-tests').then(res => res.data);
export const saveRegressionTest = (testId: string, runId: string) =>
  api.post<{ id: string; message: string }>(`/regression-tests?test_id=${testId}&run_id=${runId}`).then(res => res.data);
export const approveRegressionTest = (testId: string) =>
  api.post<{ message: string; id: string }>(`/regression-tests/${testId}/approve`).then(res => res.data);
export const rerunRegressionTest = (testId: string) =>
  api.post<RegressionRunResult>(`/regression-tests/${testId}/run`).then(res => res.data);
export const rerunAllRegressionTests = () =>
  api.post<RegressionSuiteResult>('/regression-tests/run-all').then(res => res.data);
export const autoPromoteRegressionTests = () =>
  api.post<{ added_count: number; total_count: number; message: string }>('/regression-tests/auto-promote').then(res => res.data);
export const deleteRegressionTest = (testId: string) =>
  api.delete<{ id: string; message: string }>(`/regression-tests/${testId}`).then(res => res.data);

export const fetchBenchmarkGroundTruth = (suite: string = 'devstore') =>
  api.get<GroundTruthRegistry>(`/benchmark/ground-truth?suite=${encodeURIComponent(suite)}`).then(res => res.data);
export const fetchRunBenchmarkResults = (runId: string, suite: string = 'devstore') =>
  api.get<BenchmarkReport>(`/benchmark/results/${runId}?suite=${encodeURIComponent(suite)}`).then(res => res.data);
export const runBenchmarkSuite = (targetUrl: string = 'http://127.0.0.1:5001', suite: string = 'devstore') =>
  api.post<BenchmarkReport>(`/benchmark/run?target_url=${encodeURIComponent(targetUrl)}&suite=${encodeURIComponent(suite)}`).then(res => res.data);

// Target Registry & Multi-App Management
export const fetchSampleTargets = () =>
  api.get<SampleTarget[]>('/targets').then(res => res.data);
export const resetTarget = (targetId: string) =>
  api.post<{ success: boolean; message: string }>(`/targets/${targetId}/reset`).then(res => res.data);

// Step-by-Step Evidence
export const fetchRunStepExecutions = (runId: string) =>
  api.get<TestStepExecution[]>(`/runs/${runId}/steps`).then(res => res.data);
export const fetchTestStepExecutions = (testId: string) =>
  api.get<TestStepExecution[]>(`/tests/${testId}/steps`).then(res => res.data);
export const getRunExportUrl = (runId: string, format: string = 'html') =>
  `/api/v1/runs/${runId}/export?format=${format}`;
export const getBugExportUrl = (bugId: string, format: string = 'html') =>
  `/api/v1/bugs/${bugId}/export?format=${format}`;

// Sample App Defect Toggle Helper (Direct to sample app 5001 or through proxy)
export const fetchSampleAppDefects = () =>
  axios.get('http://127.0.0.1:5001/api/defects').then(res => res.data).catch(() => null);
export const toggleSampleAppDefects = (params?: { enabled?: boolean; defect_id?: string }) =>
  axios.post('http://127.0.0.1:5001/api/defects/toggle', params || {}).then(res => res.data).catch(() => null);

// Real-Time Event Stream via Server-Sent Events (SSE)
export const createRunEventSource = (
  runId: string,
  onEvent: (event: RunEvent) => void,
  onTerminal?: (status: string) => void,
  onError?: (err: any) => void
): (() => void) => {
  const eventSource = new EventSource(`/api/v1/runs/${runId}/events/stream`);

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.stage === 'terminal') {
        if (onTerminal) onTerminal(data.run_status || 'completed');
        eventSource.close();
      } else {
        onEvent(data as RunEvent);
      }
    } catch (err) {
      console.error('Error parsing SSE event data:', err);
    }
  };

  eventSource.onerror = (err) => {
    if (onError) onError(err);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
};

export default api;
