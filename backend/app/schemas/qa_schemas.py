from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class RunCreateRequest(BaseModel):
    target_url: str = Field(..., description="Target web application URL")
    description: str = Field(..., description="Natural language specification of application behavior")
    objectives: List[str] = Field(default_factory=lambda: ["Functional testing", "Form validation", "Navigation testing"])
    boundaries: Dict[str, Any] = Field(default_factory=lambda: {
        "max_pages": 10,
        "max_actions": 30,
        "max_duration_sec": 300,
        "max_retries": 2
    })
    mode: str = Field(default="demo", description="'demo' or 'ai'")
    test_mode: str = Field(default="universal_exploratory", description="'universal_exploratory' or 'deep_verification'")
    baseline_profile: str = Field(default="default", description="Baseline expectations profile")
    username: Optional[str] = None
    password: Optional[str] = None

class TestStepSchema(BaseModel):
    __test__ = False
    action: str = Field(..., description="goto, click, fill, select, check, wait, assert, screenshot, refresh")
    selector: Optional[str] = None
    value: Optional[str] = None
    description: str = Field(..., description="Human readable description of action")

class AssertionSchema(BaseModel):
    type: str = Field(..., description="element_visible, text_contains, value_matches, url_contains, not_visible, cart_total_matches, element_disabled, element_enabled, state_persists_on_refresh")
    target: str = Field(..., description="CSS selector, element text, or URL property")
    expected: Optional[str] = None
    message: Optional[str] = None

class CuriosityBreakdown(BaseModel):
    impact: float = 0.8
    uncertainty: float = 0.5
    novelty: float = 0.7
    coverage_gap: float = 0.9
    priority_score: float = 0.85
    reasoning: str = ""

class TestCaseCreate(BaseModel):
    __test__ = False
    test_id: str
    title: str
    objective: Optional[str] = None
    category: str = "Functional behavior and navigation"
    priority: str = "High"
    preconditions: Optional[str] = None
    steps: List[TestStepSchema]
    test_data: Dict[str, Any] = Field(default_factory=dict)
    assertions: List[AssertionSchema]
    expectation_source: str = "deterministic_invariant"
    baseline_id: Optional[str] = None
    cleanup_requirements: List[Dict[str, Any]] = Field(default_factory=list)
    risk_reason: str
    curiosity: Optional[CuriosityBreakdown] = None
    regression_candidate: bool = True

class TestPlanOutput(BaseModel):
    __test__ = False
    rationale: str
    test_cases: List[TestCaseCreate]

class RunEventResponse(BaseModel):
    id: str
    run_id: str
    timestamp: str
    stage: str
    agent_role: str
    event_type: str
    message: str
    details: Dict[str, Any]

class ExploredControl(BaseModel):
    tag: str
    type: Optional[str] = None
    id: Optional[str] = None
    name: Optional[str] = None
    text: Optional[str] = None
    selector: str
    role: Optional[str] = None

class ExploredPageResponse(BaseModel):
    id: str
    url: str
    title: Optional[str] = None
    status: str
    discovered_controls: List[Dict[str, Any]] = []
    navigation_links: List[str] = []
    depth: int = 0

class BugFindingResponse(BaseModel):
    id: str
    run_id: str
    test_execution_id: Optional[str] = None
    dedup_key: Optional[str] = None
    title: str
    description: str
    affected_url: str
    category: str = "Functional behavior and navigation"
    severity: str
    severity_reason: Optional[str] = None
    status: str # Confirmed, Suspected, Inconclusive, Dismissed, Verified, Likely, Not reproduced
    confidence_score: float
    trust_score: float = 0.90
    trust_breakdown: Dict[str, Any] = Field(default_factory=dict)
    verification_notes: Optional[str] = None
    expected_behavior: str
    expectation_source: str = "Deterministic Invariant"
    expectation_justification: Optional[str] = None
    actual_behavior: str
    reproduction_steps: List[str]
    reproduction_attempts: int = 1
    reproduction_outcomes: List[Dict[str, Any]] = Field(default_factory=list)
    detection_method: str = "deterministic_assertion"
    likely_cause_hypothesis: Optional[str] = None
    suggested_fix: Optional[str] = None
    alternative_explanations: Optional[str] = None
    screenshot_url: Optional[str] = None
    annotated_screenshot_url: Optional[str] = None
    screenshot_before_url: Optional[str] = None
    screenshot_after_url: Optional[str] = None
    failed_step_index: Optional[int] = None
    console_errors: List[str] = []
    network_status: Dict[str, Any] = Field(default_factory=dict)
    regression_test_id: Optional[str] = None
    replay_attempts: int = 1
    created_at: str

class TestStepExecutionResponse(BaseModel):
    step_index: int
    action: str
    description: str
    selector: Optional[str] = None
    value: Optional[str] = None
    url_before: Optional[str] = None
    url_after: Optional[str] = None
    duration_sec: float = 0.0
    status: str = "Passed"
    error_message: Optional[str] = None
    screenshot_before_id: Optional[str] = None
    screenshot_after_id: Optional[str] = None
    screenshot_failure_id: Optional[str] = None
    screenshot_annotated_id: Optional[str] = None
    screenshot_urls: Dict[str, Optional[str]] = Field(default_factory=dict)
    assertion_results: List[Dict[str, Any]] = Field(default_factory=list)

class TestExecutionResponse(BaseModel):
    __test__ = False
    id: str
    test_case_id: str
    title: str
    objective: Optional[str] = None
    category: str
    priority: str
    priority_score: float
    status: str # Passed, Failed, Blocked, Skipped, Inconclusive
    duration_sec: float
    retry_count: int
    preconditions: Optional[str] = None
    steps: List[Dict[str, Any]] = []
    test_data: Dict[str, Any] = Field(default_factory=dict)
    assertions: List[Dict[str, Any]] = []
    expectation_source: str = "deterministic_invariant"
    baseline_id: Optional[str] = None
    actual_observations: Optional[str] = None
    assertion_results: List[Dict[str, Any]] = []
    screenshot_urls: List[str] = []
    step_records: List[Dict[str, Any]] = Field(default_factory=list)
    console_logs: List[str] = []
    network_observations: List[Dict[str, Any]] = Field(default_factory=list)
    finding_id: Optional[str] = None
    risk_reason: Optional[str] = None
    curiosity_breakdown: Optional[Dict[str, Any]] = None
    regression_eligible: Optional[bool] = False
    created_at: Optional[str] = None

class RunSummaryResponse(BaseModel):
    id: str
    target_url: str
    description: str
    status: str
    mode: str
    test_mode: str = "universal_exploratory"
    baseline_profile: str = "default"
    objectives: List[str] = []
    start_time: str
    end_time: Optional[str] = None
    duration_sec: float
    total_tests: int
    passed_count: int
    failed_count: int
    blocked_count: int
    findings_count: int
    error_summary: Optional[str] = None

class RegressionTestResponse(BaseModel):
    id: str
    name: str
    target_url: str
    original_run_id: Optional[str] = None
    original_test_id: Optional[str] = None
    provenance: str = "passing_journey"
    is_approved: bool = True
    steps_count: int
    assertions_count: int
    created_at: str
    last_run_at: Optional[str] = None
    last_status: str
    executions_count: int
    structured_steps: Optional[List[Dict[str, Any]]] = None
    assertions: Optional[List[Dict[str, Any]]] = None

class RegressionRunResultResponse(BaseModel):
    execution_id: str
    test_id: str
    status: str
    previous_status: Optional[str] = None
    duration_sec: float
    diff_summary: str
    executed_at: str

class BaselineCreateRequest(BaseModel):
    name: str
    target_domain: str
    category: str = "Business-rule Invariant"
    source_type: str = "user_requirement" # user_requirement, business_rule, deterministic_invariant, known_good_reference, provisional_ai_hypothesis
    version: str = "v1.0"
    rule_definition: Dict[str, Any]
    expected_state: Dict[str, Any]
    is_approved: bool = True
    notes: Optional[str] = None

class BaselineResponse(BaseModel):
    id: str
    name: str
    target_domain: str
    category: str
    source_type: str
    version: str
    rule_definition: Dict[str, Any]
    expected_state: Dict[str, Any]
    is_approved: bool
    notes: Optional[str] = None
    created_at: str
