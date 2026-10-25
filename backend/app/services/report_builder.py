import os
import json
import datetime
from typing import Dict, Any, List, Optional

class ReportBuilder:
    """
    Builds proof-carrying bug reports and test run export artifacts (HTML, JSON, Markdown, JUnit XML)
    containing step-by-step chronological execution timelines, expected vs actual observations,
    pre/post action screenshots, and visually highlighted defect annotations.
    """

    @staticmethod
    def generate_html_bug_report(finding: Dict[str, Any], run_info: Dict[str, Any]) -> str:
        fid = finding.get("id", "BUG-UNKNOWN")
        title = finding.get("title", "Untitled Defect")
        severity = finding.get("severity", "Medium")
        status = finding.get("status", "Confirmed")
        affected_url = finding.get("affected_url", "N/A")
        expected = finding.get("expected_behavior", "N/A")
        actual = finding.get("actual_behavior", "N/A")
        repro_steps = finding.get("reproduction_steps", [])
        screenshot_url = finding.get("screenshot_url")
        annotated_url = finding.get("annotated_screenshot_url")
        screenshot_before = finding.get("screenshot_before_url")
        screenshot_after = finding.get("screenshot_after_url")
        failed_step_idx = finding.get("failed_step_index")
        notes = finding.get("verification_notes", "")
        replays = finding.get("replay_attempts", 1)
        created_at = finding.get("created_at", datetime.datetime.now(datetime.timezone.utc).isoformat())

        severity_colors = {
            "Critical": "#dc2626",
            "High": "#ea580c",
            "Medium": "#d97706",
            "Low": "#2563eb"
        }
        sev_color = severity_colors.get(severity, "#475569")

        steps_html = "".join([
            f"<li style='margin-bottom: 8px;'><span style='color: {'#dc2626; font-weight: bold;' if failed_step_idx is not None and i == failed_step_idx else '#1e293b;'}'>{s}</span></li>"
            for i, s in enumerate(repro_steps)
        ])

        # Screenshots section
        evidence_cards = []
        if annotated_url:
            evidence_cards.append(f"""
            <div style="flex: 1; min-width: 320px; background: #fff1f2; border: 2px solid #f43f5e; border-radius: 8px; padding: 12px;">
                <div style="font-weight: 700; color: #be123c; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;">
                    <span>Visual Defect Highlight (Annotated)</span>
                    <span style="font-size: 0.75rem; background: #be123c; color: white; padding: 2px 8px; border-radius: 4px;">PULSED REGION</span>
                </div>
                <img src="{annotated_url}" alt="Annotated Bug Screenshot" style="width: 100%; height: auto; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);" />
                <p style="font-size: 0.8rem; color: #881337; margin: 8px 0 0;">Defective element or region highlighted with contrasting outline and translucent overlay.</p>
            </div>
            """)
        elif screenshot_url:
            evidence_cards.append(f"""
            <div style="flex: 1; min-width: 320px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px;">
                <div style="font-weight: 700; color: #0f172a; margin-bottom: 8px;">Observed Failure Screenshot</div>
                <img src="{screenshot_url}" alt="Failure Screenshot" style="width: 100%; height: auto; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);" />
            </div>
            """)

        if screenshot_before:
            evidence_cards.append(f"""
            <div style="flex: 1; min-width: 280px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px;">
                <div style="font-weight: 700; color: #047857; margin-bottom: 8px;">Pre-Action Baseline (Before)</div>
                <img src="{screenshot_before}" alt="Pre-action Screenshot" style="width: 100%; height: auto; border-radius: 6px;" />
            </div>
            """)

        if screenshot_after and screenshot_after != screenshot_url:
            evidence_cards.append(f"""
            <div style="flex: 1; min-width: 280px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px;">
                <div style="font-weight: 700; color: #1e293b; margin-bottom: 8px;">Post-Action State (After)</div>
                <img src="{screenshot_after}" alt="Post-action Screenshot" style="width: 100%; height: auto; border-radius: 6px;" />
            </div>
            """)

        evidence_section = f"""
        <div style="margin-top: 24px;">
            <div class="label" style="margin-bottom: 12px;">Step-by-Step Screenshot Evidence</div>
            <div style="display: flex; flex-wrap: wrap; gap: 16px;">
                {"".join(evidence_cards)}
            </div>
        </div>
        """ if evidence_cards else ""

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Bug Report — {fid}: {title}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0f172a;
            color: #f1f5f9;
            padding: 30px;
            line-height: 1.6;
        }}
        .report-card {{
            max-width: 960px;
            margin: 0 auto;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
        }}
        .header {{
            border-bottom: 1px solid #334155;
            padding-bottom: 20px;
            margin-bottom: 24px;
        }}
        .badge {{
            display: inline-block;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 0.8rem;
            font-weight: 700;
            color: white;
            margin-right: 8px;
        }}
        .field-group {{
            margin-bottom: 18px;
        }}
        .label {{
            font-size: 0.8rem;
            font-weight: 700;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 6px;
        }}
        .value-box {{
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 14px;
            font-size: 0.95rem;
            color: #e2e8f0;
        }}
    </style>
</head>
<body>
    <div class="report-card">
        <div class="header">
            <span class="badge" style="background: {sev_color};">{severity}</span>
            <span class="badge" style="background: #059669;">{status}</span>
            {f'<span class="badge" style="background: #e11d48;">Failing Step #{failed_step_idx + 1}</span>' if failed_step_idx is not None else ''}
            <span style="font-size: 0.85rem; color: #94a3b8; float: right;">Recorded: {str(created_at)[:19]}</span>
            <h1 style="color: #38bdf8; margin: 16px 0 6px; font-size: 1.6rem;">[{fid}] {title}</h1>
            <p style="color: #cbd5e1; font-size: 0.95rem; margin: 0;">Target Route: <code style="color: #34d399;">{affected_url}</code></p>
        </div>

        <div class="field-group">
            <div class="label">Reproducibility & Verifier Finding</div>
            <div class="value-box">
                <strong>Verifier Note:</strong> {notes or 'Independent browser replay confirmed expected state failure.'}<br>
                <strong>Replay Sessions:</strong> {replays} verification run(s) executed.
            </div>
        </div>

        <div class="field-group">
            <div class="label">Step-by-Step Reproduction Journey</div>
            <div class="value-box">
                <ol style="margin: 0; padding-left: 20px;">
                    {steps_html}
                </ol>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px;">
            <div class="field-group">
                <div class="label">Expected Behavior</div>
                <div class="value-box" style="border-left: 4px solid #10b981;">
                    {expected}
                </div>
            </div>
            <div class="field-group">
                <div class="label">Actual Observed Defect</div>
                <div class="value-box" style="border-left: 4px solid #ef4444;">
                    {actual}
                </div>
            </div>
        </div>

        {evidence_section}

        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #334155; font-size: 0.85rem; color: #64748b; text-align: center;">
            Autonomous AI QA Engineer Proof-Carrying Report &bull; Run ID: {run_info.get('id', 'N/A')}
        </div>
    </div>
</body>
</html>"""
        return html

    @staticmethod
    def generate_markdown_bug_report(finding: Dict[str, Any], run_info: Dict[str, Any]) -> str:
        fid = finding.get("id", "BUG-UNKNOWN")
        title = finding.get("title", "Untitled Defect")
        severity = finding.get("severity", "Medium")
        status = finding.get("status", "Verified")
        affected_url = finding.get("affected_url", "N/A")
        expected = finding.get("expected_behavior", "N/A")
        actual = finding.get("actual_behavior", "N/A")
        repro_steps = finding.get("reproduction_steps", [])
        screenshot_url = finding.get("screenshot_url")
        annotated_url = finding.get("annotated_screenshot_url")
        screenshot_before = finding.get("screenshot_before_url")
        screenshot_after = finding.get("screenshot_after_url")
        failed_step_idx = finding.get("failed_step_index")
        notes = finding.get("verification_notes", "")
        replays = finding.get("replay_attempts", 1)
        created_at = finding.get("created_at", datetime.datetime.now(datetime.timezone.utc).isoformat())

        steps_md = "\n".join([
            f"{i+1}. {'**[FAILING STEP]** ' if failed_step_idx is not None and i == failed_step_idx else ''}{s}"
            for i, s in enumerate(repro_steps)
        ]) or "1. Direct navigation to target route."

        md = f"""# Proof-Carrying Defect Report: [{fid}] {title}

- **Finding Status:** `{status}`
- **Severity Level:** `{severity}`
- **Affected Route:** `{affected_url}`
- **Test Run ID:** `{run_info.get('id', 'N/A')}`
- **Timestamp:** `{created_at}`
- **Failing Step Index:** {f'Step #{failed_step_idx + 1}' if failed_step_idx is not None else 'N/A'}
- **Replay Verification:** {replays} independent session(s)

---

## 1. Reproducibility & Verifier Finding
> {notes or 'Independent browser replay confirmed failure.'}

## 2. Step-by-Step Reproduction Instructions
{steps_md}

## 3. Discrepancy Matrix

| Dimension | Observation |
| :--- | :--- |
| **Expected Behavior** | {expected} |
| **Actual Defective Outcome** | {actual} |

## 4. Screenshot Evidence Artifacts
- **Annotated Failure (Visual Highlight):** {annotated_url or 'N/A'}
- **Observed Failure Screenshot:** {screenshot_url or 'N/A'}
- **Pre-Action Screenshot (Before):** {screenshot_before or 'N/A'}
- **Post-Action Screenshot (After):** {screenshot_after or 'N/A'}

---
*Generated autonomously by Autonomous AI QA Engineer*
"""
        return md

    @staticmethod
    def generate_html_run_report(
        run: Dict[str, Any],
        tests: List[Dict[str, Any]],
        findings: List[Dict[str, Any]],
        step_executions: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        run_id = run.get("id", "run-unknown")
        target_url = run.get("target_url", "N/A")
        status = run.get("status", "completed")
        duration = run.get("duration_sec", 0.0)
        total_tests = len(tests)
        passed_tests = sum(1 for t in tests if t.get("status") == "Passed")
        failed_tests = sum(1 for t in tests if t.get("status") in ("Failed", "Blocked"))

        # Render test journeys & steps
        test_sections = []
        for t in tests:
            t_id = t.get("id", "T")
            t_title = t.get("title", "Untitled Test")
            t_status = t.get("status", "Passed")
            t_cat = t.get("category", "Functional")
            t_dur = t.get("duration_sec", 0.0)
            
            badge_color = "#059669" if t_status == "Passed" else "#dc2626"

            # Filter steps for this test if available
            steps = []
            if step_executions:
                steps = [s for s in step_executions if s.get("test_case_id") == t_id]
            if not steps:
                # Fallback to test's own step records
                steps = t.get("step_records") or []

            steps_rows = []
            for s in steps:
                s_idx = s.get("step_index", 0) + 1
                s_act = s.get("action", "action")
                s_desc = s.get("description", "Execute action")
                s_status = s.get("status", "Passed")
                s_dur = s.get("duration_sec", 0.0)
                s_before = s.get("screenshot_before_url")
                s_after = s.get("screenshot_after_url")
                s_annotated = s.get("screenshot_annotated_url")
                s_fail = s.get("screenshot_failure_url")

                s_badge = "#059669" if s_status == "Passed" else "#dc2626"

                thumbs = []
                if s_before:
                    thumbs.append(f"""<a href="{s_before}" target="_blank" style="margin-right: 6px;"><img src="{s_before}" title="Before Action" style="height: 48px; border-radius: 4px; border: 1px solid #475569;" /></a>""")
                if s_after:
                    thumbs.append(f"""<a href="{s_after}" target="_blank" style="margin-right: 6px;"><img src="{s_after}" title="After Action" style="height: 48px; border-radius: 4px; border: 1px solid #475569;" /></a>""")
                if s_annotated:
                    thumbs.append(f"""<a href="{s_annotated}" target="_blank" style="margin-right: 6px;"><img src="{s_annotated}" title="Annotated Defect" style="height: 48px; border-radius: 4px; border: 2px solid #f43f5e;" /></a>""")
                elif s_fail:
                    thumbs.append(f"""<a href="{s_fail}" target="_blank" style="margin-right: 6px;"><img src="{s_fail}" title="Failure" style="height: 48px; border-radius: 4px; border: 1px solid #ef4444;" /></a>""")

                thumbs_html = "".join(thumbs) if thumbs else "<span style='color: #64748b; font-size: 0.8rem;'>No capture</span>"

                steps_rows.append(f"""
                <tr style="border-bottom: 1px solid #334155;">
                    <td style="padding: 10px; font-weight: bold; color: #94a3b8;">#{s_idx}</td>
                    <td style="padding: 10px;"><code style="color: #38bdf8;">{s_act}</code></td>
                    <td style="padding: 10px; color: #f1f5f9;">{s_desc}</td>
                    <td style="padding: 10px;"><span style="background: {s_badge}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">{s_status}</span></td>
                    <td style="padding: 10px; color: #94a3b8; font-size: 0.85rem;">{s_dur:.2f}s</td>
                    <td style="padding: 10px;">{thumbs_html}</td>
                </tr>
                """)

            steps_table = f"""
            <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.9rem;">
                <thead>
                    <tr style="background: #0f172a; text-align: left; color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">
                        <th style="padding: 8px 10px;">Step</th>
                        <th style="padding: 8px 10px;">Action</th>
                        <th style="padding: 8px 10px;">Description</th>
                        <th style="padding: 8px 10px;">Status</th>
                        <th style="padding: 8px 10px;">Duration</th>
                        <th style="padding: 8px 10px;">Evidence (Thumbnails)</th>
                    </tr>
                </thead>
                <tbody>
                    {"".join(steps_rows)}
                </tbody>
            </table>
            """ if steps_rows else "<p style='color: #64748b; font-size: 0.85rem;'>No individual step records captured.</p>"

            test_sections.append(f"""
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 18px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="background: {badge_color}; color: white; padding: 3px 10px; border-radius: 9999px; font-size: 0.8rem; font-weight: bold; margin-right: 8px;">{t_status}</span>
                        <span style="color: #94a3b8; font-size: 0.85rem; margin-right: 8px;">[{t_cat}]</span>
                        <strong style="color: #f1f5f9; font-size: 1.1rem;">[{t_id}] {t_title}</strong>
                    </div>
                    <span style="color: #94a3b8; font-size: 0.85rem;">Duration: {t_dur:.2f}s</span>
                </div>
                {steps_table}
            </div>
            """)

        # Findings section
        finding_rows = []
        for f in findings:
            f_id = f.get("id", "BUG")
            f_title = f.get("title", "Defect")
            f_sev = f.get("severity", "Medium")
            f_status = f.get("status", "Verified")
            f_step = f.get("failed_step_index")
            f_annotated = f.get("annotated_screenshot_url")

            sev_color = "#dc2626" if f_sev == "Critical" else ("#ea580c" if f_sev == "High" else "#d97706")
            annotated_thumb = f"""<a href="{f_annotated}" target="_blank"><img src="{f_annotated}" style="height: 40px; border-radius: 4px; border: 2px solid #f43f5e;" /></a>""" if f_annotated else "<span style='color: #64748b;'>N/A</span>"

            finding_rows.append(f"""
            <tr style="border-bottom: 1px solid #334155;">
                <td style="padding: 10px; font-weight: bold; color: #38bdf8;">{f_id}</td>
                <td style="padding: 10px;"><span style="background: {sev_color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">{f_sev}</span></td>
                <td style="padding: 10px; color: #f1f5f9;">{f_title}</td>
                <td style="padding: 10px;"><span style="background: #059669; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">{f_status}</span></td>
                <td style="padding: 10px; color: #f43f5e; font-weight: bold;">{f'Step #{f_step + 1}' if f_step is not None else 'N/A'}</td>
                <td style="padding: 10px;">{annotated_thumb}</td>
            </tr>
            """)

        findings_table = f"""
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.9rem;">
            <thead>
                <tr style="background: #0f172a; text-align: left; color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">
                    <th style="padding: 8px 10px;">ID</th>
                    <th style="padding: 8px 10px;">Severity</th>
                    <th style="padding: 8px 10px;">Defect Title</th>
                    <th style="padding: 8px 10px;">Status</th>
                    <th style="padding: 8px 10px;">Failing Step</th>
                    <th style="padding: 8px 10px;">Annotated Screenshot</th>
                </tr>
            </thead>
            <tbody>
                {"".join(finding_rows)}
            </tbody>
        </table>
        """ if finding_rows else "<p style='color: #10b981; font-weight: bold;'>Zero defects identified in this execution.</p>"

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Autonomous AI QA Run Report — {run_id}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0f172a;
            color: #f1f5f9;
            padding: 30px;
            line-height: 1.6;
        }}
        .container {{
            max-width: 1100px;
            margin: 0 auto;
        }}
        .metric-card {{
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            flex: 1;
            min-width: 160px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1 style="color: #38bdf8; margin: 0 0 6px; font-size: 1.8rem;">Autonomous AI QA Engineer &bull; Run Report</h1>
                    <p style="color: #94a3b8; margin: 0;">Target: <code style="color: #34d399;">{target_url}</code> &bull; Run ID: <code>{run_id}</code></p>
                </div>
                <div>
                    <span style="background: {'#059669' if status in ('completed', 'success') else '#3b82f6'}; color: white; padding: 6px 14px; border-radius: 9999px; font-size: 0.9rem; font-weight: bold;">{status.upper()}</span>
                </div>
            </div>

            <!-- Metrics Row -->
            <div style="display: flex; gap: 16px; margin-top: 20px; flex-wrap: wrap;">
                <div class="metric-card">
                    <div style="font-size: 1.6rem; font-weight: bold; color: #38bdf8;">{total_tests}</div>
                    <div style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase;">Total Journeys</div>
                </div>
                <div class="metric-card">
                    <div style="font-size: 1.6rem; font-weight: bold; color: #10b981;">{passed_tests}</div>
                    <div style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase;">Passed</div>
                </div>
                <div class="metric-card">
                    <div style="font-size: 1.6rem; font-weight: bold; color: #f43f5e;">{failed_tests}</div>
                    <div style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase;">Failed</div>
                </div>
                <div class="metric-card">
                    <div style="font-size: 1.6rem; font-weight: bold; color: #f59e0b;">{len(findings)}</div>
                    <div style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase;">Defects Discovered</div>
                </div>
                <div class="metric-card">
                    <div style="font-size: 1.6rem; font-weight: bold; color: #e2e8f0;">{duration:.1f}s</div>
                    <div style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase;">Execution Time</div>
                </div>
            </div>
        </div>

        <!-- Defect Summary -->
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h2 style="color: #f43f5e; margin: 0 0 12px; font-size: 1.3rem;">Proof-Carrying Bug Findings</h2>
            {findings_table}
        </div>

        <!-- Chronological Test Journeys & Step-by-Step Evidence -->
        <div>
            <h2 style="color: #38bdf8; margin: 0 0 16px; font-size: 1.3rem;">Chronological Test Journeys & Step-by-Step Screenshot Evidence</h2>
            {"".join(test_sections)}
        </div>

        <div style="margin-top: 40px; padding: 20px 0; border-top: 1px solid #334155; font-size: 0.85rem; color: #64748b; text-align: center;">
            Autonomous AI QA Engineer Proof-Carrying Evidence Report &bull; Generated {datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")}
        </div>
    </div>
</body>
</html>"""
        return html

    @staticmethod
    def generate_junit_xml_report(run: Dict[str, Any], tests: List[Dict[str, Any]], findings: List[Dict[str, Any]]) -> str:
        import html
        total = len(tests)
        failed = sum(1 for t in tests if t.get("status") in ("Failed", "Blocked"))
        duration = run.get("duration_sec", 0.0)
        run_id = run.get("id", "run-unknown")

        xml_lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            f'<testsuites name="Autonomous AI QA Engineer" tests="{total}" failures="{failed}" errors="0" time="{duration:.2f}">',
            f'  <testsuite name="{html.escape(run_id)}" tests="{total}" failures="{failed}" errors="0" time="{duration:.2f}">'
        ]

        for t in tests:
            t_id = html.escape(str(t.get("id", "TC")))
            t_title = html.escape(str(t.get("title", "Test")))
            t_cat = html.escape(str(t.get("category", "Functional")))
            t_dur = float(t.get("duration_sec", 0.1))
            t_status = t.get("status", "Passed")

            xml_lines.append(f'    <testcase classname="{t_cat}" name="[{t_id}] {t_title}" time="{t_dur:.2f}">')
            if t_status in ("Failed", "Blocked"):
                reason = html.escape(str(t.get("actual_observations") or t.get("risk_reason") or "Assertion failure"))
                xml_lines.append(f'      <failure message="Defect verified during browser execution" type="{t_status}">{reason}</failure>')
            xml_lines.append('    </testcase>')

        xml_lines.append('  </testsuite>')
        xml_lines.append('</testsuites>')
        return "\n".join(xml_lines)
