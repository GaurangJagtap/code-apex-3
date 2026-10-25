import os
import uuid
import datetime
from typing import Optional, Dict, List, Any
from fastapi import FastAPI, Request, Form, Response, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="DevStore Controlled Sample E-Commerce App", version="1.0.0")

# Mount static and templates
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

def render_template(request: Request, name: str, context: Optional[Dict[str, Any]] = None) -> HTMLResponse:
    ctx = context or {}
    ctx["request"] = request
    return templates.TemplateResponse(request, name, ctx)

# Initial Synthetic Data
INITIAL_PRODUCTS = [
    {
        "id": "PRD-01",
        "name": "DevPulse Mechanical Keyboard",
        "category": "Hardware",
        "price": 129.99,
        "description": "Custom hot-swappable tactile switches, RGB underglow, aircraft-grade aluminum casing.",
    },
    {
        "id": "PRD-02",
        "name": "UltraWide 4K Coding Monitor",
        "category": "Hardware",
        "price": 449.00,
        "description": "34-inch curved IPS panel, USB-C 90W power delivery, 99% sRGB color accuracy.",
    },
    {
        "id": "PRD-03",
        "name": "Ergonomic Mesh Task Chair",
        "category": "Furniture",
        "price": 289.50,
        "description": "Breathable mesh backing, dynamic lumbar support, 4D adjustable armrests.",
    },
    {
        "id": "PRD-04",
        "name": "Studio ANC Headphones",
        "category": "Audio",
        "price": 199.00,
        "description": "Active noise cancellation tuned for engineering focus, 40-hour battery life.",
    },
    {
        "id": "PRD-05",
        "name": "Thunderbolt 4 Pro Dock",
        "category": "Accessories",
        "price": 149.00,
        "description": "12-in-1 connectivity hub supporting dual 4K 60Hz displays and 10Gbps transfers.",
    },
]

INITIAL_USERS = {
    "tester@apexqa.io": {
        "name": "Alex QA Lead",
        "email": "tester@apexqa.io",
        "password": "Password123!",
        "created_at": "2026-01-15T10:00:00Z"
    }
}

# Runtime In-Memory State
db_products: List[Dict[str, Any]] = [dict(p) for p in INITIAL_PRODUCTS]
db_users: Dict[str, Dict[str, Any]] = {k: dict(v) for k, v in INITIAL_USERS.items()}
db_carts: Dict[str, List[Dict[str, Any]]] = {}
db_orders: List[Dict[str, Any]] = []

INITIAL_ASSESSMENT_SUBMISSIONS = [
    {
        "submission_id": "SUB-INIT-01",
        "candidate_name": "Taylor Dev",
        "candidate_email": "taylor.dev@example.com",
        "score_percent": "100%",
        "submitted_at": "2026-03-01 14:30"
    }
]
db_assessment_submissions: List[Dict[str, Any]] = list(INITIAL_ASSESSMENT_SUBMISSIONS)
db_candidate_sessions: Dict[str, Dict[str, Any]] = {}

# Initial Synthetic Data for QuickBite Food Delivery
INITIAL_QB_RESTAURANTS = [
    {
        "id": "REST-01",
        "name": "Burger Haven",
        "cuisine": "Gourmet Burgers & Shakes",
        "rating": 4.8,
        "delivery_time": 20,
        "delivery_fee": 2.99,
        "price_range": "$$",
        "emoji": "🍔",
        "bg_color": "#ffedd5",
        "address": "104 Pine Street, Financial District"
    },
    {
        "id": "REST-02",
        "name": "Tokyo Ramen Bar",
        "cuisine": "Artisan Ramen & Dumplings",
        "rating": 4.9,
        "delivery_time": 25,
        "delivery_fee": 3.49,
        "price_range": "$$",
        "emoji": "🍜",
        "bg_color": "#fee2e2",
        "address": "520 Japantown Center"
    },
    {
        "id": "REST-03",
        "name": "Bella Italia Pizza",
        "cuisine": "Wood-Fired Neapolitan Pizza",
        "rating": 4.7,
        "delivery_time": 25,
        "delivery_fee": 3.99,
        "price_range": "$$$",
        "emoji": "🍕",
        "bg_color": "#fef3c7",
        "address": "812 Columbus Ave, North Beach"
    },
    {
        "id": "REST-04",
        "name": "Green Bowl Organics",
        "cuisine": "Healthy Grain Bowls & Salads",
        "rating": 4.8,
        "delivery_time": 15,
        "delivery_fee": 1.99,
        "price_range": "$$",
        "emoji": "🥗",
        "bg_color": "#ecfdf5",
        "address": "320 Market Street"
    }
]

INITIAL_QB_MENU_ITEMS = [
    {"id": "QB-ITM-01", "restaurant_id": "REST-01", "name": "Truffle Bacon Cheeseburger", "category": "Mains", "price": 14.99, "description": "Double smashed angus beef, aged white cheddar, smoked bacon, black truffle aioli on toasted brioche."},
    {"id": "QB-ITM-02", "restaurant_id": "REST-01", "name": "Crispy Chicken Deluxe Burger", "category": "Mains", "price": 12.49, "description": "Spicy buttermilk fried chicken breast, pickled slaw, honey mustard drizzle."},
    {"id": "QB-ITM-03", "restaurant_id": "REST-01", "name": "Truffle Parmesan Fries", "category": "Sides", "price": 5.99, "description": "Hand-cut Idaho potatoes, fresh herbs, shaved parmesan, garlic aioli dip."},
    {"id": "QB-ITM-04", "restaurant_id": "REST-01", "name": "Salted Caramel Shake", "category": "Beverages", "price": 6.50, "description": "Hand-spun Madagascar vanilla gelato, sea salt caramel swirl, whipped cream."},
    {"id": "QB-ITM-05", "restaurant_id": "REST-02", "name": "Tonkotsu Rich Pork Ramen", "category": "Mains", "price": 16.50, "description": "16-hour simmered pork bone broth, chashu pork belly, ajitsuke tamago, nori, scallions."},
    {"id": "QB-ITM-06", "restaurant_id": "REST-02", "name": "Crispy Pork Gyoza (6 pcs)", "category": "Sides", "price": 7.99, "description": "Pan-seared handmade dumplings with ginger pork filling and scallion ponzu dip."},
    {"id": "QB-ITM-07", "restaurant_id": "REST-03", "name": "Margherita Con Bufala Pizza", "category": "Mains", "price": 17.50, "description": "San Marzano tomato sauce, fresh buffalo mozzarella, sweet basil, cold-pressed olive oil."},
    {"id": "QB-ITM-08", "restaurant_id": "REST-04", "name": "Avocado Grain Salad Bowl", "category": "Mains", "price": 13.50, "description": "Organic quinoa, Hass avocado, roasted sweet potato, baby kale, lemon tahini vinaigrette."}
]

db_qb_restaurants: List[Dict[str, Any]] = [dict(r) for r in INITIAL_QB_RESTAURANTS]
db_qb_menu_items: List[Dict[str, Any]] = [dict(i) for i in INITIAL_QB_MENU_ITEMS]
db_qb_carts: Dict[str, List[Dict[str, Any]]] = {}
db_qb_addresses: Dict[str, Dict[str, Any]] = {}
db_qb_orders: List[Dict[str, Any]] = []
db_qb_frozen_subtotals: Dict[str, float] = {}

# Controlled Seeded Defects Mode (True = Planted Defect Active; False = Clean/Fixed Build)
SEEDED_DEFECTS_STATE: Dict[str, bool] = {
    # 1. DevStore E-Commerce Seeded Defects (Preserved!)
    "BUG-01": True,  # Faulty Email Format Validation (/register)
    "BUG-02": True,  # Cart Subtotal Calculation Failure on Quantity Update (/cart)
    "BUG-03": True,  # Missing Validation on Required Postal/ZIP Code (/checkout)
    "BUG-04": True,  # Non-Idempotent Duplicate Order Submission (/checkout)
    "BUG-05": True,  # Broken Access Control on Protected Account Route (/account)

    # 2. AssessPro Online Assessment Seeded Defects
    "AP-BUG-01": True,  # State Recovery Failure: Answer State Lost on Page Refresh (/assesspro/assessment/test)
    "AP-BUG-02": True,  # Question Palette Displays Wrong Answered Status
    "AP-BUG-03": True,  # Score Calculation Arithmetic Bug: Reports 33% instead of 100% (/assesspro/submit)
    "AP-BUG-04": True,  # Non-Idempotent Duplicate Assessment Submission on Rapid Click (/assesspro/submit)
    "AP-BUG-05": True,  # Broken Access Control on Recruiter Console (/assesspro/recruiter)
    # Backward compatibility aliases
    "ASSESS-01": True,
    "ASSESS-02": True,
    "ASSESS-03": True,
    "ASSESS-04": True,
    "ASSESS-05": True,

    # 3. QuickBite Food Delivery Seeded Defects
    "QB-BUG-01": True,  # Cart Subtotal Calculation Failure on Quantity Change (/quickbite/cart)
    "QB-BUG-02": True,  # Missing Validation on Required Postal Code / Phone on Address (/quickbite/checkout/address)
    "QB-BUG-03": True,  # Non-Idempotent Duplicate Order Creation on Rapid Click (/quickbite/checkout/place-order)
    "QB-BUG-04": True,  # Declined Payment Incorrectly Confirmed as Paid Order (/quickbite/checkout/place-order)
    "QB-BUG-05": True,  # Cart Contents Wiped on Page Reload During Checkout (/quickbite/checkout/address)
}

def get_session_id(request: Request) -> str:
    session_id = request.cookies.get("devstore_session")
    if not session_id:
        session_id = str(uuid.uuid4())
    return session_id

def get_current_user(request: Request) -> Optional[Dict[str, Any]]:
    user_email = request.cookies.get("devstore_user")
    if user_email and user_email in db_users:
        return db_users[user_email]
    return None

def get_cart_for_session(session_id: str) -> List[Dict[str, Any]]:
    if session_id not in db_carts:
        db_carts[session_id] = []
    return db_carts[session_id]

def get_cart_count(session_id: str) -> int:
    cart = get_cart_for_session(session_id)
    return sum(item["quantity"] for item in cart)

# ----------------- Seeded Defect Endpoints & Pages -----------------

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    session_id = get_session_id(request)
    user = get_current_user(request)
    response = render_template(request, "index.html", {
        "products": db_products,
        "cart_count": get_cart_count(session_id),
        "user": user
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/products", response_class=HTMLResponse)
async def products(request: Request):
    session_id = get_session_id(request)
    user = get_current_user(request)
    response = render_template(request, "products.html", {
        "products": db_products,
        "cart_count": get_cart_count(session_id),
        "user": user
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/products/{product_id}", response_class=HTMLResponse)
async def product_detail(product_id: str, request: Request):
    session_id = get_session_id(request)
    user = get_current_user(request)
    product = next((p for p in db_products if p["id"] == product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    response = render_template(request, "product_detail.html", {
        "product": product,
        "cart_count": get_cart_count(session_id),
        "user": user
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/cart", response_class=HTMLResponse)
async def view_cart(request: Request):
    session_id = get_session_id(request)
    user = get_current_user(request)
    cart = get_cart_for_session(session_id)
    
    # Calculate cart totals
    cart_items = []
    raw_subtotal = 0.0
    for item in cart:
        prod = next((p for p in db_products if p["id"] == item["product_id"]), None)
        if prod:
            line_total = prod["price"] * item["quantity"]
            raw_subtotal += line_total
            cart_items.append({
                "product": prod,
                "quantity": item["quantity"],
                "line_total": line_total
            })

    shipping = 15.00 if cart_items else 0.0
    tax = round(raw_subtotal * 0.08, 2)
    total = raw_subtotal + shipping + tax

    response = render_template(request, "cart.html", {
        "items": cart_items,
        "subtotal": raw_subtotal,
        "shipping": shipping,
        "tax": tax,
        "total": total,
        "cart_count": sum(i["quantity"] for i in cart_items),
        "user": user,
        "defects_enabled": SEEDED_DEFECTS_STATE.get("BUG-02", True)
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.post("/cart/add")
async def add_to_cart(
    request: Request,
    product_id: str = Form(...),
    quantity: int = Form(1)
):
    session_id = get_session_id(request)
    cart = get_cart_for_session(session_id)
    
    existing = next((item for item in cart if item["product_id"] == product_id), None)
    if existing:
        existing["quantity"] += quantity
    else:
        cart.append({"product_id": product_id, "quantity": quantity})
        
    response = RedirectResponse(url="/cart", status_code=303)
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.post("/cart/update")
async def update_cart_item(
    request: Request,
    product_id: str = Form(...),
    quantity: int = Form(...)
):
    session_id = get_session_id(request)
    cart = get_cart_for_session(session_id)
    for item in cart:
        if item["product_id"] == product_id:
            item["quantity"] = max(1, quantity)
            break
    return JSONResponse({"status": "ok", "product_id": product_id, "quantity": quantity})

@app.post("/cart/remove")
async def remove_cart_item(
    request: Request,
    product_id: str = Form(...)
):
    session_id = get_session_id(request)
    cart = get_cart_for_session(session_id)
    db_carts[session_id] = [item for item in cart if item["product_id"] != product_id]
    response = RedirectResponse(url="/cart", status_code=303)
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/checkout", response_class=HTMLResponse)
async def checkout_page(request: Request):
    session_id = get_session_id(request)
    user = get_current_user(request)
    cart = get_cart_for_session(session_id)
    
    if not cart:
        return RedirectResponse(url="/cart", status_code=303)

    response = render_template(request, "checkout.html", {
        "default_name": user["name"] if user else "",
        "default_email": user["email"] if user else "",
        "cart_count": get_cart_count(session_id),
        "user": user,
        "error": None,
        "bug04_active": SEEDED_DEFECTS_STATE.get("BUG-04", True)
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.post("/checkout")
async def process_checkout(
    request: Request,
    fullname: str = Form(...),
    email: str = Form(...),
    address: str = Form(...),
    city: str = Form(...),
    postal_code: Optional[str] = Form(None), # SEEDED BUG BUG-03: Not validated as required when defect active
    country: str = Form("US"),
    payment_method: str = Form("card")
):
    session_id = get_session_id(request)
    user = get_current_user(request)
    cart = get_cart_for_session(session_id)

    if not cart:
        return RedirectResponse(url="/cart", status_code=303)

    # Seeded Defect BUG-03: Required postal code validation
    if not SEEDED_DEFECTS_STATE.get("BUG-03", True):
        if not postal_code or not postal_code.strip():
            return render_template(request, "checkout.html", {
                "default_name": fullname,
                "default_email": email,
                "cart_count": get_cart_count(session_id),
                "user": user,
                "error": "Postal / ZIP Code is required.",
                "bug04_active": SEEDED_DEFECTS_STATE.get("BUG-04", True)
            })

    # Seeded Defect BUG-04: Idempotency enforcement against duplicate submissions
    if not SEEDED_DEFECTS_STATE.get("BUG-04", True):
        now = datetime.datetime.now(datetime.timezone.utc)
        for existing_ord in reversed(db_orders):
            if existing_ord.get("session_id") == session_id and existing_ord.get("email") == email:
                try:
                    dt = datetime.datetime.fromisoformat(existing_ord["created_at"])
                    if (now - dt).total_seconds() < 5:
                        return RedirectResponse(url=f"/order-confirmation/{existing_ord['id']}", status_code=303)
                except Exception:
                    pass

    subtotal = 0.0
    for item in cart:
        prod = next((p for p in db_products if p["id"] == item["product_id"]), None)
        if prod:
            subtotal += prod["price"] * item["quantity"]
            
    total = subtotal + 15.00 + round(subtotal * 0.08, 2)

    # SEEDED BUG BUG-04: Non-idempotent order placement without duplicate check
    order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
    new_order = {
        "id": order_id,
        "session_id": session_id,
        "fullname": fullname,
        "email": email,
        "address": address,
        "city": city,
        "postal_code": postal_code or "",
        "country": country,
        "payment_method": payment_method,
        "total": total,
        "items": [dict(i) for i in cart],
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    db_orders.append(new_order)

    # Empty cart
    db_carts[session_id] = []

    response = RedirectResponse(url=f"/order-confirmation/{order_id}", status_code=303)
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/order-confirmation/{order_id}", response_class=HTMLResponse)
async def order_confirmation(order_id: str, request: Request):
    session_id = get_session_id(request)
    user = get_current_user(request)
    order = next((o for o in db_orders if o["id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    response = render_template(request, "order_confirmation.html", {
        "order": order,
        "cart_count": get_cart_count(session_id),
        "user": user
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    session_id = get_session_id(request)
    user = get_current_user(request)
    response = render_template(request, "register.html", {
        "cart_count": get_cart_count(session_id),
        "user": user,
        "error": None,
        "success": None
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.post("/register")
async def register_user(
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...)
):
    session_id = get_session_id(request)
    
    if password != confirm_password:
        return render_template(request, "register.html", {
            "cart_count": get_cart_count(session_id),
            "user": None,
            "error": "Passwords do not match.",
            "success": None
        })

    # Seeded Defect BUG-01: Faulty email validation
    if SEEDED_DEFECTS_STATE.get("BUG-01", True):
        if len(email) < 3:
            return render_template(request, "register.html", {
                "cart_count": get_cart_count(session_id),
                "user": None,
                "error": "Please provide a valid email address.",
                "success": None
            })
    else:
        # Fixed BUG-01: Strict email regex format check
        import re
        if not re.match(r"^[\w\.\+\-]+@[\w\-]+\.[a-zA-Z]{2,}$", email):
            return render_template(request, "register.html", {
                "cart_count": get_cart_count(session_id),
                "user": None,
                "error": "Please provide a valid email address with @ and domain.",
                "success": None
            })

    db_users[email] = {
        "name": name,
        "email": email,
        "password": password,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

    response = render_template(request, "register.html", {
        "cart_count": get_cart_count(session_id),
        "user": None,
        "error": None,
        "success": f"Account created for {email}! You can now sign in."
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    session_id = get_session_id(request)
    user = get_current_user(request)
    response = render_template(request, "login.html", {
        "cart_count": get_cart_count(session_id),
        "user": user,
        "error": None
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.post("/login")
async def login_user(
    request: Request,
    email: str = Form(...),
    password: str = Form(...)
):
    session_id = get_session_id(request)
    user = db_users.get(email)
    if not user or user["password"] != password:
        return render_template(request, "login.html", {
            "cart_count": get_cart_count(session_id),
            "user": None,
            "error": "Invalid email or password."
        })

    response = RedirectResponse(url="/account", status_code=303)
    response.set_cookie(key="devstore_session", value=session_id)
    response.set_cookie(key="devstore_user", value=email)
    return response

@app.get("/logout")
async def logout(request: Request):
    response = RedirectResponse(url="/", status_code=303)
    response.delete_cookie(key="devstore_user")
    return response

# SEEDED BUG BUG-05: Broken Access Control on /account
@app.get("/account", response_class=HTMLResponse)
async def customer_account(request: Request):
    session_id = get_session_id(request)
    user = get_current_user(request)
    
    # If defect BUG-05 is fixed: enforce authentication redirect
    if not SEEDED_DEFECTS_STATE.get("BUG-05", True):
        if not user:
            return RedirectResponse(url="/login?redirect=/account", status_code=303)

    response = render_template(request, "account.html", {
        "cart_count": get_cart_count(session_id),
        "user": user,
        "orders": [
            {"id": "ORD-1092", "date": "2026-03-12", "total": "$219.98", "status": "Delivered"},
            {"id": "ORD-1088", "date": "2026-03-01", "total": "$49.99", "status": "Delivered"}
        ]
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

# ----------------- QuickBite & AssessPro Helpers -----------------

def get_qb_cart_for_session(session_id: str) -> List[Dict[str, Any]]:
    if session_id not in db_qb_carts:
        db_qb_carts[session_id] = []
    return db_qb_carts[session_id]

def get_qb_cart_count(session_id: str) -> int:
    cart = get_qb_cart_for_session(session_id)
    return sum(item.get("quantity", 1) for item in cart)

# ----------------- AssessPro Assessment Platform Endpoints -----------------

@app.get("/assesspro", response_class=HTMLResponse)
@app.get("/assesspro/invitations", response_class=HTMLResponse)
@app.get("/assessment", response_class=HTMLResponse)
async def assesspro_home(request: Request):
    """Candidate assignment landing portal."""
    session_id = get_session_id(request)
    user = get_current_user(request)
    response = render_template(request, "assesspro_home.html", {
        "cart_count": get_cart_count(session_id),
        "qb_cart_count": get_qb_cart_count(session_id),
        "user": user,
        "candidate_name": "Jordan Reed",
        "candidate_email": "jordan.reed@example.com"
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.post("/assesspro/start", response_class=HTMLResponse)
@app.post("/assessment/start", response_class=HTMLResponse)
async def assesspro_start(
    request: Request,
    candidate_name: str = Form(...),
    candidate_email: str = Form(...),
    access_code: str = Form(...)
):
    """
    Candidate access code validation.
    SEEDED DEFECT AP-BUG-05 / ASSESS-05: Missing validation accepts 1-character malformed code.
    """
    session_id = get_session_id(request)
    code_clean = access_code.strip()

    # If AP-BUG-05 / ASSESS-05 is enabled: defective length-only validation accepts malformed 1-char codes
    if SEEDED_DEFECTS_STATE.get("AP-BUG-05", True) or SEEDED_DEFECTS_STATE.get("ASSESS-05", True):
        is_valid = len(code_clean) >= 1
    else:
        # Proper validation requires formatted 6-char invitation code
        is_valid = len(code_clean) >= 6 and "-" in code_clean

    if not is_valid:
        return render_template(request, "assesspro_home.html", {
            "error": "Invalid assessment access code. Format requires 6-character invitation key (e.g. AIM-2026).",
            "candidate_name": candidate_name,
            "candidate_email": candidate_email,
            "cart_count": get_cart_count(session_id),
            "qb_cart_count": get_qb_cart_count(session_id)
        })

    # Initialize candidate session
    db_candidate_sessions[session_id] = {
        "name": candidate_name,
        "email": candidate_email,
        "code": code_clean,
        "answers": {"q1": "B", "q2": "A", "q3": "A"} # seeded defaults
    }

    target_url = "/assesspro/assessment/test" if request.url.path.startswith("/assesspro") else "/assessment/test"
    response = RedirectResponse(url=target_url, status_code=303)
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/assesspro/assessment/test", response_class=HTMLResponse)
@app.get("/assessment/test", response_class=HTMLResponse)
async def assesspro_test(request: Request):
    """
    Candidate examination view.
    SEEDED DEFECT AP-BUG-01 / ASSESS-01: Page reload wipes answered radio selections from state.
    """
    session_id = get_session_id(request)
    candidate = db_candidate_sessions.get(session_id, {
        "name": "Jordan Reed",
        "email": "jordan.reed@example.com",
        "answers": {"q1": "B", "q2": "A", "q3": "A"}
    })

    # If refresh simulated:
    is_refresh = request.query_params.get("refresh") == "1"
    if is_refresh and (SEEDED_DEFECTS_STATE.get("AP-BUG-01", True) or SEEDED_DEFECTS_STATE.get("ASSESS-01", True)):
        # Defective behavior: Session answer state lost on refresh
        candidate["answers"] = {}
        db_candidate_sessions[session_id] = candidate

    response = render_template(request, "assesspro_exam.html", {
        "candidate": candidate,
        "answers": candidate.get("answers", {}),
        "cart_count": get_cart_count(session_id),
        "qb_cart_count": get_qb_cart_count(session_id),
        "user": get_current_user(request)
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.post("/assesspro/submit", response_class=HTMLResponse)
@app.post("/assessment/submit", response_class=HTMLResponse)
async def assesspro_submit(
    request: Request,
    candidate_name: str = Form(...),
    candidate_email: str = Form(...),
    q1: Optional[str] = Form(None),
    q2: Optional[str] = Form(None),
    q3: Optional[str] = Form(None),
    q4: Optional[str] = Form(None)
):
    """
    Assessment submission and scoring.
    SEEDED DEFECT AP-BUG-04 / ASSESS-02: Non-idempotent submission creates duplicate results on double submit.
    SEEDED DEFECT AP-BUG-03 / ASSESS-03: Score calculation arithmetic bug displays 33% instead of 100%.
    """
    session_id = get_session_id(request)
    
    # 1. Answer Key Evaluation (Answer Key: q1=B, q2=A, q3=A)
    submitted = {"q1": q1, "q2": q2, "q3": q3}
    key = {"q1": "B", "q2": "A", "q3": "A"}
    correct = sum(1 for q, ans in submitted.items() if ans == key.get(q))
    total = len(key)

    # 2. Score Calculation Defect (AP-BUG-03 / ASSESS-03)
    if SEEDED_DEFECTS_STATE.get("AP-BUG-03", True) or SEEDED_DEFECTS_STATE.get("ASSESS-03", True):
        # Defective logic: reports 33% when all 3 answers are correct
        score_percent = "33%" if correct == 3 else f"{int(correct / total * 100)}%"
    else:
        score_percent = f"{int(correct / total * 100)}%"

    # 3. Idempotency Defect (AP-BUG-04 / ASSESS-02)
    recent_dup = [s for s in db_assessment_submissions if s["candidate_email"] == candidate_email]
    if not (SEEDED_DEFECTS_STATE.get("AP-BUG-04", True) or SEEDED_DEFECTS_STATE.get("ASSESS-02", True)):
        # Fixed behavior: idempotent submission does not duplicate
        if recent_dup:
            submission_id = recent_dup[-1]["submission_id"]
            return render_template(request, "assesspro_result.html", {
                "submission_id": submission_id,
                "candidate_name": candidate_name,
                "candidate_email": candidate_email,
                "score_percent": recent_dup[-1]["score_percent"],
                "correct_count": correct,
                "total_questions": total,
                "cart_count": get_cart_count(session_id),
                "qb_cart_count": get_qb_cart_count(session_id)
            })

    submission_id = f"SUB-{uuid.uuid4().hex[:6].upper()}"
    new_sub = {
        "submission_id": submission_id,
        "candidate_name": candidate_name,
        "candidate_email": candidate_email,
        "score_percent": score_percent,
        "submitted_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    }
    db_assessment_submissions.append(new_sub)

    response = render_template(request, "assesspro_result.html", {
        "submission_id": submission_id,
        "candidate_name": candidate_name,
        "candidate_email": candidate_email,
        "score_percent": score_percent,
        "correct_count": correct,
        "total_questions": total,
        "cart_count": get_cart_count(session_id),
        "qb_cart_count": get_qb_cart_count(session_id)
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/assesspro/recruiter", response_class=HTMLResponse)
@app.get("/assessment/recruiter/results", response_class=HTMLResponse)
async def assesspro_recruiter(request: Request):
    """
    Recruiter candidate evaluation view.
    SEEDED DEFECT AP-BUG-05 / ASSESS-04: Broken Access Control leaks candidate results to anonymous visitors.
    """
    session_id = get_session_id(request)
    user = get_current_user(request)

    # If defect AP-BUG-05 / ASSESS-04 is fixed: enforce recruiter login
    if not (SEEDED_DEFECTS_STATE.get("AP-BUG-05", True) or SEEDED_DEFECTS_STATE.get("ASSESS-04", True)):
        if not user or user.get("email") != "recruiter@apexqa.io":
            return RedirectResponse(url="/login?redirect=/assesspro/recruiter", status_code=303)

    response = render_template(request, "assesspro_recruiter.html", {
        "submissions": db_assessment_submissions,
        "cart_count": get_cart_count(session_id),
        "qb_cart_count": get_qb_cart_count(session_id),
        "user": user
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

# ----------------- QuickBite Food Delivery Endpoints -----------------

@app.get("/quickbite", response_class=HTMLResponse)
async def quickbite_home(request: Request):
    """QuickBite Food Delivery Homepage."""
    session_id = get_session_id(request)
    response = render_template(request, "quickbite_home.html", {
        "restaurants": db_qb_restaurants,
        "cart_count": get_cart_count(session_id),
        "qb_cart_count": get_qb_cart_count(session_id),
        "user": get_current_user(request)
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/quickbite/search", response_class=HTMLResponse)
async def quickbite_search(request: Request, q: Optional[str] = None, category: Optional[str] = None):
    """Food and Kitchen Search Results."""
    session_id = get_session_id(request)
    query = (q or category or "").strip().lower()
    
    if query:
        results = [
            r for r in db_qb_restaurants
            if query in r["name"].lower() or query in r["cuisine"].lower()
        ]
        # Also check menu items for matching dishes
        matching_rest_ids = {
            item["restaurant_id"] for item in db_qb_menu_items
            if query in item["name"].lower() or query in item.get("category", "").lower()
        }
        for r in db_qb_restaurants:
            if r["id"] in matching_rest_ids and r not in results:
                results.append(r)
    else:
        results = list(db_qb_restaurants)

    response = render_template(request, "quickbite_search.html", {
        "results": results,
        "query": q or category or "",
        "cart_count": get_cart_count(session_id),
        "qb_cart_count": get_qb_cart_count(session_id),
        "user": get_current_user(request)
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/quickbite/restaurant/{restaurant_id}", response_class=HTMLResponse)
async def quickbite_restaurant_detail(restaurant_id: str, request: Request):
    """Restaurant menu and cart view."""
    session_id = get_session_id(request)
    rest = next((r for r in db_qb_restaurants if r["id"] == restaurant_id), None)
    if not rest:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    menu_items = [i for i in db_qb_menu_items if i["restaurant_id"] == restaurant_id]
    categories = sorted(list({i["category"] for i in menu_items}))
    cart = get_qb_cart_for_session(session_id)
    subtotal = sum(i["price"] * i["quantity"] for i in cart)

    response = render_template(request, "quickbite_restaurant.html", {
        "restaurant": rest,
        "menu_items": menu_items,
        "categories": categories,
        "cart_items": cart,
        "subtotal": subtotal,
        "cart_count": get_cart_count(session_id),
        "qb_cart_count": get_qb_cart_count(session_id),
        "user": get_current_user(request)
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.post("/quickbite/cart/add")
async def quickbite_add_to_cart(
    request: Request,
    restaurant_id: str = Form(...),
    item_id: str = Form(...),
    item_name: str = Form(...),
    price: float = Form(...),
    quantity: int = Form(1)
):
    """Adds a dish to session cart."""
    session_id = get_session_id(request)
    cart = get_qb_cart_for_session(session_id)

    existing = next((i for i in cart if i["id"] == item_id), None)
    if existing:
        existing["quantity"] += quantity
        existing["row_total"] = existing["price"] * existing["quantity"]
    else:
        cart.append({
            "id": item_id,
            "restaurant_id": restaurant_id,
            "name": item_name,
            "price": float(price),
            "quantity": int(quantity),
            "row_total": float(price) * int(quantity)
        })

    db_qb_carts[session_id] = cart
    # Invalidate any frozen subtotal override on new add
    db_qb_frozen_subtotals.pop(session_id, None)

    response = RedirectResponse(url=f"/quickbite/restaurant/{restaurant_id}", status_code=303)
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/quickbite/cart", response_class=HTMLResponse)
async def quickbite_cart_view(request: Request):
    """
    Shopping Cart View.
    SEEDED DEFECT QB-BUG-01: When quantity updates, subtotal fails to recompute if defect active.
    """
    session_id = get_session_id(request)
    cart = get_qb_cart_for_session(session_id)

    # Subtotal calculation
    if SEEDED_DEFECTS_STATE.get("QB-BUG-01", True) and session_id in db_qb_frozen_subtotals:
        subtotal = db_qb_frozen_subtotals[session_id]
    else:
        subtotal = sum(i["price"] * i["quantity"] for i in cart)

    delivery_fee = 2.99 if subtotal > 0 else 0.00
    tax = round(subtotal * 0.0825, 2)
    total = round(subtotal + delivery_fee + tax, 2)

    response = render_template(request, "quickbite_cart.html", {
        "cart_items": cart,
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "tax": tax,
        "total": total,
        "cart_count": get_cart_count(session_id),
        "qb_cart_count": get_qb_cart_count(session_id),
        "user": get_current_user(request)
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.post("/quickbite/cart/update")
async def quickbite_cart_update(
    request: Request,
    item_id: str = Form(...),
    quantity: int = Form(...)
):
    """
    Updates cart quantity.
    SEEDED DEFECT QB-BUG-01: Quantity input updates, but subtotal calculation remains frozen at 1-item price.
    """
    session_id = get_session_id(request)
    cart = get_qb_cart_for_session(session_id)

    item = next((i for i in cart if i["id"] == item_id), None)
    if item:
        unit_price = item["price"]
        item["quantity"] = max(1, int(quantity))
        item["row_total"] = unit_price * item["quantity"]

        # If QB-BUG-01 active: freeze subtotal at 1-item price
        if SEEDED_DEFECTS_STATE.get("QB-BUG-01", True):
            db_qb_frozen_subtotals[session_id] = unit_price
        else:
            db_qb_frozen_subtotals.pop(session_id, None)

    response = RedirectResponse(url="/quickbite/cart", status_code=303)
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/quickbite/checkout/address", response_class=HTMLResponse)
async def quickbite_checkout_address(request: Request):
    """
    Checkout address step.
    SEEDED DEFECT QB-BUG-05: Cart is wiped if page reload occurs during checkout.
    """
    session_id = get_session_id(request)
    
    # State loss defect on simulated reload
    if request.query_params.get("refresh") == "1" and SEEDED_DEFECTS_STATE.get("QB-BUG-05", True):
        db_qb_carts[session_id] = []

    cart = get_qb_cart_for_session(session_id)
    address = db_qb_addresses.get(session_id, {
        "full_name": "Alex Morgan",
        "phone": "+1 (555) 234-8901",
        "street_address": "452 Innovation Blvd, Suite 300",
        "city": "San Francisco",
        "state": "CA",
        "postal_code": "94107"
    })

    response = render_template(request, "quickbite_checkout_address.html", {
        "address": address,
        "cart_items": cart,
        "cart_count": get_cart_count(session_id),
        "qb_cart_count": get_qb_cart_count(session_id),
        "user": get_current_user(request)
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.post("/quickbite/checkout/address", response_class=HTMLResponse)
async def quickbite_save_address(
    request: Request,
    full_name: str = Form(...),
    phone: Optional[str] = Form(""),
    street_address: str = Form(...),
    city: str = Form(...),
    state: str = Form(...),
    postal_code: Optional[str] = Form("")
):
    """
    Validates and saves delivery address.
    SEEDED DEFECT QB-BUG-02: Missing validation on Postal Code accepts blank entries without error.
    """
    session_id = get_session_id(request)
    p_code = (postal_code or "").strip()

    # If QB-BUG-02 is enabled: skips postal code validation
    if SEEDED_DEFECTS_STATE.get("QB-BUG-02", True):
        is_valid = True
    else:
        is_valid = len(p_code) >= 5

    if not is_valid:
        return render_template(request, "quickbite_checkout_address.html", {
            "error": "Postal / ZIP Code is required for delivery logistics.",
            "address": {
                "full_name": full_name,
                "phone": phone,
                "street_address": street_address,
                "city": city,
                "state": state,
                "postal_code": postal_code
            },
            "cart_count": get_cart_count(session_id),
            "qb_cart_count": get_qb_cart_count(session_id)
        })

    db_qb_addresses[session_id] = {
        "full_name": full_name,
        "phone": phone,
        "street_address": street_address,
        "city": city,
        "state": state,
        "postal_code": p_code
    }

    response = RedirectResponse(url="/quickbite/checkout/payment", status_code=303)
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/quickbite/checkout/payment", response_class=HTMLResponse)
async def quickbite_checkout_payment(request: Request):
    """Payment simulation checkout step."""
    session_id = get_session_id(request)
    cart = get_qb_cart_for_session(session_id)
    address = db_qb_addresses.get(session_id, {
        "street_address": "452 Innovation Blvd, Suite 300",
        "city": "San Francisco",
        "state": "CA",
        "postal_code": "94107"
    })

    subtotal = sum(i["price"] * i["quantity"] for i in cart)
    delivery_fee = 2.99 if subtotal > 0 else 0.00
    tax = round(subtotal * 0.0825, 2)
    total = round(subtotal + delivery_fee + tax, 2)

    response = render_template(request, "quickbite_checkout_payment.html", {
        "address": address,
        "cart_items": cart,
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "tax": tax,
        "total": total,
        "cart_count": get_cart_count(session_id),
        "qb_cart_count": get_qb_cart_count(session_id),
        "user": get_current_user(request)
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.post("/quickbite/checkout/place-order")
async def quickbite_place_order(
    request: Request,
    payment_method: str = Form("credit_card"),
    sim_outcome: str = Form("success")
):
    """
    Submits order to local payment simulator.
    SEEDED DEFECT QB-BUG-03: Non-idempotent duplicate submission on rapid click.
    SEEDED DEFECT QB-BUG-04: Declined payment simulated as confirmed order.
    """
    session_id = get_session_id(request)
    cart = get_qb_cart_for_session(session_id)
    address = db_qb_addresses.get(session_id, {
        "street_address": "452 Innovation Blvd, Suite 300",
        "city": "San Francisco",
        "state": "CA",
        "postal_code": "94107"
    })

    subtotal = sum(i["price"] * i["quantity"] for i in cart)
    delivery_fee = 2.99 if subtotal > 0 else 0.00
    tax = round(subtotal * 0.0825, 2)
    total = round(subtotal + delivery_fee + tax, 2)

    # 1. Defect QB-BUG-04: Declined Payment falsely confirmed
    is_declined = (sim_outcome == "declined")
    if is_declined:
        if SEEDED_DEFECTS_STATE.get("QB-BUG-04", True):
            # Defective behavior: confirms order despite declined payment
            order_status = "Confirmed"
            payment_status = "declined_falsely_confirmed"
        else:
            order_status = "Declined"
            payment_status = "failed"
    else:
        order_status = "Confirmed"
        payment_status = "paid"

    # 2. Defect QB-BUG-03: Idempotency check
    if not SEEDED_DEFECTS_STATE.get("QB-BUG-03", True):
        # Idempotent: return recent order if submitted within last 5 seconds
        recent = [o for o in db_qb_orders if o.get("session_id") == session_id]
        if recent:
            return RedirectResponse(url=f"/quickbite/order/{recent[-1]['id']}/confirmation", status_code=303)

    order_id = f"QB-ORD-{uuid.uuid4().hex[:6].upper()}"
    new_order = {
        "id": order_id,
        "session_id": session_id,
        "restaurant_name": "Burger Haven",
        "items": list(cart) if cart else [{"name": "Truffle Bacon Cheeseburger", "price": 14.99, "quantity": 1}],
        "subtotal": subtotal or 14.99,
        "delivery_fee": delivery_fee,
        "tax": tax,
        "total": total or 18.23,
        "status": order_status,
        "payment_status": payment_status,
        "payment_method": payment_method,
        "address": address,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    }
    db_qb_orders.append(new_order)
    # Clear cart on successful order creation
    db_qb_carts[session_id] = []
    db_qb_frozen_subtotals.pop(session_id, None)

    response = RedirectResponse(url=f"/quickbite/order/{order_id}/confirmation", status_code=303)
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/quickbite/order/{order_id}/confirmation", response_class=HTMLResponse)
async def quickbite_order_confirmation(order_id: str, request: Request):
    """Order confirmation and tracking."""
    session_id = get_session_id(request)
    order = next((o for o in db_qb_orders if o["id"] == order_id), None)
    if not order:
        order = {
            "id": order_id,
            "status": "Confirmed",
            "payment_status": "paid",
            "total": 18.23,
            "items": [{"name": "Truffle Bacon Cheeseburger", "price": 14.99, "quantity": 1}],
            "address": {"street_address": "452 Innovation Blvd", "city": "San Francisco", "postal_code": "94107"}
        }

    response = render_template(request, "quickbite_confirmation.html", {
        "order": order,
        "cart_count": get_cart_count(session_id),
        "qb_cart_count": get_qb_cart_count(session_id),
        "user": get_current_user(request)
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/quickbite/orders", response_class=HTMLResponse)
async def quickbite_orders_list(request: Request):
    """QuickBite Order history."""
    session_id = get_session_id(request)
    response = render_template(request, "quickbite_orders.html", {
        "orders": list(reversed(db_qb_orders)),
        "cart_count": get_cart_count(session_id),
        "qb_cart_count": get_qb_cart_count(session_id),
        "user": get_current_user(request)
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

@app.get("/quickbite/account", response_class=HTMLResponse)
async def quickbite_account(request: Request):
    """QuickBite Account profile."""
    session_id = get_session_id(request)
    response = render_template(request, "quickbite_account.html", {
        "user": {"name": "Alex Eats", "email": "alex.eats@quickbite.io"},
        "cart_count": get_cart_count(session_id),
        "qb_cart_count": get_qb_cart_count(session_id)
    })
    response.set_cookie(key="devstore_session", value=session_id)
    return response

# ----------------- Control & Reset Endpoints -----------------

@app.get("/api/defects")
async def get_defects_status():
    """Returns the state of all 15 seeded defects (True = defective, False = fixed)."""
    return {
        "status": "success",
        "defects": SEEDED_DEFECTS_STATE,
        "devstore_defects": {k: v for k, v in SEEDED_DEFECTS_STATE.items() if k.startswith("BUG-")},
        "assesspro_defects": {k: v for k, v in SEEDED_DEFECTS_STATE.items() if k.startswith("AP-") or k.startswith("ASSESS-")},
        "quickbite_defects": {k: v for k, v in SEEDED_DEFECTS_STATE.items() if k.startswith("QB-")},
        "all_defects_enabled": all(SEEDED_DEFECTS_STATE.values())
    }

@app.post("/api/defects/toggle")
async def toggle_defects(request: Request):
    """
    Toggles all defects or a specific defect.
    Body JSON or Form: {"enabled": false} or {"defect_id": "BUG-01", "enabled": false}
    """
    try:
        data = await request.json()
    except Exception:
        try:
            form = await request.form()
            data = dict(form)
        except Exception:
            data = {}

    if "defect_id" in data:
        d_id = str(data["defect_id"]).upper()
        if d_id in SEEDED_DEFECTS_STATE:
            new_val = bool(data.get("enabled", not SEEDED_DEFECTS_STATE[d_id]))
            SEEDED_DEFECTS_STATE[d_id] = new_val
            # Sync aliases
            if d_id.startswith("AP-BUG-"):
                alias = d_id.replace("AP-BUG-0", "ASSESS-0")
                if alias in SEEDED_DEFECTS_STATE:
                    SEEDED_DEFECTS_STATE[alias] = new_val
            elif d_id.startswith("ASSESS-"):
                alias = d_id.replace("ASSESS-0", "AP-BUG-0")
                if alias in SEEDED_DEFECTS_STATE:
                    SEEDED_DEFECTS_STATE[alias] = new_val
    elif "enabled" in data:
        val = str(data["enabled"]).lower() in ("true", "1", "yes")
        for k in SEEDED_DEFECTS_STATE:
            SEEDED_DEFECTS_STATE[k] = val
    else:
        current = all(SEEDED_DEFECTS_STATE.values())
        for k in SEEDED_DEFECTS_STATE:
            SEEDED_DEFECTS_STATE[k] = not current

    return {
        "status": "success",
        "defects": SEEDED_DEFECTS_STATE,
        "all_defects_enabled": all(SEEDED_DEFECTS_STATE.values())
    }

@app.post("/api/reset")
async def reset_demo_state():
    """Resets all target states (DevStore, AssessPro, QuickBite) back to synthetic defaults."""
    global db_products, db_users, db_carts, db_orders
    global db_assessment_submissions, db_candidate_sessions
    global db_qb_restaurants, db_qb_menu_items, db_qb_carts, db_qb_addresses, db_qb_orders, db_qb_frozen_subtotals

    # DevStore
    db_products = [dict(p) for p in INITIAL_PRODUCTS]
    db_users = {k: dict(v) for k, v in INITIAL_USERS.items()}
    db_carts = {}
    db_orders = []

    # AssessPro
    db_assessment_submissions = list(INITIAL_ASSESSMENT_SUBMISSIONS)
    db_candidate_sessions = {}

    # QuickBite
    db_qb_restaurants = [dict(r) for r in INITIAL_QB_RESTAURANTS]
    db_qb_menu_items = [dict(i) for i in INITIAL_QB_MENU_ITEMS]
    db_qb_carts = {}
    db_qb_addresses = {}
    db_qb_orders = []
    db_qb_frozen_subtotals = {}

    # Reset all defect flags to enabled
    for k in SEEDED_DEFECTS_STATE:
        SEEDED_DEFECTS_STATE[k] = True

    return {
        "status": "success",
        "message": "All sample targets (DevStore, AssessPro, QuickBite) reset to clean synthetic defaults.",
        "targets_reset": ["DevStore", "AssessPro", "QuickBite"]
    }

@app.post("/api/reset/devstore")
async def reset_devstore():
    global db_products, db_users, db_carts, db_orders
    db_products = [dict(p) for p in INITIAL_PRODUCTS]
    db_users = {k: dict(v) for k, v in INITIAL_USERS.items()}
    db_carts = {}
    db_orders = []
    for k in ("BUG-01", "BUG-02", "BUG-03", "BUG-04", "BUG-05"):
        SEEDED_DEFECTS_STATE[k] = True
    return {"status": "success", "message": "DevStore target reset successfully."}

@app.post("/api/reset/assesspro")
async def reset_assesspro():
    global db_assessment_submissions, db_candidate_sessions
    db_assessment_submissions = list(INITIAL_ASSESSMENT_SUBMISSIONS)
    db_candidate_sessions = {}
    for k in ("AP-BUG-01", "AP-BUG-02", "AP-BUG-03", "AP-BUG-04", "AP-BUG-05", "ASSESS-01", "ASSESS-02", "ASSESS-03", "ASSESS-04", "ASSESS-05"):
        SEEDED_DEFECTS_STATE[k] = True
    return {"status": "success", "message": "AssessPro target reset successfully."}

@app.post("/api/reset/quickbite")
async def reset_quickbite():
    global db_qb_restaurants, db_qb_menu_items, db_qb_carts, db_qb_addresses, db_qb_orders, db_qb_frozen_subtotals
    db_qb_restaurants = [dict(r) for r in INITIAL_QB_RESTAURANTS]
    db_qb_menu_items = [dict(i) for i in INITIAL_QB_MENU_ITEMS]
    db_qb_carts = {}
    db_qb_addresses = {}
    db_qb_orders = []
    db_qb_frozen_subtotals = {}
    for k in ("QB-BUG-01", "QB-BUG-02", "QB-BUG-03", "QB-BUG-04", "QB-BUG-05"):
        SEEDED_DEFECTS_STATE[k] = True
    return {"status": "success", "message": "QuickBite target reset successfully."}

@app.get("/api/state")
async def get_demo_state():
    """Returns state metrics for test oracles and assertions across all demo targets."""
    return {
        "devstore": {
            "products_count": len(db_products),
            "users_count": len(db_users),
            "orders_count": len(db_orders),
            "carts_active": len(db_carts)
        },
        "assesspro": {
            "submissions_count": len(db_assessment_submissions),
            "sessions_active": len(db_candidate_sessions)
        },
        "quickbite": {
            "restaurants_count": len(db_qb_restaurants),
            "menu_items_count": len(db_qb_menu_items),
            "orders_count": len(db_qb_orders),
            "carts_active": len(db_qb_carts)
        },
        "defects": SEEDED_DEFECTS_STATE
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=5001, reload=True)
