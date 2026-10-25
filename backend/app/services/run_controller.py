import os
import uuid
import datetime
import asyncio
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.app.db.session import SessionLocal
from backend.app.db.models import (
    TestRun, ExploredPage, TestCase, TestExecution, TestStepExecution, BugFinding, Artifact, RunEvent, RegressionTest, get_utc_now
)

def calc_duration_sec(end_dt, start_dt) -> float:
    if not end_dt or not start_dt:
        return 0.0
    if hasattr(end_dt, 'tzinfo') and end_dt.tzinfo is not None:
        end_dt = end_dt.replace(tzinfo=None)
    if hasattr(start_dt, 'tzinfo') and start_dt.tzinfo is not None:
        start_dt = start_dt.replace(tzinfo=None)
    return max(0.0, (end_dt - start_dt).total_seconds())
from backend.app.services.browser_manager import BrowserSession
from backend.app.services.curiosity_engine import CuriosityEngine
from backend.app.services.browser_executor import BrowserExecutor
from backend.app.agents.scout import ScoutAgent
from backend.app.agents.tester import TesterAgent
from backend.app.agents.verifier_agent import VerifierAgent
from backend.app.llm.provider import LLMProvider
from backend.app.core.config import settings

class RunController:
    """
    Central Orchestrator coordinating Scout, Tester, and Verifier agents,
    driving the run state machine, recording events, and persisting execution results.
    """
    active_runs: Dict[str, bool] = {} # run_id -> is_cancelled_flag

    @classmethod
    def request_cancellation(cls, run_id: str):
        if run_id in cls.active_runs:
            cls.active_runs[run_id] = True

    @classmethod
    def is_cancelled(cls, run_id: str) -> bool:
        return cls.active_runs.get(run_id, False)

    @classmethod
    def emit_event(
        cls,
        db: Session,
        run_id: str,
        stage: str,
        agent_role: str,
        event_type: str,
        message: str,
        details: Optional[Dict[str, Any]] = None
    ):
        event = RunEvent(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            run_id=run_id,
            timestamp=get_utc_now(),
            stage=stage,
            agent_role=agent_role,
            event_type=event_type,
            message=message,
            details=details or {}
        )
        db.add(event)
        db.commit()

    @classmethod
    async def execute_run_task(cls, run_id: str):
        """
        Background task executing the complete autonomous QA lifecycle.
        """
        cls.active_runs[run_id] = False
        db = SessionLocal()
        run = db.query(TestRun).filter(TestRun.id == run_id).first()
        if not run:
            db.close()
            return

        browser_session = BrowserSession(run_id=run_id)

        try:
            # 1. INITIALIZING
            run.status = "initializing"
            run.start_time = get_utc_now()
            db.commit()

            cls.emit_event(
                db, run_id, "initialize", "orchestrator", "RUN_STARTED",
                f"Initializing autonomous QA session for {run.target_url}"
            )

            await browser_session.initialize(headless=settings.BROWSER_HEADLESS)

            if cls.is_cancelled(run_id):
                run.status = "cancelled"
                db.commit()
                return

            # 2. EXPLORING (Scout Agent: Multi-hop graph exploration)
            run.status = "exploring"
            db.commit()
            cls.emit_event(
                db, run_id, "explore", "scout", "SCOUT_STARTED",
                f"Scout Agent initiating autonomous multi-hop exploration on {run.target_url}."
            )

            max_explore_pages = (run.boundaries or {}).get("max_pages", settings.MAX_PAGES_EXPLORE)
            scout = ScoutAgent(base_url=run.target_url)
            page = browser_session.page

            # Perform multi-hop graph exploration
            inspections = await scout.explore_graph(page, max_pages=min(max_explore_pages, 8), max_depth=2)
            if not inspections:
                await page.goto(run.target_url, wait_until="domcontentloaded", timeout=12000)
                inspections = [await scout.inspect_page(page)]

            for insp in inspections:
                db_page = ExploredPage(
                    id=f"page-{uuid.uuid4().hex[:8]}",
                    run_id=run_id,
                    url=insp["url"],
                    title=insp.get("title") or insp["url"],
                    status="visited",
                    discovered_controls=insp.get("controls", []),
                    navigation_links=insp.get("links", []),
                    depth=insp.get("depth", 0)
                )
                db.add(db_page)

            # Capture initial visual snapshot of explored target application
            try:
                art_scout, path_scout, fname_scout = await browser_session.capture_screenshot("scout_overview")
                if art_scout:
                    db.add(Artifact(
                        id=art_scout,
                        run_id=run_id,
                        type="screenshot",
                        file_path=path_scout,
                        file_name=fname_scout,
                        content_type="image/png"
                    ))
            except Exception:
                art_scout = None

            db.commit()

            cls.emit_event(
                db, run_id, "explore", "scout", "PAGES_EXPLORED",
                f"Discovered {len(inspections)} application page states with {sum(len(i.get('controls', [])) for i in inspections)} interactive controls.",
                {
                    "pages_count": len(inspections),
                    "discovered_routes": [i["url"] for i in inspections],
                    "screenshot_url": f"/api/v1/artifacts/{art_scout}" if art_scout else None
                }
            )

            if cls.is_cancelled(run_id):
                run.status = "cancelled"
                db.commit()
                return

            # 3. PLANNING (Tester Agent & Curiosity Engine)
            run.status = "planning"
            db.commit()
            cls.emit_event(
                db, run_id, "plan", "tester", "PLANNING_STARTED",
                "Synthesizing structured test plan using Curiosity Engine ranking."
            )

            curiosity_engine = CuriosityEngine()
            llm_provider = LLMProvider()
            tester = TesterAgent(curiosity_engine=curiosity_engine, llm_provider=llm_provider)

            planned_tests = await tester.generate_test_plan(
                target_url=run.target_url,
                app_description=run.description,
                scout_observations=inspections,
                mode=run.mode
            )

            # Report planning mode transparency
            if run.mode == "ai":
                if llm_provider.last_status == "success":
                    cls.emit_event(
                        db, run_id, "plan", "tester", "AI_PLANNING_SUCCESS",
                        f"AI Planner successfully synthesized journeys via {llm_provider.provider} ({llm_provider.model}) in {llm_provider.last_latency_sec}s.",
                        {"provider": llm_provider.provider, "model": llm_provider.model, "latency_sec": llm_provider.last_latency_sec}
                    )
                else:
                    cls.emit_event(
                        db, run_id, "plan", "tester", "AI_PLANNING_FALLBACK",
                        f"AI planning was not completed ({llm_provider.last_error or llm_provider.last_status}). Utilized deterministic journey synthesis with Curiosity Engine ranking.",
                        {"provider": llm_provider.provider, "reason": llm_provider.last_error or llm_provider.last_status}
                    )
            else:
                cls.emit_event(
                    db, run_id, "plan", "tester", "DETERMINISTIC_PLANNING",
                    "Synthesized calibrated user journeys using deterministic domain heuristics and Curiosity Engine ranking."
                )

            # Persist Planned Test Cases
            db_test_cases = []
            for pt in planned_tests:
                tc = TestCase(
                    id=f"{run_id}-{pt['test_id']}",
                    run_id=run_id,
                    title=pt["title"],
                    objective=pt.get("objective") or pt.get("risk_reason") or f"Validate {pt['title']}",
                    category=pt["category"],
                    priority=pt["priority"],
                    priority_score=pt["priority_score"],
                    preconditions=pt.get("preconditions"),
                    steps=pt["steps"],
                    test_data=pt.get("test_data", {}),
                    expected_results=pt.get("expected_results", []),
                    expectation_source=pt.get("expectation_source", "deterministic_invariant"),
                    baseline_id=pt.get("baseline_id"),
                    assertions=pt["assertions"],
                    cleanup_requirements=pt.get("cleanup_requirements", []),
                    status="Planned",
                    risk_reason=pt.get("risk_reason"),
                    curiosity_breakdown=pt.get("curiosity", {}),
                    regression_eligible=pt.get("regression_candidate", False)
                )
                db.add(tc)
                db_test_cases.append(tc)

            run.total_tests = len(db_test_cases)
            db.commit()

            cls.emit_event(
                db, run_id, "plan", "tester", "TEST_PLAN_APPROVED",
                f"Generated and prioritized {len(db_test_cases)} test cases with explainable curiosity scores.",
                {"test_ids": [t.id for t in db_test_cases]}
            )

            # 4. EXECUTING & VERIFYING
            run.status = "executing"
            db.commit()

            executor = BrowserExecutor(browser_session=browser_session)
            verifier = VerifierAgent(browser_executor=executor, max_retries=1)

            # Execution boundaries: ensure budget permits full journey evaluation
            configured_actions = (run.boundaries or {}).get("max_actions")
            max_actions = configured_actions if configured_actions and configured_actions > 0 else settings.MAX_ACTIONS_PER_RUN
            configured_duration = (run.boundaries or {}).get("max_duration_sec")
            max_duration = configured_duration if configured_duration and configured_duration > 0 else settings.MAX_RUN_DURATION_SEC
            action_count = 0

            passed_cnt = 0
            failed_cnt = 0
            blocked_cnt = 0
            findings_cnt = 0

            for tc in db_test_cases:
                if cls.is_cancelled(run_id):
                    tc.status = "Cancelled"
                    db.commit()
                    break

                # Enforce execution safety boundaries (action & time budget)
                elapsed = calc_duration_sec(get_utc_now(), run.start_time)
                if action_count >= max_actions or elapsed >= max_duration:
                    tc.status = "Blocked"
                    blocked_cnt += 1
                    cls.emit_event(
                        db, run_id, "execute", "orchestrator", "BUDGET_REACHED",
                        f"Execution budget limit reached for {tc.id} ({action_count}/{max_actions} actions, {elapsed:.1f}s/{max_duration}s)."
                    )
                    db.commit()
                    continue

                tc.status = "Running"
                db.commit()

                cls.emit_event(
                    db, run_id, "execute", "tester", "TEST_STARTED",
                    f"Executing {tc.id}: {tc.title} (Curiosity Score: {tc.priority_score})"
                )

                async def handle_live_step(st: Dict[str, Any]):
                    # Register any screenshot artifacts immediately so they are servable live
                    for art_key in ["screenshot_before_id", "screenshot_after_id", "screenshot_failure_id", "screenshot_annotated_id"]:
                        art_id = st.get(art_key)
                        if art_id:
                            fname = f"{art_id}.png"
                            existing_art = db.query(Artifact).filter(Artifact.id == art_id).first()
                            if not existing_art:
                                art_type = "screenshot_annotated" if "annotated" in art_id or art_key == "screenshot_annotated_id" else "screenshot"
                                db.add(Artifact(
                                    id=art_id,
                                    run_id=run_id,
                                    test_id=tc.id,
                                    type=art_type,
                                    file_path=os.path.join(settings.ARTIFACTS_DIR, fname),
                                    file_name=fname,
                                    content_type="image/png"
                                ))
                    
                    # Persist / Upsert step execution record immediately
                    existing_step = db.query(TestStepExecution).filter(
                        TestStepExecution.run_id == run_id,
                        TestStepExecution.test_case_id == tc.id,
                        TestStepExecution.step_index == st["step_index"]
                    ).first()
                    if not existing_step:
                        step_exec = TestStepExecution(
                            id=f"step-exec-{uuid.uuid4().hex[:8]}",
                            run_id=run_id,
                            test_case_id=tc.id,
                            step_index=st["step_index"],
                            action=st["action"],
                            description=st["description"],
                            selector=st.get("selector"),
                            value=str(st.get("value") or ""),
                            url_before=st.get("url_before"),
                            url_after=st.get("url_after"),
                            duration_sec=st.get("duration_sec", 0.0),
                            status=st.get("status", "Passed"),
                            error_message=st.get("error_message"),
                            screenshot_before_id=st.get("screenshot_before_id"),
                            screenshot_after_id=st.get("screenshot_after_id"),
                            screenshot_failure_id=st.get("screenshot_failure_id"),
                            screenshot_annotated_id=st.get("screenshot_annotated_id"),
                            assertion_results=st.get("assertion_results", [])
                        )
                        db.add(step_exec)
                    else:
                        existing_step.status = st.get("status", "Passed")
                        existing_step.error_message = st.get("error_message")
                        existing_step.screenshot_failure_id = st.get("screenshot_failure_id")
                        existing_step.screenshot_annotated_id = st.get("screenshot_annotated_id")
                        existing_step.assertion_results = st.get("assertion_results", [])
                    
                    db.commit()

                    # Emit live step event
                    live_art = st.get("screenshot_annotated_id") or st.get("screenshot_after_id") or st.get("screenshot_before_id")
                    cls.emit_event(
                        db, run_id, "execute", "tester", "STEP_EXECUTED",
                        f"Step {st['step_index']}: {st['action'].upper()} on {st.get('url_after') or run.target_url}",
                        {
                            "step_index": st["step_index"],
                            "action": st["action"],
                            "selector": st.get("selector"),
                            "status": st.get("status"),
                            "url": st.get("url_after"),
                            "screenshot_url": f"/api/v1/artifacts/{live_art}" if live_art else None
                        }
                    )

                t_start = get_utc_now()
                exec_result = await executor.execute_test({
                    "steps": tc.steps,
                    "assertions": tc.assertions
                }, on_step=handle_live_step)
                t_end = get_utc_now()
                duration = calc_duration_sec(t_end, t_start)
                action_count += len(tc.steps)

                test_exec_id = f"exec-{uuid.uuid4().hex[:8]}"
                test_exec = TestExecution(
                    id=test_exec_id,
                    test_case_id=tc.id,
                    run_id=run_id,
                    status=exec_result["status"],
                    actual_observations="\n".join(exec_result["step_logs"]),
                    start_time=t_start,
                    end_time=t_end,
                    duration_sec=duration,
                    assertion_results=exec_result["assertion_results"],
                    screenshot_ids=exec_result["screenshot_ids"],
                    step_records=exec_result.get("step_records", []),
                    console_logs=exec_result["console_logs"],
                    network_observations=[{"url": exec_result.get("final_url", run.target_url), "status": 200}]
                )
                db.add(test_exec)
                tc.status = exec_result["status"]
                db.commit()

                # Register Screenshots as Artifacts
                for art_id in exec_result["screenshot_ids"]:
                    fname = f"{art_id}.png"
                    # Determine specific artifact sub-type if matching annotated
                    art_type = "screenshot_annotated" if "annotated" in art_id or art_id == exec_result.get("annotated_screenshot_id") else "screenshot"
                    art_record = Artifact(
                        id=art_id,
                        run_id=run_id,
                        test_id=tc.id,
                        type=art_type,
                        file_path=os.path.join(settings.ARTIFACTS_DIR, fname),
                        file_name=fname,
                        content_type="image/png"
                    )
                    db.add(art_record)

                if exec_result["status"] == "Passed":
                    passed_cnt += 1
                    cls.emit_event(
                        db, run_id, "execute", "tester", "TEST_PASSED",
                        f"PASSED: {tc.id} - {tc.title}"
                    )
                    # Automatically save verified passing journeys into persistent regression suite
                    reg_name = f"Regression: {tc.title}"
                    if not db.query(RegressionTest).filter(RegressionTest.name == reg_name).first():
                        reg_test = RegressionTest(
                            id=f"reg-{uuid.uuid4().hex[:8]}",
                            name=reg_name,
                            target_url=run.target_url,
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
                elif exec_result["status"] == "Blocked":
                    blocked_cnt += 1
                    cls.emit_event(
                        db, run_id, "execute", "tester", "TEST_BLOCKED",
                        f"BLOCKED: {tc.id} - {tc.title} ({exec_result.get('execution_error')})"
                    )
                else: # Failed -> Invoke Verifier Agent!
                    failed_cnt += 1
                    cls.emit_event(
                        db, run_id, "verify", "verifier", "VERIFICATION_STARTED",
                        f"Failure observed on {tc.id}. Verifier Agent starting failure replay in clean session."
                    )

                    verification = await verifier.verify_failure(
                        test_case={
                            "steps": tc.steps,
                            "assertions": tc.assertions,
                            "title": tc.title,
                            "category": tc.category,
                            "expectation_source": tc.expectation_source
                        },
                        initial_result=exec_result
                    )

                    # Deduplication Check
                    dedup_key = verification.get("dedup_key")
                    existing_finding = None
                    if dedup_key:
                        existing_finding = db.query(BugFinding).filter(
                            BugFinding.run_id == run_id,
                            BugFinding.dedup_key == dedup_key
                        ).first()

                    if existing_finding:
                        existing_finding.replay_attempts += verification["replay_attempts"]
                        existing_finding.verification_notes += f" | Corroborated by {tc.id} failure."
                        cls.emit_event(
                            db, run_id, "verify", "verifier", "BUG_DEDUPLICATED",
                            f"Corroborated existing defect {existing_finding.id} (Deduplicated with key {dedup_key}).",
                            {"finding_id": existing_finding.id, "dedup_key": dedup_key}
                        )
                    else:
                        bug_id = f"BUG-{uuid.uuid4().hex[:6].upper()}"
                        repro_steps_texts = [s.get("description", str(s)) for s in verification.get("minimal_steps", tc.steps)]

                        # Determine failing step details & screenshot evidence
                        failed_step_rec = None
                        for s in exec_result.get("step_records", []):
                            if s.get("status") == "Failed":
                                failed_step_rec = s
                                break
                        if not failed_step_rec and exec_result.get("step_records"):
                            failed_step_rec = exec_result["step_records"][-1]

                        failed_step_idx = failed_step_rec["step_index"] if failed_step_rec else exec_result.get("failing_step_index")
                        fail_art_id = exec_result.get("failure_screenshot_id") or (failed_step_rec.get("screenshot_failure_id") if failed_step_rec else None) or (exec_result["screenshot_ids"][-1] if exec_result["screenshot_ids"] else None)
                        annot_art_id = exec_result.get("annotated_screenshot_id") or (failed_step_rec.get("screenshot_annotated_id") if failed_step_rec else None)
                        before_art_id = failed_step_rec.get("screenshot_before_id") if failed_step_rec else None
                        after_art_id = failed_step_rec.get("screenshot_after_id") if failed_step_rec else None
                        
                        finding = BugFinding(
                            id=bug_id,
                            run_id=run_id,
                            test_execution_id=test_exec_id,
                            failed_step_index=failed_step_idx,
                            annotated_screenshot_url=f"/api/v1/artifacts/{annot_art_id}" if annot_art_id else None,
                            screenshot_before_url=f"/api/v1/artifacts/{before_art_id}" if before_art_id else None,
                            screenshot_after_url=f"/api/v1/artifacts/{after_art_id}" if after_art_id else None,
                            dedup_key=dedup_key,
                            title=f"Defect in {tc.title}",
                            description=f"Deterministic failure detected in {verification.get('category', tc.category)}. {verification['verification_notes']}",
                            affected_url=exec_result.get("final_url", run.target_url),
                            category=verification.get("category", tc.category),
                            severity=verification["severity"],
                            severity_reason=verification["severity_reason"],
                            status=verification["finding_status"],
                            confidence_score=verification["confidence_score"],
                            trust_score=verification.get("trust_score", verification["confidence_score"]),
                            trust_breakdown=verification.get("trust_breakdown", {}),
                            verification_notes=verification["verification_notes"],
                            expected_behavior="; ".join([a.get("message") or f"Expected {a.get('type')}" for a in verification["failed_assertions"]]) or ("; ".join([a.get("message") for a in tc.assertions if a.get("message")]) or tc.title),
                            expectation_source=tc.expectation_source or "Deterministic Invariant",
                            expectation_justification=f"Expectation grounded in {tc.expectation_source or 'deterministic invariant'}: Verified against application state contract.",
                            actual_behavior="; ".join([a.get("actual") or "Assertion violation" for a in verification["failed_assertions"]]) or (exec_result.get("execution_error") or "Assertion failed during browser execution"),
                            reproduction_steps=repro_steps_texts,
                            reproduction_attempts=verification["replay_attempts"],
                            reproduction_outcomes=verification.get("reproduction_outcomes", []),
                            detection_method=verification.get("detection_method", "deterministic_assertion"),
                            likely_cause_hypothesis=verification.get("likely_cause_hypothesis"),
                            suggested_fix=verification.get("suggested_fix"),
                            alternative_explanations=verification.get("alternative_explanations"),
                            screenshot_url=f"/api/v1/artifacts/{fail_art_id}" if fail_art_id else None,
                            console_errors=exec_result["page_errors"],
                            network_status={"status": 200, "url": exec_result.get("final_url", run.target_url)},
                            replay_attempts=verification["replay_attempts"]
                        )
                        db.add(finding)
                        findings_cnt += 1

                        cls.emit_event(
                            db, run_id, "verify", "verifier", "BUG_VERIFIED",
                            f"VERIFIED FINDING [{finding.status}]: {finding.title} (Severity: {finding.severity}, Trust: {int(finding.trust_score*100)}%)",
                            {"finding_id": bug_id, "severity": finding.severity, "status": finding.status, "trust_score": finding.trust_score}
                        )

                db.commit()

            # 5. REPORTING
            run.status = "reporting"
            run.passed_count = passed_cnt
            run.failed_count = failed_cnt
            run.blocked_count = blocked_cnt
            run.findings_count = findings_cnt
            db.commit()

            cls.emit_event(
                db, run_id, "report", "orchestrator", "REPORTS_GENERATED",
                f"Generated proof-carrying reports: {passed_cnt} passed, {failed_cnt} failed, {findings_cnt} verified findings."
            )

            # 6. COMPLETED
            run.status = "completed" if not cls.is_cancelled(run_id) else "cancelled"
            run.end_time = get_utc_now()
            run.duration_sec = calc_duration_sec(run.end_time, run.start_time)
            db.commit()

            cls.emit_event(
                db, run_id, "completed", "orchestrator", "RUN_COMPLETED",
                f"Autonomous QA Run {run_id} finished in {run.duration_sec:.1f}s."
            )

        except Exception as e:
            run.status = "failed"
            run.error_summary = str(e)
            run.end_time = get_utc_now()
            db.commit()
            cls.emit_event(
                db, run_id, "failed", "orchestrator", "RUN_FAILED",
                f"Fatal run exception: {str(e)}"
            )

        finally:
            await browser_session.close()
            cls.active_runs.pop(run_id, None)
            db.close()
