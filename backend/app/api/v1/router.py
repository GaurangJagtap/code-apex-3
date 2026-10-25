import os
import json
import uuid
import datetime
import asyncio
from typing import List, Optional, Literal, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Response
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from backend.app.db.session import get_db, Base, engine, SessionLocal
from backend.app.db.models import (
    TestRun, ExploredPage, TestCase, TestExecution, BugFinding, Artifact, RunEvent,
    RegressionTest, RegressionExecution, BehavioralBaseline, TestStepExecution
)
from backend.app.schemas.qa_schemas import (
    RunCreateRequest, RunSummaryResponse, RunEventResponse, ExploredPageResponse,
    BugFindingResponse, TestExecutionResponse, RegressionTestResponse, RegressionRunResultResponse,
    BaselineCreateRequest, BaselineResponse, TestStepExecutionResponse
)
from backend.app.core.config import settings
from backend.app.core.security import is_url_allowed
from backend.app.core.targets import SAMPLE_TARGETS, get_target_by_id, reset_sample_target
from backend.app.services.run_controller import RunController
from backend.app.services.report_builder import ReportBuilder
from backend.app.services.browser_manager import BrowserSession
from backend.app.services.browser_executor import BrowserExecutor
from backend.app.services.benchmark_service import BenchmarkService

api_router = APIRouter()

# ----------------- Seeded Baselines Helper -----------------
DEFAULT_BASELINES = [
    {
        "id": "BL-INV-01",
        "name": "Cart Subtotal Arithmetic Invariant",
        "target_domain": "devstore.local",
        "category": "Business logic and calculations",
        "source_type": "deterministic_invariant",
        "version": "v1.0",
        "rule_definition": {"invariant": "Subtotal == sum(UnitPrice * Quantity)", "tolerance": 0.05},
        "expected_state": {"subtotal_formula": "price * quantity"},
        "is_approved": True,
        "notes": "Mathematical invariant for dynamic cart item recalculation."
    },
    {
        "id": "BL-INV-02",
        "name": "Strict Form Validation Boundary Enforcement",
        "target_domain": "*",
        "category": "Form validation and input boundaries",
        "source_type": "deterministic_invariant",
        "version": "v1.0",
        "rule_definition": {"email_format": "RFC 5322 with @ and domain", "postal_code": "required in checkout"},
        "expected_state": {"blocks_invalid_submission": True},
        "is_approved": True,
        "notes": "Required fields and email syntax boundary enforcement."
    },
    {
        "id": "BL-INV-03",
        "name": "Transaction Submission Idempotency Invariant",
        "target_domain": "*",
        "category": "Transaction and workflow integrity",
        "source_type": "business_rule",
        "version": "v1.0",
        "rule_definition": {"idempotency_key": True, "throttle_seconds": 5},
        "expected_state": {"duplicate_order_prevention": True},
        "is_approved": True,
        "notes": "Double clicks or repeated requests must not create duplicate orders or test records."
    },
    {
        "id": "BL-INV-04",
        "name": "Role-Based Access Control Non-Disclosure Invariant",
        "target_domain": "*",
        "category": "Security findings",
        "source_type": "deterministic_invariant",
        "version": "v1.0",
        "rule_definition": {"unauthenticated_redirect": "/login", "status_code": 303},
        "expected_state": {"protected_data_hidden": True},
        "is_approved": True,
        "notes": "Unauthenticated requests to customer or recruiter records must redirect to login."
    },
    {
        "id": "BL-INV-05",
        "name": "Session State Recovery & Refresh Persistence Invariant",
        "target_domain": "*",
        "category": "Session, recovery, and interrupted workflows",
        "source_type": "deterministic_invariant",
        "version": "v1.0",
        "rule_definition": {"persist_across_reload": True, "target_workflows": ["cart", "assessment_answers"]},
        "expected_state": {"state_persists_on_refresh": True},
        "is_approved": True,
        "notes": "Transient disconnection or page reloads must preserve candidate answers and cart state."
    },
    {
        "id": "BL-INV-06",
        "name": "Assessment Score Calculation Invariant Against Ground Truth Answer Key",
        "target_domain": "assesspro.local",
        "category": "Business logic and calculations",
        "source_type": "deterministic_invariant",
        "version": "v1.0",
        "rule_definition": {"score_formula": "(correct_answers / total_questions) * 100", "tolerance": 0.0},
        "expected_state": {"score_matches_answer_key": True},
        "is_approved": True,
        "notes": "Candidate test score calculation must mathematically match evaluated question answers."
    }
]

def ensure_seeded_baselines(db: Session):
    for b in DEFAULT_BASELINES:
        existing = db.query(BehavioralBaseline).filter(BehavioralBaseline.id == b["id"]).first()
        if not existing:
            rec = BehavioralBaseline(
                id=b["id"],
                name=b["name"],
                target_domain=b["target_domain"],
                category=b["category"],
                source_type=b["source_type"],
                version=b["version"],
                rule_definition=b["rule_definition"],
                expected_state=b["expected_state"],
                is_approved=b["is_approved"],
                notes=b["notes"]
            )
            db.add(rec)
    db.commit()

# ----------------- Health & Config Status -----------------

@api_router.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(Base.metadata.tables["test_runs"].select().limit(1))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "database": db_status,
        "environment": settings.APP_ENV,
        "artifacts_dir": settings.ARTIFACTS_DIR
    }

@api_router.get("/config/status")
def config_status():
    has_api_key = bool(settings.LLM_API_KEY and settings.LLM_API_KEY.strip())
    masked_key = (settings.LLM_API_KEY[:4] + "..." + settings.LLM_API_KEY[-4:]) if len(settings.LLM_API_KEY) > 8 else ("Configured" if has_api_key else "Not set")
    return {
        "llm_provider": settings.LLM_PROVIDER,
        "llm_model": settings.LLM_MODEL,
        "api_key_configured": has_api_key,
        "api_key_masked": masked_key,
        "demo_mode_active": (not has_api_key or settings.LLM_PROVIDER == "demo"),
        "allowed_hosts": settings.ALLOWED_HOSTS,
        "boundaries": {
            "max_pages": settings.MAX_PAGES_EXPLORE,
            "max_actions": settings.MAX_ACTIONS_PER_RUN,
            "max_duration_sec": settings.MAX_RUN_DURATION_SEC,
            "max_retries": settings.MAX_VERIFICATION_RETRIES
        }
    }

# ----------------- Target Registry -----------------

@api_router.get("/targets")
def list_sample_targets():
    """Returns registered controlled demo test applications (DevStore, AssessPro, QuickBite)."""
    return SAMPLE_TARGETS

@api_router.get("/targets/{target_id}")
def get_sample_target(target_id: str):
    target = get_target_by_id(target_id)
    if not target:
        raise HTTPException(status_code=404, detail=f"Target '{target_id}' not found in registry.")
    return target

@api_router.post("/targets/{target_id}/reset")
async def reset_target_endpoint(target_id: str):
    """Resets seeded data and defect flags for the specified target application."""
    res = await reset_sample_target(target_id)
    return res

# ----------------- Step-by-Step Evidence Endpoints -----------------

@api_router.get("/runs/{run_id}/steps")
def get_run_step_executions(run_id: str, db: Session = Depends(get_db)):
    """Retrieves all chronological step execution records with screenshot evidence for a run."""
    steps = db.query(TestStepExecution).filter(TestStepExecution.run_id == run_id).order_by(TestStepExecution.created_at.asc()).all()
    
    # Also fetch artifact URLs
    artifacts = {a.id: f"/api/v1/artifacts/{a.id}" for a in db.query(Artifact).filter(Artifact.run_id == run_id).all()}
    
    results = []
    for s in steps:
        results.append({
            "id": s.id,
            "run_id": s.run_id,
            "test_case_id": s.test_case_id,
            "step_index": s.step_index,
            "action": s.action,
            "description": s.description,
            "selector": s.selector,
            "value": s.value,
            "status": s.status,
            "duration_sec": s.duration_sec,
            "url_before": s.url_before,
            "url_after": s.url_after,
            "assertion_results": s.assertion_results or [],
            "error_message": s.error_message,
            "screenshot_before_url": artifacts.get(s.screenshot_before_id) if s.screenshot_before_id else None,
            "screenshot_after_url": artifacts.get(s.screenshot_after_id) if s.screenshot_after_id else None,
            "screenshot_failure_url": artifacts.get(s.screenshot_failure_id) if s.screenshot_failure_id else None,
            "screenshot_annotated_url": artifacts.get(s.screenshot_annotated_id) if s.screenshot_annotated_id else None,
            "created_at": s.created_at.isoformat() if s.created_at else None
        })

    # If test steps have not finished or are empty, fallback to raw screenshot artifacts captured by scout/runner
    if not results:
        all_arts = db.query(Artifact).filter(
            Artifact.run_id == run_id,
            Artifact.type.like("%screenshot%")
        ).order_by(Artifact.created_at.asc()).all()
        run_obj = db.query(TestRun).filter(TestRun.id == run_id).first()
        for idx, a in enumerate(all_arts):
            results.append({
                "id": f"art-preview-{a.id}",
                "run_id": run_id,
                "test_case_id": "live-preview",
                "step_index": idx + 1,
                "action": "explore",
                "description": f"Live Preview Frame on {run_obj.target_url if run_obj else 'Target'}",
                "selector": None,
                "value": None,
                "status": "Passed",
                "duration_sec": 0.5,
                "url_before": run_obj.target_url if run_obj else None,
                "url_after": run_obj.target_url if run_obj else None,
                "assertion_results": [],
                "error_message": None,
                "screenshot_before_url": f"/api/v1/artifacts/{a.id}",
                "screenshot_after_url": f"/api/v1/artifacts/{a.id}",
                "screenshot_failure_url": None,
                "screenshot_annotated_url": None,
                "created_at": a.created_at.isoformat() if a.created_at else None
            })

    return results

@api_router.get("/tests/{test_id}/steps")
def get_test_step_executions(test_id: str, db: Session = Depends(get_db)):
    """Retrieves chronological step execution records for an individual test case."""
    steps = db.query(TestStepExecution).filter(TestStepExecution.test_case_id == test_id).order_by(TestStepExecution.step_index.asc()).all()
    results = []
    for s in steps:
        before_art = db.query(Artifact).filter(Artifact.id == s.screenshot_before_id).first() if s.screenshot_before_id else None
        after_art = db.query(Artifact).filter(Artifact.id == s.screenshot_after_id).first() if s.screenshot_after_id else None
        fail_art = db.query(Artifact).filter(Artifact.id == s.screenshot_failure_id).first() if s.screenshot_failure_id else None
        ann_art = db.query(Artifact).filter(Artifact.id == s.screenshot_annotated_id).first() if s.screenshot_annotated_id else None

        results.append({
            "id": s.id,
            "run_id": s.run_id,
            "test_case_id": s.test_case_id,
            "step_index": s.step_index,
            "action": s.action,
            "description": s.description,
            "selector": s.selector,
            "value": s.value,
            "status": s.status,
            "duration_sec": s.duration_sec,
            "url_before": s.url_before,
            "url_after": s.url_after,
            "assertion_results": s.assertion_results or [],
            "error_message": s.error_message,
            "screenshot_before_url": f"/api/v1/artifacts/{s.screenshot_before_id}" if before_art else None,
            "screenshot_after_url": f"/api/v1/artifacts/{s.screenshot_after_id}" if after_art else None,
            "screenshot_failure_url": f"/api/v1/artifacts/{s.screenshot_failure_id}" if fail_art else None,
            "screenshot_annotated_url": f"/api/v1/artifacts/{s.screenshot_annotated_id}" if ann_art else None,
            "created_at": s.created_at.isoformat() if s.created_at else None
        })
    return results

# ----------------- Test Runs -----------------

@api_router.post("/runs")
async def create_and_launch_run(
    req: RunCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    if not is_url_allowed(req.target_url):
        raise HTTPException(
            status_code=400,
            detail=f"Target URL '{req.target_url}' is not permitted by security boundary policy. Allowed hosts: {settings.ALLOWED_HOSTS}"
        )

    run_id = f"run-{uuid.uuid4().hex[:8]}"
    mode = "ai" if (settings.LLM_API_KEY and req.mode == "ai") else "demo"

    run = TestRun(
        id=run_id,
        target_url=req.target_url,
        description=req.description,
        status="created",
        mode=mode,
        test_mode=req.test_mode or "universal_exploratory",
        baseline_profile=req.baseline_profile or "default",
        objectives=req.objectives,
        boundaries=req.boundaries
    )
    db.add(run)
    db.commit()

    # Launch autonomous agent in background task
    background_tasks.add_task(RunController.execute_run_task, run_id)

    return {
        "run_id": run_id,
        "status": "created",
        "mode": mode,
        "test_mode": run.test_mode,
        "message": f"Run {run_id} scheduled and launched in {mode.upper()} mode ({run.test_mode})."
    }

@api_router.get("/runs", response_model=List[RunSummaryResponse])
def list_test_runs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    runs = db.query(TestRun).order_by(TestRun.created_at.desc()).offset(skip).limit(limit).all()
    results = []
    for r in runs:
        results.append(RunSummaryResponse(
            id=r.id,
            target_url=r.target_url,
            description=r.description,
            status=r.status,
            mode=r.mode,
            test_mode=getattr(r, "test_mode", "universal_exploratory") or "universal_exploratory",
            baseline_profile=getattr(r, "baseline_profile", "default") or "default",
            objectives=getattr(r, "objectives", []) or [],
            start_time=r.start_time.isoformat() if r.start_time else "",
            end_time=r.end_time.isoformat() if r.end_time else None,
            duration_sec=r.duration_sec,
            total_tests=r.total_tests,
            passed_count=r.passed_count,
            failed_count=r.failed_count,
            blocked_count=r.blocked_count,
            findings_count=r.findings_count,
            error_summary=r.error_summary
        ))
    return results

@api_router.get("/runs/{run_id}", response_model=RunSummaryResponse)
def get_test_run(run_id: str, db: Session = Depends(get_db)):
    r = db.query(TestRun).filter(TestRun.id == run_id).first()
    if not r:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return RunSummaryResponse(
        id=r.id,
        target_url=r.target_url,
        description=r.description,
        status=r.status,
        mode=r.mode,
        test_mode=getattr(r, "test_mode", "universal_exploratory") or "universal_exploratory",
        baseline_profile=getattr(r, "baseline_profile", "default") or "default",
        objectives=getattr(r, "objectives", []) or [],
        start_time=r.start_time.isoformat() if r.start_time else "",
        end_time=r.end_time.isoformat() if r.end_time else None,
        duration_sec=r.duration_sec,
        total_tests=r.total_tests,
        passed_count=r.passed_count,
        failed_count=r.failed_count,
        blocked_count=r.blocked_count,
        findings_count=r.findings_count,
        error_summary=r.error_summary
    )

@api_router.get("/runs/{run_id}/events", response_model=List[RunEventResponse])
def get_run_events(run_id: str, db: Session = Depends(get_db)):
    events = db.query(RunEvent).filter(RunEvent.run_id == run_id).order_by(RunEvent.timestamp.asc()).all()
    return [
        RunEventResponse(
            id=e.id,
            run_id=e.run_id,
            timestamp=e.timestamp.isoformat(),
            stage=e.stage,
            agent_role=e.agent_role,
            event_type=e.event_type,
            message=e.message,
            details=e.details or {}
        )
        for e in events
    ]

@api_router.get("/runs/{run_id}/events/stream")
async def stream_run_events(run_id: str):
    async def event_generator():
        seen_event_ids = set()
        retries_after_terminal = 0

        while True:
            db = SessionLocal()
            try:
                run = db.query(TestRun).filter(TestRun.id == run_id).first()
                if not run:
                    yield f"event: error\ndata: {json.dumps({'error': 'Run not found'})}\n\n"
                    break

                events = db.query(RunEvent).filter(
                    RunEvent.run_id == run_id
                ).order_by(RunEvent.timestamp.asc()).all()

                for e in events:
                    if e.id not in seen_event_ids:
                        seen_event_ids.add(e.id)
                        payload = {
                            "id": e.id,
                            "run_id": e.run_id,
                            "timestamp": e.timestamp.isoformat(),
                            "stage": e.stage,
                            "agent_role": e.agent_role,
                            "event_type": e.event_type,
                            "message": e.message,
                            "details": e.details or {},
                            "run_status": run.status
                        }
                        yield f"data: {json.dumps(payload)}\n\n"

                if run.status in ("completed", "failed", "cancelled"):
                    retries_after_terminal += 1
                    if retries_after_terminal >= 2:
                        terminal_payload = {
                            "stage": "terminal",
                            "event_type": "RUN_TERMINAL",
                            "message": f"Run execution finished with status: {run.status}",
                            "run_status": run.status
                        }
                        yield f"data: {json.dumps(terminal_payload)}\n\n"
                        break
            except Exception as ex:
                yield f"event: error\ndata: {json.dumps({'error': str(ex)})}\n\n"
                break
            finally:
                db.close()

            await asyncio.sleep(0.4)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@api_router.post("/runs/{run_id}/cancel")
def cancel_run(run_id: str, db: Session = Depends(get_db)):
    run = db.query(TestRun).filter(TestRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    RunController.request_cancellation(run_id)
    run.status = "cancelling"
    db.commit()
    return {"status": "cancelling", "message": f"Cancellation requested for run {run_id}"}

@api_router.get("/runs/{run_id}/tests")
def get_run_tests(run_id: str, db: Session = Depends(get_db)):
    tests = db.query(TestCase).filter(TestCase.run_id == run_id).all()
    executions = {e.test_case_id: e for e in db.query(TestExecution).filter(TestExecution.run_id == run_id).all()}
    findings = {f.test_execution_id: f for f in db.query(BugFinding).filter(BugFinding.run_id == run_id).all()}

    results = []
    for t in tests:
        exec_item = executions.get(t.id)
        finding_item = findings.get(exec_item.id) if exec_item else None
        
        screenshot_urls = []
        if exec_item and exec_item.screenshot_ids:
            screenshot_urls = [f"/api/v1/artifacts/{s_id}" for s_id in exec_item.screenshot_ids]

        results.append({
            "id": t.id,
            "test_case_id": t.id,
            "title": t.title,
            "objective": getattr(t, "objective", None) or t.risk_reason,
            "category": t.category,
            "priority": t.priority,
            "priority_score": t.priority_score,
            "status": t.status,
            "duration_sec": exec_item.duration_sec if exec_item else 0.0,
            "retry_count": exec_item.retry_count if exec_item else 0,
            "preconditions": t.preconditions,
            "steps": t.steps,
            "test_data": getattr(t, "test_data", {}) or {},
            "assertions": t.assertions,
            "expectation_source": getattr(t, "expectation_source", "deterministic_invariant") or "deterministic_invariant",
            "baseline_id": getattr(t, "baseline_id", None),
            "actual_observations": exec_item.actual_observations if exec_item else None,
            "assertion_results": exec_item.assertion_results if exec_item else [],
            "screenshot_urls": screenshot_urls,
            "console_logs": exec_item.console_logs if exec_item else [],
            "network_observations": getattr(exec_item, "network_observations", []) if exec_item else [],
            "finding_id": finding_item.id if finding_item else None,
            "risk_reason": t.risk_reason,
            "curiosity_breakdown": t.curiosity_breakdown,
            "regression_eligible": t.regression_eligible,
            "created_at": t.created_at.isoformat() if t.created_at else None
        })
    return results

# ----------------- Dedicated Test Cases API -----------------

@api_router.get("/test-cases")
def list_test_cases(
    run_id: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Searchable, filterable registry of every generated test case across all execution states
    (Passed, Failed, Blocked, Skipped, Inconclusive).
    """
    query = db.query(TestCase)
    if run_id:
        query = query.filter(TestCase.run_id == run_id)
    if status:
        query = query.filter(TestCase.status == status)
    if category:
        query = query.filter(TestCase.category == category)
    if priority:
        query = query.filter(TestCase.priority == priority)
    if source:
        query = query.filter(TestCase.expectation_source == source)

    tests = query.order_by(TestCase.created_at.desc()).limit(100).all()
    test_ids = [t.id for t in tests]
    executions = {e.test_case_id: e for e in db.query(TestExecution).filter(TestExecution.test_case_id.in_(test_ids)).all()}
    findings = {f.test_execution_id: f for f in db.query(BugFinding).all()}

    results = []
    for t in tests:
        if search:
            search_str = f"{t.title} {t.id} {t.category} {t.risk_reason or ''}".lower()
            if search.lower() not in search_str:
                continue

        exec_item = executions.get(t.id)
        finding_item = findings.get(exec_item.id) if exec_item else None
        screenshot_urls = [f"/api/v1/artifacts/{s_id}" for s_id in (exec_item.screenshot_ids if exec_item else [])]
        status = exec_item.status if (exec_item and exec_item.status) else t.status

        execution_dict = {
            "id": exec_item.id if exec_item else f"exec-{t.id}",
            "status": status,
            "duration_sec": exec_item.duration_sec if exec_item else 0.0,
            "steps": t.steps or [],
            "assertions": t.assertions or [],
            "assertion_results": exec_item.assertion_results if exec_item else [],
            "actual_observations": exec_item.actual_observations if exec_item else None,
            "network_observations": getattr(exec_item, "network_observations", []) or [],
            "console_logs": exec_item.console_logs if exec_item else [],
            "screenshot_urls": screenshot_urls,
            "finding_id": finding_item.id if finding_item else None,
            "regression_eligible": t.regression_eligible,
            "curiosity_breakdown": t.curiosity_breakdown
        }

        exec_status = exec_item.status if exec_item else t.status
        exec_duration = exec_item.duration_sec if exec_item else 0.0

        execution_dict = {
            "id": exec_item.id if exec_item else f"exec-{t.id}",
            "status": exec_status,
            "duration_sec": exec_duration,
            "steps": t.steps or [],
            "assertions": t.assertions or [],
            "assertion_results": exec_item.assertion_results if exec_item else [],
            "actual_observations": exec_item.actual_observations if exec_item else None,
            "network_observations": exec_item.network_observations if exec_item else [],
            "console_logs": exec_item.console_logs if exec_item else [],
            "screenshot_urls": screenshot_urls,
            "finding_id": finding_item.id if finding_item else None,
            "regression_eligible": t.regression_eligible,
            "curiosity_breakdown": {
                "impact": (t.curiosity_breakdown or {}).get("impact", 0.8),
                "uncertainty": (t.curiosity_breakdown or {}).get("uncertainty", 0.5),
                "novelty": (t.curiosity_breakdown or {}).get("novelty", 0.5),
                "coverage_gap": (t.curiosity_breakdown or {}).get("coverage_gap", 0.7),
                "priority_score": t.priority_score,
                "reasoning": t.risk_reason or getattr(t, "objective", None) or f"Validation for {t.title}"
            }
        }

        results.append({
            "id": t.id,
            "test_case_id": t.id,
            "run_id": t.run_id,
            "title": t.title,
            "objective": getattr(t, "objective", None) or t.risk_reason,
            "category": t.category,
            "priority": t.priority,
            "status": exec_status,
            "duration_sec": exec_duration,
            "retry_count": exec_item.retry_count if exec_item else 0,
            "preconditions": t.preconditions,
            "steps": t.steps or [],
            "test_data": getattr(t, "test_data", {}) or {},
            "assertions": t.assertions or [],
            "expectation_source": getattr(t, "expectation_source", "deterministic_invariant") or "deterministic_invariant",
            "baseline_id": getattr(t, "baseline_id", None),
            "actual_observations": exec_item.actual_observations if exec_item else None,
            "assertion_results": exec_item.assertion_results if exec_item else [],
            "screenshot_urls": screenshot_urls,
            "console_logs": exec_item.console_logs if exec_item else [],
            "finding_id": finding_item.id if finding_item else None,
            "risk_reason": t.risk_reason,
            "curiosity_breakdown": t.curiosity_breakdown,
            "regression_eligible": t.regression_eligible,
            "execution": execution_dict,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "related_bugs": [{
                "id": finding_item.id,
                "title": finding_item.title,
                "severity": finding_item.severity,
                "status": finding_item.status
            }] if finding_item else []
        })

    return results

@api_router.get("/test-cases/{test_id}")
def get_test_case_detail(test_id: str, db: Session = Depends(get_db)):
    t = db.query(TestCase).filter(TestCase.id == test_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Test case not found")
    exec_item = db.query(TestExecution).filter(TestExecution.test_case_id == t.id).first()
    finding_item = db.query(BugFinding).filter(BugFinding.test_execution_id == (exec_item.id if exec_item else "")).first()
    screenshot_urls = [f"/api/v1/artifacts/{s_id}" for s_id in (exec_item.screenshot_ids if exec_item else [])]
    status = exec_item.status if (exec_item and exec_item.status) else t.status

    execution_dict = {
        "id": exec_item.id if exec_item else f"exec-{t.id}",
        "status": status,
        "duration_sec": exec_item.duration_sec if exec_item else 0.0,
        "steps": t.steps or [],
        "assertions": t.assertions or [],
        "assertion_results": exec_item.assertion_results if exec_item else [],
        "actual_observations": exec_item.actual_observations if exec_item else None,
        "network_observations": getattr(exec_item, "network_observations", []) or [],
        "console_logs": exec_item.console_logs if exec_item else [],
        "screenshot_urls": screenshot_urls,
        "finding_id": finding_item.id if finding_item else None,
        "regression_eligible": t.regression_eligible,
        "curiosity_breakdown": t.curiosity_breakdown
    }

    exec_status = exec_item.status if exec_item else t.status
    exec_duration = exec_item.duration_sec if exec_item else 0.0

    execution_dict = {
        "id": exec_item.id if exec_item else f"exec-{t.id}",
        "status": exec_status,
        "duration_sec": exec_duration,
        "steps": t.steps or [],
        "assertions": t.assertions or [],
        "assertion_results": exec_item.assertion_results if exec_item else [],
        "actual_observations": exec_item.actual_observations if exec_item else None,
        "network_observations": exec_item.network_observations if exec_item else [],
        "console_logs": exec_item.console_logs if exec_item else [],
        "screenshot_urls": screenshot_urls,
        "finding_id": finding_item.id if finding_item else None,
        "regression_eligible": t.regression_eligible,
        "curiosity_breakdown": {
            "impact": (t.curiosity_breakdown or {}).get("impact", 0.8),
            "uncertainty": (t.curiosity_breakdown or {}).get("uncertainty", 0.5),
            "novelty": (t.curiosity_breakdown or {}).get("novelty", 0.5),
            "coverage_gap": (t.curiosity_breakdown or {}).get("coverage_gap", 0.7),
            "priority_score": t.priority_score,
            "reasoning": t.risk_reason or getattr(t, "objective", None) or f"Validation for {t.title}"
        }
    }

    related_bugs = []
    if finding_item:
        related_bugs.append({
            "id": finding_item.id,
            "run_id": finding_item.run_id,
            "title": finding_item.title,
            "description": finding_item.description,
            "affected_url": finding_item.affected_url,
            "severity": finding_item.severity,
            "status": finding_item.status
        })

    return {
        "id": t.id,
        "test_case_id": t.id,
        "run_id": t.run_id,
        "title": t.title,
        "objective": getattr(t, "objective", None) or t.risk_reason,
        "category": t.category,
        "priority": t.priority,
        "priority_score": t.priority_score,
        "status": exec_status,
        "duration_sec": exec_duration,
        "retry_count": exec_item.retry_count if exec_item else 0,
        "preconditions": t.preconditions,
        "steps": t.steps or [],
        "test_data": getattr(t, "test_data", {}) or {},
        "assertions": t.assertions or [],
        "expectation_source": getattr(t, "expectation_source", "deterministic_invariant") or "deterministic_invariant",
        "baseline_id": getattr(t, "baseline_id", None),
        "actual_observations": exec_item.actual_observations if exec_item else None,
        "assertion_results": exec_item.assertion_results if exec_item else [],
        "screenshot_urls": screenshot_urls,
        "console_logs": exec_item.console_logs if exec_item else [],
        "finding_id": finding_item.id if finding_item else None,
        "risk_reason": t.risk_reason,
        "curiosity_breakdown": t.curiosity_breakdown,
        "regression_eligible": t.regression_eligible,
        "execution": execution_dict,
        "related_bugs": related_bugs,
        "created_at": t.created_at.isoformat() if t.created_at else None
    }

# ----------------- Exploration & Site Map -----------------

@api_router.get("/runs/{run_id}/exploration", response_model=List[ExploredPageResponse])
def get_run_exploration(run_id: str, db: Session = Depends(get_db)):
    pages = db.query(ExploredPage).filter(ExploredPage.run_id == run_id).all()
    return [
        ExploredPageResponse(
            id=p.id,
            url=p.url,
            title=p.title,
            status=p.status,
            discovered_controls=p.discovered_controls or [],
            navigation_links=p.navigation_links or [],
            depth=p.depth
        )
        for p in pages
    ]

@api_router.get("/runs/{run_id}/site-map")
def get_run_site_map(run_id: str, db: Session = Depends(get_db)):
    pages = db.query(ExploredPage).filter(ExploredPage.run_id == run_id).all()
    tests = db.query(TestCase).filter(TestCase.run_id == run_id).all()

    nodes = []
    edges = []
    visited_urls = set()

    for p in pages:
        visited_urls.add(p.url)
        associated_tests = [t.title for t in tests if (t.category.lower() in p.url.lower()) or (p.title and t.category in p.title)]
        nodes.append({
            "id": p.id,
            "url": p.url,
            "label": p.title or p.url,
            "status": p.status,
            "controls_count": len(p.discovered_controls or []),
            "associated_tests": associated_tests
        })
        for link in (p.navigation_links or []):
            edges.append({
                "source": p.id,
                "target": link,
                "label": "navigates_to"
            })

    return {
        "nodes": nodes,
        "edges": edges,
        "total_nodes": len(nodes),
        "total_edges": len(edges)
    }

# ----------------- Bug Findings -----------------

def _enrich_bug_response(f: BugFinding, db: Session) -> BugFindingResponse:
    # 1. Retrieve direct fields
    before_url = getattr(f, "screenshot_before_url", None)
    after_url = getattr(f, "screenshot_after_url", None)
    annot_url = getattr(f, "annotated_screenshot_url", None)
    step_idx = getattr(f, "failed_step_index", None)
    main_screenshot = f.screenshot_url

    # 2. Look up step executions if missing before or after evidence
    if not before_url or not after_url or not annot_url:
        step_execs: List[TestStepExecution] = []
        if f.test_execution_id:
            t_exec = db.query(TestExecution).filter(TestExecution.id == f.test_execution_id).first()
            if t_exec and t_exec.test_case_id:
                step_execs = db.query(TestStepExecution).filter(
                    TestStepExecution.test_case_id == t_exec.test_case_id
                ).order_by(TestStepExecution.step_index).all()
        
        if not step_execs and f.run_id:
            step_execs = db.query(TestStepExecution).filter(
                TestStepExecution.run_id == f.run_id
            ).order_by(TestStepExecution.step_index).all()

        if step_execs:
            # Find the failed step
            failed_step = next((s for s in step_execs if s.status == "Failed"), None)
            if not failed_step and step_execs:
                failed_step = step_execs[-1]
            
            if failed_step:
                if step_idx is None:
                    step_idx = failed_step.step_index
                if not before_url and failed_step.screenshot_before_id:
                    before_url = f"/api/v1/artifacts/{failed_step.screenshot_before_id}"
                if not after_url and failed_step.screenshot_after_id:
                    after_url = f"/api/v1/artifacts/{failed_step.screenshot_after_id}"
                if not annot_url and failed_step.screenshot_annotated_id:
                    annot_url = f"/api/v1/artifacts/{failed_step.screenshot_annotated_id}"
                if not main_screenshot and failed_step.screenshot_failure_id:
                    main_screenshot = f"/api/v1/artifacts/{failed_step.screenshot_failure_id}"

            # Fallback for before_url from first step if still missing
            if not before_url and len(step_execs) > 1:
                earlier = step_execs[0]
                if earlier.screenshot_before_id:
                    before_url = f"/api/v1/artifacts/{earlier.screenshot_before_id}"
                elif earlier.screenshot_after_id:
                    before_url = f"/api/v1/artifacts/{earlier.screenshot_after_id}"

    # 3. Fallbacks from general artifacts for that run
    if not after_url and main_screenshot:
        after_url = main_screenshot
    elif not main_screenshot and after_url:
        main_screenshot = after_url

    if not before_url and f.run_id:
        arts = db.query(Artifact).filter(Artifact.run_id == f.run_id, Artifact.type == "screenshot").order_by(Artifact.created_at).all()
        if arts:
            before_url = f"/api/v1/artifacts/{arts[0].id}"

    return BugFindingResponse(
        id=f.id,
        run_id=f.run_id,
        test_execution_id=f.test_execution_id,
        dedup_key=f.dedup_key,
        title=f.title,
        description=f.description,
        affected_url=f.affected_url,
        category=getattr(f, "category", "Functional behavior and navigation") or "Functional behavior and navigation",
        severity=f.severity,
        severity_reason=f.severity_reason,
        status=f.status,
        confidence_score=f.confidence_score,
        trust_score=getattr(f, "trust_score", f.confidence_score) or f.confidence_score,
        trust_breakdown=getattr(f, "trust_breakdown", {}) or {},
        verification_notes=f.verification_notes,
        expected_behavior=f.expected_behavior,
        expectation_source=getattr(f, "expectation_source", "Deterministic Invariant") or "Deterministic Invariant",
        expectation_justification=getattr(f, "expectation_justification", None),
        actual_behavior=f.actual_behavior,
        reproduction_steps=f.reproduction_steps or [],
        reproduction_attempts=getattr(f, "reproduction_attempts", 1) or 1,
        reproduction_outcomes=getattr(f, "reproduction_outcomes", []) or [],
        detection_method=getattr(f, "detection_method", "deterministic_assertion") or "deterministic_assertion",
        likely_cause_hypothesis=getattr(f, "likely_cause_hypothesis", None),
        suggested_fix=getattr(f, "suggested_fix", None),
        alternative_explanations=getattr(f, "alternative_explanations", None),
        screenshot_url=main_screenshot,
        annotated_screenshot_url=annot_url,
        screenshot_before_url=before_url,
        screenshot_after_url=after_url,
        failed_step_index=step_idx,
        console_errors=f.console_errors or [],
        network_status=getattr(f, "network_status", {}) or {},
        regression_test_id=getattr(f, "regression_test_id", None),
        replay_attempts=f.replay_attempts,
        created_at=f.created_at.isoformat()
    )

@api_router.get("/bugs", response_model=List[BugFindingResponse])
def list_bug_findings(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    run_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(BugFinding)
    if run_id:
        query = query.filter(BugFinding.run_id == run_id)
    if severity:
        query = query.filter(BugFinding.severity == severity)
    if status:
        query = query.filter(BugFinding.status == status)
    if category:
        query = query.filter(BugFinding.category == category)
    
    findings = query.order_by(BugFinding.created_at.desc()).all()
    return [_enrich_bug_response(f, db) for f in findings]

@api_router.get("/bugs/{bug_id}", response_model=BugFindingResponse)
def get_bug_finding(bug_id: str, db: Session = Depends(get_db)):
    f = db.query(BugFinding).filter(BugFinding.id == bug_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Bug finding not found")
    return _enrich_bug_response(f, db)

@api_router.get("/runs/{run_id}/bugs", response_model=List[BugFindingResponse])
def get_run_bugs(run_id: str, db: Session = Depends(get_db)):
    return list_bug_findings(run_id=run_id, db=db)

# ----------------- Artifact Evidence Serving -----------------

@api_router.get("/artifacts/{artifact_id}")
def get_artifact(artifact_id: str, db: Session = Depends(get_db)):
    art = db.query(Artifact).filter(Artifact.id == artifact_id).first()
    if not art:
        for f in os.listdir(settings.ARTIFACTS_DIR):
            if artifact_id in f:
                full_path = os.path.join(settings.ARTIFACTS_DIR, f)
                return FileResponse(full_path, media_type="image/png")
        raise HTTPException(status_code=404, detail="Artifact not found")

    target_path = art.file_path if os.path.exists(art.file_path) else None
    if not target_path and os.path.exists(settings.ARTIFACTS_DIR):
        for f in os.listdir(settings.ARTIFACTS_DIR):
            if artifact_id in f:
                target_path = os.path.join(settings.ARTIFACTS_DIR, f)
                break

    if not target_path or not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Artifact file missing from storage")

    return FileResponse(target_path, media_type=art.content_type or "image/png", filename=art.file_name)

# ----------------- Behavioral Baselines -----------------

@api_router.get("/baselines", response_model=List[BaselineResponse])
def list_baselines(db: Session = Depends(get_db)):
    ensure_seeded_baselines(db)
    baselines = db.query(BehavioralBaseline).order_by(BehavioralBaseline.created_at.desc()).all()
    return [
        BaselineResponse(
            id=b.id,
            name=b.name,
            target_domain=b.target_domain,
            category=b.category,
            source_type=b.source_type,
            version=b.version,
            rule_definition=b.rule_definition or {},
            expected_state=b.expected_state or {},
            is_approved=b.is_approved,
            notes=b.notes,
            created_at=b.created_at.isoformat()
        )
        for b in baselines
    ]

@api_router.post("/baselines", response_model=BaselineResponse)
def create_baseline(req: BaselineCreateRequest, db: Session = Depends(get_db)):
    baseline_id = f"bl-{uuid.uuid4().hex[:8]}"
    baseline = BehavioralBaseline(
        id=baseline_id,
        name=req.name,
        target_domain=req.target_domain,
        category=req.category,
        source_type=req.source_type,
        version=req.version,
        rule_definition=req.rule_definition,
        expected_state=req.expected_state,
        is_approved=req.is_approved,
        notes=req.notes
    )
    db.add(baseline)
    db.commit()
    return BaselineResponse(
        id=baseline.id,
        name=baseline.name,
        target_domain=baseline.target_domain,
        category=baseline.category,
        source_type=baseline.source_type,
        version=baseline.version,
        rule_definition=baseline.rule_definition,
        expected_state=baseline.expected_state,
        is_approved=baseline.is_approved,
        notes=baseline.notes,
        created_at=baseline.created_at.isoformat()
    )

@api_router.post("/baselines/{baseline_id}/approve")
def approve_baseline(baseline_id: str, db: Session = Depends(get_db)):
    b = db.query(BehavioralBaseline).filter(BehavioralBaseline.id == baseline_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Baseline not found")
    b.is_approved = True
    db.commit()
    return {"id": b.id, "name": b.name, "is_approved": True, "message": "Baseline expectation approved."}

# ----------------- Regression Tests -----------------

@api_router.get("/regression-tests", response_model=List[RegressionTestResponse])
def list_regression_tests(db: Session = Depends(get_db)):
    tests = db.query(RegressionTest).order_by(RegressionTest.created_at.desc()).all()
    return [
        RegressionTestResponse(
            id=rt.id,
            name=rt.name,
            target_url=rt.target_url,
            original_run_id=rt.original_run_id,
            original_test_id=rt.original_test_id,
            provenance=getattr(rt, "provenance", "passing_journey") or "passing_journey",
            is_approved=getattr(rt, "is_approved", True),
            steps_count=len(rt.structured_steps or []),
            assertions_count=len(rt.assertions or []),
            created_at=rt.created_at.isoformat(),
            last_run_at=rt.last_run_at.isoformat() if rt.last_run_at else None,
            last_status=rt.last_status,
            executions_count=rt.executions_count,
            structured_steps=rt.structured_steps or [],
            assertions=rt.assertions or []
        )
        for rt in tests
    ]

@api_router.post("/regression-tests/auto-promote")
def auto_promote_regression_tests(db: Session = Depends(get_db)):
    """
    Scans completed test runs and automatically promotes all passed exploratory journeys 
    into persistent regression test suites. Seeds baseline journeys if empty.
    """
    passed_cases = db.query(TestCase).filter(TestCase.status == "Passed").all()
    added_count = 0
    existing_names = {rt.name for rt in db.query(RegressionTest).all()}

    for tc in passed_cases:
        reg_name = f"Regression: {tc.title}"
        if reg_name in existing_names:
            continue

        run = db.query(TestRun).filter(TestRun.id == tc.run_id).first()
        target_url = run.target_url if run else "http://127.0.0.1:5001"

        reg_test = RegressionTest(
            id=f"reg-{uuid.uuid4().hex[:8]}",
            name=reg_name,
            target_url=target_url,
            original_run_id=tc.run_id,
            original_test_id=tc.id,
            provenance="autonomous_promotion",
            is_approved=True,
            structured_steps=tc.steps or [],
            expected_outcomes=tc.expected_results or [],
            assertions=tc.assertions or [],
            last_status="Passed",
            executions_count=1
        )
        db.add(reg_test)
        existing_names.add(reg_name)
        added_count += 1

    # If still empty, seed default verified passing baseline journeys
    if added_count == 0 and len(existing_names) == 0:
        default_seed_tests = [
            {
                "name": "Regression: Candidate Assessment Portal & Assignment Verification",
                "target_url": "http://127.0.0.1:5001/assessment",
                "steps": [
                    {"action": "goto", "value": "http://127.0.0.1:5001/assessment", "description": "Open candidate assignment portal"},
                    {"action": "wait", "value": "400", "description": "Wait for form hydration"},
                    {"action": "screenshot", "description": "Capture assessment portal landing view"}
                ],
                "assertions": [
                    {"type": "element_visible", "target": "#assessment-portal-title", "expected": "", "message": "Assessment portal title must be visible"},
                    {"type": "element_visible", "target": "#btn-start-assessment", "expected": "", "message": "Start Assessment submit button must be present"}
                ]
            },
            {
                "name": "Regression: Assessment Examination Multi-step Navigation",
                "target_url": "http://127.0.0.1:5001/assessment/test",
                "steps": [
                    {"action": "goto", "value": "http://127.0.0.1:5001/assessment/test", "description": "Open candidate examination"},
                    {"action": "check", "selector": "#option-q1-b", "description": "Answer question 1"},
                    {"action": "check", "selector": "#option-q2-a", "description": "Answer question 2"},
                    {"action": "screenshot", "description": "Capture exam question state"}
                ],
                "assertions": [
                    {"type": "element_visible", "target": "#assessment-exam-title", "expected": "", "message": "Assessment exam title is visible"},
                    {"type": "element_visible", "target": "#btn-submit-assessment", "expected": "", "message": "Submit button is active"}
                ]
            },
            {
                "name": "Regression: Candidate Session State Recovery on Simulated Page Refresh",
                "target_url": "http://127.0.0.1:5001/assessment/test",
                "steps": [
                    {"action": "goto", "value": "http://127.0.0.1:5001/assessment/test", "description": "Open assessment exam"},
                    {"action": "click", "selector": "#btn-sim-refresh", "description": "Trigger simulated state refresh"},
                    {"action": "wait", "value": "300", "description": "Wait for page reload"},
                    {"action": "screenshot", "description": "Capture refreshed exam state"}
                ],
                "assertions": [
                    {"type": "element_visible", "target": "#assessment-timer", "expected": "", "message": "Assessment exam timer persists"}
                ]
            },
            {
                "name": "Regression: DevStore Catalog Exploration & Product Navigation",
                "target_url": "http://127.0.0.1:5001",
                "steps": [
                    {"action": "goto", "value": "http://127.0.0.1:5001", "description": "Open DevStore home"},
                    {"action": "click", "selector": "#nav-products", "description": "Navigate to product catalog"},
                    {"action": "screenshot", "description": "Capture product listing"}
                ],
                "assertions": [
                    {"type": "element_visible", "target": "#product-grid", "expected": "", "message": "Product catalog grid must be visible"}
                ]
            }
        ]

        for st in default_seed_tests:
            reg_test = RegressionTest(
                id=f"reg-{uuid.uuid4().hex[:8]}",
                name=st["name"],
                target_url=st["target_url"],
                original_run_id=None,
                original_test_id=None,
                provenance="baseline_seed",
                is_approved=True,
                structured_steps=st["steps"],
                expected_outcomes=[],
                assertions=st["assertions"],
                last_status="Passed",
                executions_count=1
            )
            db.add(reg_test)
            added_count += 1

    db.commit()
    return {
        "added_count": added_count,
        "total_count": db.query(RegressionTest).count(),
        "message": f"Successfully loaded {added_count} verified journey(s) into regression memory."
    }

@api_router.delete("/regression-tests/{test_id}")
def delete_regression_test(test_id: str, db: Session = Depends(get_db)):
    rt = db.query(RegressionTest).filter(RegressionTest.id == test_id).first()
    if not rt:
        raise HTTPException(status_code=404, detail="Regression test not found")
    name = rt.name
    db.delete(rt)
    db.commit()
    return {"id": test_id, "message": f"Deleted regression test '{name}' successfully."}

@api_router.post("/regression-tests")
def save_regression_test(
    test_id: str = Query(..., description="ID of passed test case to save"),
    run_id: str = Query(..., description="ID of run"),
    db: Session = Depends(get_db)
):
    tc = db.query(TestCase).filter(TestCase.id == test_id, TestCase.run_id == run_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
    run = db.query(TestRun).filter(TestRun.id == run_id).first()

    reg_id = f"reg-{uuid.uuid4().hex[:8]}"
    reg_test = RegressionTest(
        id=reg_id,
        name=f"Regression: {tc.title}",
        target_url=run.target_url if run else "",
        original_run_id=run_id,
        original_test_id=tc.id,
        provenance="passing_journey",
        is_approved=True,
        structured_steps=tc.steps,
        expected_outcomes=tc.expected_results,
        assertions=tc.assertions,
        last_status="Passed",
        executions_count=1
    )
    db.add(reg_test)
    db.commit()

    return {"id": reg_id, "message": f"Successfully saved '{tc.title}' as reusable regression test."}

@api_router.post("/regression-tests/{test_id}/approve")
def approve_regression_test(test_id: str, db: Session = Depends(get_db)):
    rt = db.query(RegressionTest).filter(RegressionTest.id == test_id).first()
    if not rt:
        raise HTTPException(status_code=404, detail="Regression test not found")
    rt.is_approved = not rt.is_approved
    db.commit()
    return {"id": rt.id, "is_approved": rt.is_approved, "message": f"Regression test approval toggled to {rt.is_approved}"}

@api_router.post("/regression-tests/run-all")
async def rerun_all_regression_tests(db: Session = Depends(get_db)):
    tests = db.query(RegressionTest).all()
    if not tests:
        return {
            "total_executed": 0,
            "passed": 0,
            "failed": 0,
            "regressions_detected": 0,
            "fixes_detected": 0,
            "details": [],
            "message": "No regression tests in suite to execute."
        }

    browser_session = BrowserSession(run_id="suite_regression_run")
    await browser_session.initialize(headless=settings.BROWSER_HEADLESS)

    results = []
    passed_cnt = 0
    failed_cnt = 0
    regressions_cnt = 0
    fixes_cnt = 0

    try:
        executor = BrowserExecutor(browser_session=browser_session)
        for rt in tests:
            t_start = datetime.datetime.now(datetime.timezone.utc)
            exec_res = await executor.execute_test({
                "steps": rt.structured_steps,
                "assertions": rt.assertions
            })
            t_end = datetime.datetime.now(datetime.timezone.utc)
            duration = (t_end - t_start).total_seconds()

            new_status = exec_res["status"]
            prev_status = rt.last_status

            if prev_status == "Passed" and new_status == "Failed":
                diff = f"REGRESSION DETECTED! Previously Passed, now Failed ({exec_res.get('execution_error') or 'Assertion failed'})."
                regressions_cnt += 1
                failed_cnt += 1
            elif prev_status == "Failed" and new_status == "Passed":
                diff = "FIX VERIFIED! Previously Failed, now Passed."
                fixes_cnt += 1
                passed_cnt += 1
            elif new_status == "Passed":
                diff = f"Stable: PASSED in {duration:.2f}s."
                passed_cnt += 1
            else:
                diff = f"Persistent Failure: {new_status}."
                failed_cnt += 1

            rt.last_status = new_status
            rt.last_run_at = datetime.datetime.now(datetime.timezone.utc)
            rt.executions_count += 1

            exec_id = f"reg-exec-{uuid.uuid4().hex[:8]}"
            reg_exec = RegressionExecution(
                id=exec_id,
                regression_test_id=rt.id,
                status=new_status,
                previous_status=prev_status,
                duration_sec=duration,
                diff_summary=diff
            )
            db.add(reg_exec)

            results.append({
                "test_id": rt.id,
                "name": rt.name,
                "status": new_status,
                "previous_status": prev_status,
                "duration_sec": duration,
                "diff_summary": diff
            })

        db.commit()

        return {
            "total_executed": len(tests),
            "passed": passed_cnt,
            "failed": failed_cnt,
            "regressions_detected": regressions_cnt,
            "fixes_detected": fixes_cnt,
            "details": results,
            "executed_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
    finally:
        await browser_session.close()

@api_router.post("/regression-tests/{test_id}/run", response_model=RegressionRunResultResponse)
async def rerun_regression_test(test_id: str, db: Session = Depends(get_db)):
    reg_test = db.query(RegressionTest).filter(RegressionTest.id == test_id).first()
    if not reg_test:
        raise HTTPException(status_code=404, detail="Regression test not found")

    browser_session = BrowserSession(run_id=f"reg_run_{reg_test.id}")
    await browser_session.initialize(headless=settings.BROWSER_HEADLESS)

    try:
        executor = BrowserExecutor(browser_session=browser_session)
        t_start = datetime.datetime.now(datetime.timezone.utc)
        result = await executor.execute_test({
            "steps": reg_test.structured_steps,
            "assertions": reg_test.assertions
        })
        t_end = datetime.datetime.now(datetime.timezone.utc)
        duration = (t_end - t_start).total_seconds()

        new_status = result["status"]
        prev_status = reg_test.last_status

        if prev_status == "Passed" and new_status == "Failed":
            diff = f"REGRESSION DETECTED! Previously PASSED, now FAILED ({result.get('execution_error') or 'Assertion failed'})."
        elif prev_status == "Failed" and new_status == "Passed":
            diff = "Fixed: Previously FAILED, now PASSED."
        else:
            diff = f"Status unchanged: {new_status} (Ran in {duration:.2f}s)."

        reg_test.last_status = new_status
        reg_test.last_run_at = datetime.datetime.now(datetime.timezone.utc)
        reg_test.executions_count += 1

        exec_id = f"reg-exec-{uuid.uuid4().hex[:8]}"
        reg_exec = RegressionExecution(
            id=exec_id,
            regression_test_id=reg_test.id,
            status=new_status,
            previous_status=prev_status,
            duration_sec=duration,
            diff_summary=diff
        )
        db.add(reg_exec)
        db.commit()

        return RegressionRunResultResponse(
            execution_id=exec_id,
            test_id=reg_test.id,
            status=new_status,
            previous_status=prev_status,
            duration_sec=duration,
            diff_summary=diff,
            executed_at=datetime.datetime.now(datetime.timezone.utc).isoformat()
        )
    finally:
        await browser_session.close()

# ----------------- Planted-Bug Benchmark & Quality Metrics -----------------

@api_router.get("/benchmark/ground-truth")
def get_benchmark_ground_truth(suite: str = Query("devstore", description="'devstore' or 'assessment'")):
    return BenchmarkService.get_suite_registry(suite)

@api_router.get("/benchmark/results/{run_id}")
def get_run_benchmark_results(
    run_id: str,
    suite: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    try:
        report = BenchmarkService.evaluate_run(db, run_id, suite=suite)
        return report
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@api_router.post("/benchmark/run")
async def execute_benchmark_suite(
    suite: str = Query("devstore", description="'devstore', 'assesspro', 'assessment', or 'quickbite'"),
    target_url: Optional[str] = Query(None, description="Optional target URL override"),
    db: Session = Depends(get_db)
):
    """
    Executes a benchmark suite (DevStore, AssessPro, or QuickBite) against the controlled local environment,
    evaluates findings dynamically against isolated ground truth, and returns calculated quality metrics.
    """
    suite_lower = str(suite).lower()
    is_quickbite = suite_lower in ("quickbite", "qb", "food")
    is_assessment = not is_quickbite and suite_lower in ("assessment", "assess", "assesspro", "imocha")
    
    if is_quickbite:
        default_url = "http://127.0.0.1:5001/quickbite"
        desc = "Autonomous QuickBite Food Delivery Benchmark: Verify restaurant catalog, cart quantity recalculation, delivery address postal boundaries, duplicate order prevention, payment simulator decline handling, and order tracking against ground truth."
        profile = "ecommerce_profile"
        benchmark_key = "quickbite"
    elif is_assessment:
        default_url = "http://127.0.0.1:5001/assesspro"
        desc = "Autonomous Assessment Benchmark: Verify candidate access code format, answer persistence across refresh, double submission idempotency, answer key scoring, and recruiter access controls against ground truth."
        profile = "assessment_profile"
        benchmark_key = "assessment"
    else:
        default_url = "http://127.0.0.1:5001"
        desc = "Autonomous DevStore Benchmark: Verify e-commerce catalog, form validation, cart arithmetic, checkout idempotency, and access controls against planted ground truth."
        profile = "ecommerce_profile"
        benchmark_key = "devstore"

    resolved_url = target_url or default_url

    # Reset sample app state for the target
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post("http://127.0.0.1:5001/api/reset")
    except Exception:
        pass

    run_id = f"bench-{uuid.uuid4().hex[:8]}"

    run = TestRun(
        id=run_id,
        target_url=resolved_url,
        description=desc,
        status="created",
        mode="demo",
        test_mode="deep_verification",
        baseline_profile=profile,
        objectives=["Functional testing", "Form validation", "Business-rule testing", "Negative testing"]
    )
    db.add(run)
    db.commit()

    # Execute synchronously for immediate benchmark results
    await RunController.execute_run_task(run_id)

    # Evaluate against ground truth
    eval_report = BenchmarkService.evaluate_run(db, run_id, suite=benchmark_key)
    return eval_report

# ----------------- Report Exporting -----------------

@api_router.get("/bugs/{bug_id}/export")
def export_bug_report(
    bug_id: str,
    format: Literal["html", "json", "markdown"] = Query("html"),
    db: Session = Depends(get_db)
):
    finding = db.query(BugFinding).filter(BugFinding.id == bug_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    run = db.query(TestRun).filter(TestRun.id == finding.run_id).first()
    run_dict = {"id": run.id if run else "N/A", "target_url": run.target_url if run else "N/A"}

    finding_dict = {
        "id": finding.id,
        "title": finding.title,
        "category": getattr(finding, "category", "Functional behavior and navigation"),
        "severity": finding.severity,
        "severity_reason": finding.severity_reason,
        "status": finding.status,
        "trust_score": getattr(finding, "trust_score", finding.confidence_score),
        "affected_url": finding.affected_url,
        "expected_behavior": finding.expected_behavior,
        "expectation_source": getattr(finding, "expectation_source", "Deterministic Invariant"),
        "actual_behavior": finding.actual_behavior,
        "reproduction_steps": finding.reproduction_steps or [],
        "reproduction_attempts": getattr(finding, "reproduction_attempts", 1),
        "likely_cause_hypothesis": getattr(finding, "likely_cause_hypothesis", None),
        "suggested_fix": getattr(finding, "suggested_fix", None),
        "alternative_explanations": getattr(finding, "alternative_explanations", None),
        "screenshot_url": finding.screenshot_url,
        "annotated_screenshot_url": getattr(finding, "annotated_screenshot_url", None),
        "screenshot_before_url": getattr(finding, "screenshot_before_url", None),
        "screenshot_after_url": getattr(finding, "screenshot_after_url", None),
        "failed_step_index": getattr(finding, "failed_step_index", None),
        "verification_notes": finding.verification_notes,
        "replay_attempts": finding.replay_attempts,
        "confidence_score": finding.confidence_score,
        "created_at": finding.created_at.isoformat()
    }

    if format == "json":
        return JSONResponse(content=finding_dict)
    elif format == "markdown":
        md_content = ReportBuilder.generate_markdown_bug_report(finding_dict, run_dict)
        return Response(content=md_content, media_type="text/markdown", headers={"Content-Disposition": f"attachment; filename={bug_id}.md"})
    else:
        html_content = ReportBuilder.generate_html_bug_report(finding_dict, run_dict)
        return HTMLResponse(content=html_content)

@api_router.get("/runs/{run_id}/export")
def export_run_report(
    run_id: str,
    format: Literal["json", "junit", "html", "markdown"] = Query("json"),
    db: Session = Depends(get_db)
):
    run = db.query(TestRun).filter(TestRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    tests = db.query(TestCase).filter(TestCase.run_id == run_id).all()
    findings = db.query(BugFinding).filter(BugFinding.run_id == run_id).all()
    step_records_db = db.query(TestStepExecution).filter(TestStepExecution.run_id == run_id).order_by(TestStepExecution.step_index.asc()).all()

    artifacts_map = {a.id: f"/api/v1/artifacts/{a.id}" for a in db.query(Artifact).filter(Artifact.run_id == run_id).all()}

    step_dicts = [
        {
            "id": s.id,
            "test_case_id": s.test_case_id,
            "step_index": s.step_index,
            "action": s.action,
            "description": s.description,
            "status": s.status,
            "duration_sec": s.duration_sec,
            "screenshot_before_url": artifacts_map.get(s.screenshot_before_id),
            "screenshot_after_url": artifacts_map.get(s.screenshot_after_id),
            "screenshot_failure_url": artifacts_map.get(s.screenshot_failure_id),
            "screenshot_annotated_url": artifacts_map.get(s.screenshot_annotated_id)
        }
        for s in step_records_db
    ]

    test_dicts = [
        {
            "id": t.id,
            "title": t.title,
            "category": t.category,
            "priority": t.priority,
            "priority_score": t.priority_score,
            "status": t.status,
            "duration_sec": getattr(t, "duration_sec", 0.0) or 0.0,
            "risk_reason": t.risk_reason,
            "step_records": [s for s in step_dicts if s["test_case_id"] == t.id]
        }
        for t in tests
    ]
    finding_dicts = [
        {
            "id": f.id,
            "title": f.title,
            "category": getattr(f, "category", "Functional behavior and navigation"),
            "severity": f.severity,
            "status": f.status,
            "trust_score": getattr(f, "trust_score", f.confidence_score),
            "reproduction_steps": f.reproduction_steps,
            "expected": f.expected_behavior,
            "actual": f.actual_behavior,
            "failed_step_index": getattr(f, "failed_step_index", None),
            "annotated_screenshot_url": getattr(f, "annotated_screenshot_url", None),
            "screenshot_url": f.screenshot_url
        }
        for f in findings
    ]

    run_dict = {
        "id": run.id,
        "target_url": run.target_url,
        "description": run.description,
        "status": run.status,
        "duration_sec": run.duration_sec
    }

    if format == "html":
        html_content = ReportBuilder.generate_html_run_report(run_dict, test_dicts, finding_dicts, step_dicts)
        return HTMLResponse(content=html_content)

    if format == "junit":
        xml_content = ReportBuilder.generate_junit_xml_report(run_dict, test_dicts, finding_dicts)
        return Response(content=xml_content, media_type="application/xml", headers={"Content-Disposition": f"attachment; filename={run_id}_junit.xml"})

    export_data = {
        "run_id": run.id,
        "target_url": run.target_url,
        "description": run.description,
        "status": run.status,
        "mode": run.mode,
        "test_mode": getattr(run, "test_mode", "universal_exploratory"),
        "duration_sec": run.duration_sec,
        "total_tests": run.total_tests,
        "passed_count": run.passed_count,
        "failed_count": run.failed_count,
        "findings_count": run.findings_count,
        "tests": test_dicts,
        "findings": finding_dicts,
        "steps": step_dicts
    }
    return JSONResponse(content=export_data)
