# Autonomous AI QA Engineer &mdash; Technical & Architectural Documentation
**Track:** iMocha IM-02 | Autonomous AI Software Testing Assistant  
**Repository:** [https://github.com/adityathakareee/Autonomous-AI-QA-Engineer](https://github.com/adityathakareee/Autonomous-AI-QA-Engineer)

---

## 1. Executive Summary & Vision

**Autonomous AI QA Engineer** is a production-grade, agentic software testing assistant designed to eliminate the fragility, high maintenance cost, and flakiness of traditional manual scripting. 

Instead of requiring engineers to write brittle Cypress/Selenium scripts, the platform:
1. **Discovers:** Autonomously explores any web application using real Playwright Chromium instances.
2. **Prioritizes:** Mathematically evaluates candidate testing paths via an explainable **Curiosity Engine**.
3. **Executes:** Runs multi-step user journeys and checks deterministic DOM and arithmetic assertions.
4. **Captures Step Evidence:** Records pre-action and post-action screenshots for every meaningful step, persisting execution duration, URL transitions, and element selectors.
5. **Visually Highlights Defects:** When a failure occurs, the **ImageAnnotator** draws a contrasting alert bounding box, label badge, and translucent overlay around the exact failing element while preserving the original screenshot.
6. **Verifies:** Replays failures in clean, isolated browser contexts to eliminate false alarms and confirm reproducible defects.
7. **Preserves:** Converts verified journeys into reusable, zero-script **Regression Test Suites**.
8. **Audits:** Measures defect detection against known planted defects via an audited **Ground-Truth Benchmark** tracking Defect Recall, Precision, Reproducibility, Journey Coverage, **Screenshot Coverage (%)**, and **Annotated Failure Coverage (%)**.

---

## 2. The Two Primary Differentiators (USPs)

### USP 1 &mdash; Realistic, Multi-Page Test Targets
The platform embeds three distinct, locally hosted demonstration targets with multi-route workflows, form validation, state persistence, and deterministic seeded defects:

#### A. AssessPro (`http://127.0.0.1:5001/assesspro`)
- **Domain:** iMocha-style online talent assessment and candidate examination platform.
- **Candidate Workflows:** Candidate sign-in, instructions acknowledgment, access code format validation, timed examination with real-time countdown timer, multi-question navigation with dynamic answered/unanswered question palette, answer persistence across page reloads, rapid double-click single-submission idempotency, score computation against answer key.
- **Recruiter Workflows:** Recruiter evaluation dashboard with candidate attempt status, test scores, and unauthenticated access control.
- **Seeded Defects:**
  - `AP-BUG-01`: Candidate answers reset to empty on page reload during active exam.
  - `AP-BUG-02`: Rapid double-click on exam submit creates duplicate completed attempt records.
  - `AP-BUG-03`: Score calculation arithmetic desync underreports candidate's correct score against answer key.
  - `AP-BUG-04`: Recruiter evaluation dashboard served to anonymous visits without authentication.
  - `AP-BUG-05`: Access code boundary bypass admits candidates with blank or malformed codes.

#### B. QuickBite (`http://127.0.0.1:5001/quickbite`)
- **Domain:** On-demand food-delivery platform with complex end-to-end ordering journeys.
- **Ordering Workflows:** Restaurant discovery, cuisine filtering, restaurant menu browsing, dynamic cart item addition/removal, quantity increment with live subtotal/tax/delivery recalculation, delivery address form with required postal/phone boundary validation, local payment simulator with selectable outcomes (Success, Declined, Pending, Double-Click), order confirmation page, and live GPS order status tracking with order history.
- **Seeded Defects:**
  - `QB-BUG-01`: Cart quantity increment fails to recalculate subtotal.
  - `QB-BUG-02`: Missing validation on required postal/ZIP code in delivery address form.
  - `QB-BUG-03`: Rapid double-click checkout creates duplicate orders with separate IDs.
  - `QB-BUG-04`: Payment simulator declined transaction falsely confirmed.
  - `QB-BUG-05`: Inconsistent order status between confirmation screen ('CONFIRMED') and persisted backend state ('CANCELLED').

#### C. DevStore (`http://127.0.0.1:5001`)
- **Domain:** Full-stack e-commerce benchmark target.
- **Seeded Defects:**
  - `BUG-01`: Faulty email validation accepting format without `@` or domain.
  - `BUG-02`: Shopping cart arithmetic desync on quantity update.
  - `BUG-03`: Missing required postal code validation on checkout logistics form.
  - `BUG-04`: Non-idempotent duplicate order creation on rapid submit.
  - `BUG-05`: Broken access control on `/account` route.

---

### USP 2 &mdash; Complete Step-by-Step Screenshot Evidence & Visual Defect Highlighting
Every executed test journey records complete chronological step evidence:

1. **Explicit Step-Evidence Data Model (`TestStepExecution`):**
   - `id`: Unique step execution UUID.
   - `run_id`: Test run association.
   - `test_case_id`: Test case association.
   - `step_index`: Zero-indexed position in journey sequence.
   - `action`: Playwright action name (`goto`, `click`, `fill`, `select`, `wait`, `screenshot`).
   - `description`: Human-readable action description.
   - `selector`: Target DOM selector or element locator.
   - `value`: Input value or target URL.
   - `url_before` & `url_after`: Page route transitions.
   - `duration_sec`: High-precision step execution timing.
   - `status`: Execution status (`Passed`, `Failed`, `Blocked`, `Skipped`).
   - `screenshot_before_id`: Artifact reference before action.
   - `screenshot_after_id`: Artifact reference after action.
   - `screenshot_failure_id`: Artifact reference upon failure.
   - `screenshot_annotated_id`: Artifact reference with visual defect highlight.
   - `assertion_results`: List of evaluated deterministic invariants.

2. **Automated Visual Defect Highlighting (`ImageAnnotator`):**
   - Built with Python Pillow (`PIL`).
   - Obtains element geometry (`x`, `y`, `width`, `height`) from Playwright viewport.
   - Draws a contrasting 3px alert rectangle around the failing element.
   - Places a high-contrast label badge (`Unexpected subtotal`, `Submission Failed`, `Validation Bypassed`).
   - Applies a translucent red overlay (`rgba(239, 68, 68, 0.18)`).
   - **Original screenshot file is strictly preserved without modification.**

3. **Frontend Step-by-Step Timeline & Side-by-Side Modal:**
   - In **Test Cases** view, each test expands to show chronological step cards with action code badges, duration, route transitions, and thumbnail previews.
   - Clicking **"View Evidence"** opens the **Side-by-Side Step Evidence Viewer Modal** showing Pre-Action vs. Post-Action screenshots, previous/next step buttons, and zoom expansion.

4. **Proof-Carrying Exported Reports:**
   - HTML run reports (`/api/v1/runs/{id}/export?format=html`) generate standalone HTML documents containing executive KPI summaries, planned vs executed test tables, and step-by-step screenshot thumbnails linking to full-resolution images.

---

## 3. Database Schema & Architecture

```sql
-- Core Test Runs
CREATE TABLE test_runs (
    id VARCHAR(50) PRIMARY KEY,
    target_url VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'created',
    mode VARCHAR(50) DEFAULT 'demo',
    total_tests INTEGER DEFAULT 0,
    passed_tests INTEGER DEFAULT 0,
    failed_tests INTEGER DEFAULT 0,
    duration_sec FLOAT DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Planned Test Cases
CREATE TABLE test_cases (
    id VARCHAR(50) PRIMARY KEY,
    run_id VARCHAR(50) REFERENCES test_runs(id),
    title VARCHAR(300) NOT NULL,
    category VARCHAR(100),
    priority VARCHAR(20),
    priority_score FLOAT,
    steps JSON,
    assertions JSON,
    status VARCHAR(50) DEFAULT 'Planned',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Executed Journey Steps (USP 2)
CREATE TABLE test_step_executions (
    id VARCHAR(50) PRIMARY KEY,
    run_id VARCHAR(50) REFERENCES test_runs(id),
    test_case_id VARCHAR(50) REFERENCES test_cases(id),
    step_index INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    description VARCHAR(300) NOT NULL,
    selector VARCHAR(300),
    value VARCHAR(500),
    url_before VARCHAR(500),
    url_after VARCHAR(500),
    duration_sec FLOAT DEFAULT 0.0,
    status VARCHAR(50) DEFAULT 'Passed',
    error_message TEXT,
    screenshot_before_id VARCHAR(50),
    screenshot_after_id VARCHAR(50),
    screenshot_failure_id VARCHAR(50),
    screenshot_annotated_id VARCHAR(50),
    assertion_results JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verified Bug Findings with Visual Highlights
CREATE TABLE bug_findings (
    id VARCHAR(50) PRIMARY KEY,
    run_id VARCHAR(50) REFERENCES test_runs(id),
    title VARCHAR(300) NOT NULL,
    severity VARCHAR(20),
    status VARCHAR(50) DEFAULT 'Suspected',
    affected_url VARCHAR(500),
    failed_step_index INTEGER,
    expected_behavior TEXT,
    actual_behavior TEXT,
    reproduction_steps JSON,
    screenshot_url VARCHAR(500),
    screenshot_before_url VARCHAR(500),
    screenshot_after_url VARCHAR(500),
    annotated_screenshot_url VARCHAR(500),
    replay_attempts INTEGER DEFAULT 0,
    confidence_score FLOAT DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. API Specification & Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/targets` | List available test targets (DevStore, AssessPro, QuickBite) |
| `POST` | `/api/v1/targets/{id}/reset` | Deterministically reset a specific sample target |
| `GET` | `/api/v1/runs` | List test runs with status, test counts, and durations |
| `POST` | `/api/v1/runs` | Create and initiate an autonomous test run |
| `GET` | `/api/v1/runs/{id}/steps` | Retrieve all executed journey steps with screenshot URLs |
| `GET` | `/api/v1/tests/{id}/steps` | Retrieve chronological executed steps for a specific test |
| `GET` | `/api/v1/bugs` | Retrieve proof-carrying defect findings |
| `GET` | `/api/v1/bugs/{id}` | Retrieve bug detail with reproduction steps and annotated evidence |
| `GET` | `/api/v1/benchmark/ground-truth` | Get ground-truth defect registry (`devstore`, `assesspro`, `quickbite`) |
| `POST` | `/api/v1/benchmark/run` | Execute benchmark suite and compute quality metrics |
| `GET` | `/api/v1/benchmark/results/{id}` | Retrieve benchmark evaluation metrics |
| `GET` | `/api/v1/runs/{id}/export` | Export proof-carrying reports (`html`, `markdown`, `json`, `junit`) |
| `GET` | `/api/v1/artifacts/{id}` | Retrieve screenshot or trace artifact with path validation |

---

## 5. Security & Isolation Controls

1. **Host Allowlist & SSRF Mitigation:**
   - Target URLs are strictly validated against an allowed host list (`127.0.0.1`, `localhost`, `devstore.local`).
   - Cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`) are blocked.
2. **Directory Traversal Protection:**
   - Artifact requests are validated with `os.path.abspath` to ensure files never escape the designated `artifacts/` root directory.
3. **Execution Sandboxing:**
   - Only validated browser actions (`goto`, `click`, `fill`, `select`, `wait`, `screenshot`) can be executed. Unsanitized JavaScript execution and arbitrary shell calls are strictly rejected.
4. **Credential Redaction:**
   - Passwords, authorization tokens, and private session cookies are scrubbed from logs and prompts using regex sanitization filters.

---

## 6. Verification & Test Suite Summary

- **Backend Pytest Suite:**
  - `backend/tests/test_evidence_and_targets.py`: 4 tests (Target registry, QuickBite ground truth, ImageAnnotator highlighting, TestStepExecution persistence and coverage metrics).
  - `backend/tests/test_assessment_and_baselines.py`: 5 tests (AssessPro ground truth, benchmark evaluation, baseline persistence, verifier replay states, invariant assertions).
  - `backend/tests/test_benchmark_metrics.py`: 2 tests (Zero-findings metric safety, seeded defect matching).
  - `backend/tests/test_core.py`: 6 tests (URL security boundaries, credential redaction, curiosity scoring, test schema validation, ground-truth completeness, report exports).
  - `backend/tests/test_e2e.py`: 1 test (Full autonomous QA lifecycle with live Playwright execution).
  - **Total:** 18 tests, **100% pass rate**.

- **Frontend Build:**
  - TypeScript strict compile (`tsc -b`) and Vite production bundle: **0 errors, clean build**.
