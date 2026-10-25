import os
import pytest
from PIL import Image
from backend.app.services.image_annotator import ImageAnnotator
from backend.app.core.targets import get_sample_targets, get_target_by_id, reset_sample_target
from backend.app.services.benchmark_service import (
    BenchmarkService,
    SEEDED_GROUND_TRUTH,
    ASSESSMENT_GROUND_TRUTH,
    QUICKBITE_GROUND_TRUTH,
    QUICKBITE_JOURNEYS
)
from backend.app.db.models import (
    TestRun,
    TestCase,
    TestExecution,
    TestStepExecution,
    BugFinding,
    Artifact
)
from backend.app.db.session import SessionLocal, init_db

@pytest.fixture(scope="module")
def db_session():
    init_db()
    session = SessionLocal()
    yield session
    session.close()

@pytest.mark.asyncio
async def test_target_registry_and_reset():
    """Verify target registry returns DevStore, AssessPro, and QuickBite with valid metadata."""
    targets = get_sample_targets()
    target_ids = [t["id"] for t in targets]
    assert "devstore" in target_ids
    assert "assesspro" in target_ids
    assert "quickbite" in target_ids

    qb = get_target_by_id("quickbite")
    assert qb is not None
    assert qb["seeded_defect_count"] == 5
    assert "http://127.0.0.1:5001/quickbite" in qb["base_url"]

    ap = get_target_by_id("assesspro")
    assert ap is not None
    assert ap["seeded_defect_count"] == 5
    assert "http://127.0.0.1:5001/assesspro" in ap["base_url"]

    # Verify reset endpoint dispatches correctly
    reset_qb = await reset_sample_target("quickbite")
    assert reset_qb["success"] is True

    reset_ap = await reset_sample_target("assesspro")
    assert reset_ap["success"] is True

def test_quickbite_ground_truth_registry():
    """Verify QuickBite ground truth registry contains 5 seeded defects and 6 journeys."""
    assert len(QUICKBITE_GROUND_TRUTH) == 5
    defect_ids = [d["defect_id"] for d in QUICKBITE_GROUND_TRUTH]
    assert "QB-BUG-01" in defect_ids  # Cart quantity increment doesn't recalculate subtotal
    assert "QB-BUG-02" in defect_ids  # Invalid postal code bypassed without validation
    assert "QB-BUG-03" in defect_ids  # Fast double-click creates duplicate orders
    assert "QB-BUG-04" in defect_ids  # Declined payment incorrectly displays success
    assert "QB-BUG-05" in defect_ids  # Confirmation order status disagrees with backend

    assert len(QUICKBITE_JOURNEYS) == 6
    journey_ids = [j["journey_id"] for j in QUICKBITE_JOURNEYS]
    assert "JRN-QB01" in journey_ids
    assert "JRN-QB04" in journey_ids

def test_image_annotator_highlighting(tmp_path):
    """Verify ImageAnnotator creates an annotated failure image without modifying the original."""
    # Create a synthetic 1280x800 test screenshot
    orig_path = tmp_path / "original_step.png"
    img = Image.new("RGB", (1280, 800), color=(240, 244, 248))
    img.save(str(orig_path))

    annotated_path = tmp_path / "annotated_failure.png"
    bounding_box = {"x": 200, "y": 300, "width": 150, "height": 45}

    annotated = ImageAnnotator.annotate_failure(
        source_image_path=str(orig_path),
        output_image_path=str(annotated_path),
        bounding_box=bounding_box,
        label="Unexpected subtotal",
        severity="High"
    )

    assert annotated is True
    assert os.path.exists(str(annotated_path))
    # Check that original is unchanged and separate file exists
    assert os.path.exists(str(orig_path))
    assert os.path.getsize(str(annotated_path)) > 0
    # Check image dimensions preserved
    with Image.open(str(annotated_path)) as res_img:
        assert res_img.size == (1280, 800)

def test_step_execution_persistence_and_coverage(db_session):
    """Verify TestStepExecution persistence, screenshot associations, and coverage metrics."""
    import uuid
    run_id = f"test-step-run-{uuid.uuid4().hex[:6]}"
    test_id = f"{run_id}-TEST-QB01"

    run = TestRun(
        id=run_id,
        target_url="http://127.0.0.1:5001/quickbite",
        description="QuickBite End-to-End Journey Test",
        mode="workflow_focused",
        status="completed"
    )
    db_session.add(run)

    tc = TestCase(
        id=test_id,
        run_id=run_id,
        title="QuickBite: E2E Order Journey",
        status="Failed"
    )
    db_session.add(tc)

    # Add 4 test steps: 3 passing with screenshots, 1 failing with annotated screenshot
    steps_data = [
        ("goto", "Open QuickBite Homepage", "Passed", "art-s1-b", "art-s1-a", None),
        ("click", "Select Burger Bistro", "Passed", "art-s2-b", "art-s2-a", None),
        ("click", "Add Classic Cheeseburger to cart", "Passed", "art-s3-b", "art-s3-a", None),
        ("click", "Submit Checkout Payment", "Failed", "art-s4-b", "art-s4-a", "art-s4-annotated"),
    ]

    for idx, (act, desc, st, b_id, a_id, ann_id) in enumerate(steps_data):
        step_rec = TestStepExecution(
            id=f"step-{uuid.uuid4().hex[:8]}",
            test_case_id=test_id,
            run_id=run_id,
            step_index=idx,
            action=act,
            description=desc,
            status=st,
            url_before="http://127.0.0.1:5001/quickbite",
            url_after="http://127.0.0.1:5001/quickbite/checkout/payment",
            duration_sec=0.45,
            screenshot_before_id=b_id,
            screenshot_after_id=a_id,
            screenshot_annotated_id=ann_id,
            assertion_results=[{"type": "status_code", "passed": st == "Passed"}]
        )
        db_session.add(step_rec)

    db_session.commit()

    # Query step executions
    saved_steps = db_session.query(TestStepExecution).filter(TestStepExecution.run_id == run_id).order_by(TestStepExecution.step_index).all()
    assert len(saved_steps) == 4
    assert saved_steps[0].action == "goto"
    assert saved_steps[3].status == "Failed"
    assert saved_steps[3].screenshot_annotated_id == "art-s4-annotated"

    # Evaluate benchmark metrics calculation
    eval_res = BenchmarkService.evaluate_run(db_session, run_id, suite="quickbite")
    metrics = eval_res["metrics"]
    # 4 out of 4 executed steps have screenshot evidence => 1.0 (100%)
    assert metrics["screenshot_coverage"] == 1.0
    # 1 out of 1 failed step has annotated screenshot => 1.0 (100%)
    assert metrics["annotated_failure_coverage"] == 1.0
