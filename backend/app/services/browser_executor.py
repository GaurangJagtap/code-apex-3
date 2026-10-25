import os
import time
import uuid
import datetime
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from playwright.async_api import Page, Locator
from backend.app.services.browser_manager import BrowserSession
from backend.app.services.assertions import AssertionEngine
from backend.app.services.image_annotator import ImageAnnotator
from backend.app.core.config import settings

class BrowserExecutor:
    """
    Executes validated test plan steps in the browser, performs resilient locator resolution,
    captures complete step-by-step screenshot evidence (before and after every action),
    evaluates deterministic assertions, and produces visually annotated failure evidence.
    """
    def __init__(self, browser_session: BrowserSession):
        self.session = browser_session

    async def _resolve_locator_with_fallback(self, page: Page, selector: str, action_desc: str) -> Optional[Locator]:
        """
        Attempts to resolve selector directly. If not found, evaluates resilient locators
        (by text, role, or partial ID/name match) safely.
        """
        if not selector:
            return None

        try:
            loc = page.locator(selector).first
            if await loc.count() > 0:
                return loc
        except Exception:
            pass

        # Resilient Locator Fallback
        try:
            # 1. Try by text if selector contains words
            if "btn" in selector or "button" in selector:
                text_cand = selector.replace("#", "").replace(".", "").replace("btn-", "").replace("btn_", "").replace("-", " ")
                loc_text = page.get_by_role("button", name=text_cand).first
                if await loc_text.count() > 0:
                    return loc_text

            # 2. Try by placeholder or name
            if selector.startswith("#"):
                plain_id = selector[1:]
                loc_name = page.locator(f'[name="{plain_id}"]').first
                if await loc_name.count() > 0:
                    return loc_name
                loc_placeholder = page.locator(f'[placeholder*="{plain_id}"]').first
                if await loc_placeholder.count() > 0:
                    return loc_placeholder

            # 3. Try visible button/input text fallback
            if "submit" in selector.lower() or "submit" in action_desc.lower():
                loc_sub = page.locator('button[type="submit"], input[type="submit"]').first
                if await loc_sub.count() > 0:
                    return loc_sub
        except Exception:
            pass

        return None

    async def _get_locator_bounding_box(self, page: Page, selector: Optional[str]) -> Optional[Dict[str, float]]:
        """Extracts element bounding box geometry for screenshot annotations."""
        if not selector or not page:
            return None
        try:
            loc = page.locator(selector).first
            if await loc.count() > 0:
                box = await loc.bounding_box()
                if box:
                    return {"x": box["x"], "y": box["y"], "width": box["width"], "height": box["height"]}
        except Exception:
            pass
        return None

    async def execute_test(self, test_case: Dict[str, Any], on_step: Optional[Any] = None) -> Dict[str, Any]:
        """
        Executes a test case in a clean browser context and captures chronological
        step-by-step evidence before and after every meaningful action.
        Calls on_step callback in real-time as each action finishes.
        """
        page = await self.session.create_clean_context()
        steps = test_case.get("steps", [])
        assertions = test_case.get("assertions", [])
        
        step_logs: List[str] = []
        step_records: List[Dict[str, Any]] = []
        screenshot_ids: List[str] = []
        executed_successfully = True
        execution_error: Optional[str] = None
        failing_step_index: Optional[int] = None
        failing_bounding_box: Optional[Dict[str, float]] = None

        # 1. Execute Steps in exact ordered sequence with before/after evidence
        for idx, step in enumerate(steps):
            action = step.get("action", "").lower()
            selector = step.get("selector")
            value = step.get("value")
            desc = step.get("description", f"Step {idx+1}: {action}")

            url_before = page.url if page and page.url != "about:blank" else None
            t_step_start = time.perf_counter()
            step_passed = True
            step_error: Optional[str] = None
            art_before: Optional[str] = None
            art_after: Optional[str] = None
            art_fail: Optional[str] = None
            art_annotated: Optional[str] = None

            # Capture PRE-ACTION screenshot if page is already loaded
            if url_before and url_before != "about:blank":
                try:
                    art_before, _, fname_b = await self.session.capture_screenshot(f"step_{idx+1}_before")
                    if art_before:
                        screenshot_ids.append(art_before)
                except Exception:
                    pass

            try:
                if action == "goto":
                    target_url = value or selector
                    await page.goto(target_url, wait_until="domcontentloaded", timeout=12000)
                    step_logs.append(f"Navigated to {target_url}")

                elif action == "click":
                    loc = await self._resolve_locator_with_fallback(page, selector, desc)
                    if loc and await loc.count() > 0:
                        await loc.click(timeout=5000)
                        step_logs.append(f"Clicked element '{selector}'")
                    else:
                        raise Exception(f"Element '{selector}' not found on page {page.url}")

                elif action in ("double_click", "rapid_click", "duplicate_submit"):
                    loc = await self._resolve_locator_with_fallback(page, selector, desc)
                    if loc and await loc.count() > 0:
                        # Rapid double submission to test idempotency
                        await loc.click(timeout=3000)
                        await asyncio.sleep(0.05)
                        try:
                            if await loc.count() > 0 and await loc.is_enabled():
                                await loc.click(timeout=2000)
                                step_logs.append(f"Dispatched rapid secondary click on '{selector}' (Idempotency test)")
                        except Exception:
                            pass
                    else:
                        raise Exception(f"Element '{selector}' not found on page {page.url}")

                elif action == "fill":
                    loc = await self._resolve_locator_with_fallback(page, selector, desc)
                    if loc and await loc.count() > 0:
                        await loc.fill(str(value or ""), timeout=5000)
                        step_logs.append(f"Filled '{selector}' with value '{value}'")
                    else:
                        raise Exception(f"Input element '{selector}' not found on page {page.url}")

                elif action == "select":
                    loc = await self._resolve_locator_with_fallback(page, selector, desc)
                    if loc and await loc.count() > 0:
                        await loc.select_option(str(value or ""), timeout=5000)
                        step_logs.append(f"Selected '{value}' in '{selector}'")
                    else:
                        raise Exception(f"Select element '{selector}' not found on page {page.url}")

                elif action == "check":
                    loc = await self._resolve_locator_with_fallback(page, selector, desc)
                    if loc and await loc.count() > 0:
                        await loc.check(timeout=5000)
                        step_logs.append(f"Checked radio/checkbox '{selector}'")
                    else:
                        raise Exception(f"Checkbox/radio element '{selector}' not found on page {page.url}")

                elif action in ("refresh", "reload"):
                    await page.reload(wait_until="domcontentloaded", timeout=10000)
                    step_logs.append(f"Reloaded page {page.url} to verify state recovery")

                elif action == "wait":
                    wait_ms = int(value or 1000)
                    await page.wait_for_timeout(wait_ms)
                    step_logs.append(f"Waited {wait_ms}ms")

                elif action == "screenshot":
                    # Standalone explicit screenshot
                    art_after, _, fname_s = await self.session.capture_screenshot(f"step_{idx+1}")
                    if art_after:
                        screenshot_ids.append(art_after)
                    step_logs.append(f"Captured screenshot {fname_s}")

                # Bounded stabilization condition
                await asyncio.sleep(0.2)
                url_after = page.url

                # Capture POST-ACTION screenshot
                if not art_after and page and page.url != "about:blank":
                    art_after, _, fname_a = await self.session.capture_screenshot(f"step_{idx+1}_after")
                    if art_after:
                        screenshot_ids.append(art_after)

            except Exception as e:
                step_passed = False
                executed_successfully = False
                execution_error = str(e)
                step_error = str(e)
                failing_step_index = idx + 1
                step_logs.append(f"FAILED step {idx+1} ({desc}): {str(e)}")
                url_after = page.url if page else None

                # Capture failure screenshot immediately at point of error
                try:
                    art_fail, path_fail, _ = await self.session.capture_screenshot(f"step_{idx+1}_failure")
                    if art_fail:
                        screenshot_ids.append(art_fail)

                        # Generate annotated failure screenshot highlighting the issue
                        failing_bounding_box = await self._get_locator_bounding_box(page, selector)
                        art_annotated = f"art-{uuid.uuid4().hex[:8]}"
                        timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
                        fname_annot = f"{self.session.run_id}_step_{idx+1}_annotated_{timestamp}_{art_annotated}.png"
                        path_annot = os.path.join(settings.ARTIFACTS_DIR, fname_annot)

                        ann_ok = ImageAnnotator.annotate_failure(
                            source_image_path=path_fail,
                            output_image_path=path_annot,
                            bounding_box=failing_bounding_box,
                            label=f"Step {idx+1} Failed: {str(e)[:60]}",
                            severity="High"
                        )
                        if ann_ok:
                            screenshot_ids.append(art_annotated)
                except Exception:
                    pass

            t_step_end = time.perf_counter()
            step_duration = round(t_step_end - t_step_start, 3)

            # Record granular chronological step evidence
            step_record = {
                "step_index": idx + 1,
                "action": action,
                "description": desc,
                "selector": selector,
                "value": value,
                "url_before": url_before or (target_url if action == "goto" else None),
                "url_after": url_after,
                "duration_sec": step_duration,
                "status": "Passed" if step_passed else "Failed",
                "error_message": step_error,
                "screenshot_before_id": art_before,
                "screenshot_after_id": art_after,
                "screenshot_failure_id": art_fail,
                "screenshot_annotated_id": art_annotated,
                "screenshot_urls": {
                    "before": f"/api/v1/artifacts/{art_before}" if art_before else None,
                    "after": f"/api/v1/artifacts/{art_after}" if art_after else None,
                    "failure": f"/api/v1/artifacts/{art_fail}" if art_fail else None,
                    "annotated": f"/api/v1/artifacts/{art_annotated}" if art_annotated else None,
                }
            }
            step_records.append(step_record)
            if on_step:
                try:
                    cb_res = on_step(step_record)
                    if asyncio.iscoroutine(cb_res):
                        await cb_res
                except Exception:
                    pass

            if not step_passed:
                break

        # 2. Evaluate Assertions
        assertion_results = []
        all_assertions_passed = True
        first_failed_assertion = None
        
        if executed_successfully:
            for a in assertions:
                res = await AssertionEngine.evaluate_assertion(page, a)
                assertion_results.append(res)
                if not res["passed"]:
                    all_assertions_passed = False
                    if not first_failed_assertion:
                        first_failed_assertion = res

        # If any assertion failed, capture failure screenshot and generate annotated screenshot
        last_fail_art = None
        last_annot_art = None
        if not all_assertions_passed:
            try:
                fail_target = first_failed_assertion.get("target") if first_failed_assertion else None
                fail_msg = first_failed_assertion.get("message") or "Assertion invariant failed"
                
                art_fail, path_fail, _ = await self.session.capture_screenshot("assertion_failure")
                if art_fail:
                    screenshot_ids.append(art_fail)
                    last_fail_art = art_fail

                    # Extract target element geometry for highlighting
                    bbox = await self._get_locator_bounding_box(page, fail_target)
                    art_annot = f"art-{uuid.uuid4().hex[:8]}"
                    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
                    fname_annot = f"{self.session.run_id}_assertion_annotated_{timestamp}_{art_annot}.png"
                    path_annot = os.path.join(settings.ARTIFACTS_DIR, fname_annot)

                    ann_ok = ImageAnnotator.annotate_failure(
                        source_image_path=path_fail,
                        output_image_path=path_annot,
                        bounding_box=bbox,
                        label=fail_msg[:70],
                        severity="High"
                    )
                    if ann_ok:
                        screenshot_ids.append(art_annot)
                        last_annot_art = art_annot

                # Attach failure evidence to the final step in step_records
                if step_records:
                    step_records[-1]["status"] = "Failed"
                    step_records[-1]["error_message"] = fail_msg
                    step_records[-1]["screenshot_failure_id"] = art_fail
                    step_records[-1]["screenshot_annotated_id"] = last_annot_art
                    step_records[-1]["screenshot_urls"]["failure"] = f"/api/v1/artifacts/{art_fail}" if art_fail else None
                    step_records[-1]["screenshot_urls"]["annotated"] = f"/api/v1/artifacts/{last_annot_art}" if last_annot_art else None
                    step_records[-1]["assertion_results"] = assertion_results

                    if on_step:
                        try:
                            cb_res = on_step(step_records[-1])
                            if asyncio.iscoroutine(cb_res):
                                await cb_res
                        except Exception:
                            pass
            except Exception:
                pass

        # Final Status Decision
        if not executed_successfully:
            test_status = "Blocked" if "not found" in (execution_error or "") else "Failed"
        elif not all_assertions_passed:
            test_status = "Failed"
        else:
            test_status = "Passed"

        return {
            "status": test_status,
            "all_assertions_passed": all_assertions_passed,
            "step_logs": step_logs,
            "step_records": step_records,
            "assertion_results": assertion_results,
            "screenshot_ids": screenshot_ids,
            "failing_step_index": failing_step_index or (len(step_records) if not all_assertions_passed else None),
            "failure_screenshot_id": last_fail_art,
            "annotated_screenshot_id": last_annot_art,
            "console_logs": list(self.session.console_logs),
            "page_errors": list(self.session.page_errors),
            "execution_error": execution_error,
            "final_url": page.url
        }
