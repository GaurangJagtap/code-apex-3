"""
Target Registry for Autonomous AI QA Engineer.
Maintains controlled demonstration applications and sample test targets.
"""
from typing import Dict, Any, List, Optional
import httpx

SAMPLE_TARGETS: List[Dict[str, Any]] = [
    {
        "id": "devstore",
        "name": "DevStore E-Commerce",
        "brand": "DevStore",
        "category": "E-Commerce & Retail",
        "base_url": "http://127.0.0.1:5001",
        "description": "Full-stack e-commerce benchmark target with catalog browsing, shopping cart arithmetic, checkout logistics, and user session management.",
        "seeded_defect_count": 5,
        "expected_duration": "45s",
        "workflows": [
            "Catalog Browsing & Product Details",
            "User Registration Input Validation",
            "Cart Quantity Update & Subtotal Recalculation (BUG-02)",
            "Checkout Logistics & Postal Code Boundary (BUG-03)",
            "Order Submission Idempotency & Throttle (BUG-04)",
            "Account Route Access Control Non-Disclosure (BUG-05)"
        ],
        "suggested_objectives": [
            "Functional testing",
            "Business logic and calculations",
            "Form validation and input boundaries",
            "Security findings"
        ],
        "reset_url": "http://127.0.0.1:5001/api/reset/devstore"
    },
    {
        "id": "assesspro",
        "name": "AssessPro Assessment Platform",
        "brand": "AssessPro",
        "category": "Recruitment & Online Testing",
        "base_url": "http://127.0.0.1:5001/assesspro",
        "description": "iMocha-style online assessment platform with timed exams, question palettes, answer persistence across reload, score reporting, and recruiter dashboards.",
        "seeded_defect_count": 5,
        "expected_duration": "45s",
        "workflows": [
            "Candidate Invitation & Instructions Acknowledgment",
            "Access Code Boundary & Format Validation (AP-BUG-05)",
            "Multi-question Navigation & Answer Palette State",
            "Simulated Page Refresh & Answer Persistence Invariant (AP-BUG-01)",
            "Submission Idempotency on Rapid Double Click (AP-BUG-02)",
            "Score Calculation Invariant Against Answer Key (AP-BUG-03)",
            "Recruiter Evaluation Dashboard Access Control (AP-BUG-04)"
        ],
        "suggested_objectives": [
            "Session, recovery, and interrupted workflows",
            "Transaction and workflow integrity",
            "Business logic and calculations",
            "Security findings"
        ],
        "reset_url": "http://127.0.0.1:5001/api/reset/assesspro"
    },
    {
        "id": "quickbite",
        "name": "QuickBite Food Delivery",
        "brand": "QuickBite",
        "category": "Food Delivery & Logistics",
        "base_url": "http://127.0.0.1:5001/quickbite",
        "description": "Realistic on-demand food delivery platform with cuisine filtering, restaurant menus, live cart recalculation, address management, local payment simulator, and order tracking.",
        "seeded_defect_count": 5,
        "expected_duration": "50s",
        "workflows": [
            "Restaurant Discovery, Cuisine Filters & Menu Navigation",
            "Cart Quantity Increment & Dynamic Subtotal Calculation (QB-BUG-01)",
            "Delivery Address Postal Code & Phone Boundary Validation (QB-BUG-02)",
            "Payment Submission Idempotency & Double Click Order Duplication (QB-BUG-03)",
            "Payment Simulator Decline Handling & Order Confirmation Invariant (QB-BUG-04)",
            "Order Confirmation Status vs Authoritative Persisted State (QB-BUG-05)",
            "Live Delivery Tracker & Order History Navigation"
        ],
        "suggested_objectives": [
            "Functional behavior and navigation",
            "Business logic and calculations",
            "Form validation and input boundaries",
            "Transaction and workflow integrity"
        ],
        "reset_url": "http://127.0.0.1:5001/api/reset/quickbite"
    }
]

def get_sample_targets() -> List[Dict[str, Any]]:
    return SAMPLE_TARGETS

def get_target_by_id(target_id: str) -> Optional[Dict[str, Any]]:
    for t in SAMPLE_TARGETS:
        if t["id"] == target_id.lower():
            return t
    return None

async def reset_sample_target(target_id: str) -> Dict[str, Any]:
    target = get_target_by_id(target_id)
    if not target:
        # Fallback to general reset
        reset_url = "http://127.0.0.1:5001/api/reset"
    else:
        reset_url = target.get("reset_url", "http://127.0.0.1:5001/api/reset")
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(reset_url)
            return {
                "success": True,
                "target_id": target_id,
                "status_code": resp.status_code,
                "message": f"Successfully reset sample target '{target_id}' to clean initial state."
            }
    except Exception as e:
        return {
            "success": False,
            "target_id": target_id,
            "error": str(e),
            "message": f"Failed to reset target '{target_id}': {e}"
        }
