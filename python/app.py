"""bakedbyPrii — Python/Flask app with a SERVER-RENDERED (Jinja) frontend.

Unlike the Node app (whose frontend is JavaScript talking to a JSON API), here
Python builds the HTML: routes render Jinja templates in templates/, the shopping
cart lives in the Flask session, and every interaction is a plain HTML form POST.
There is essentially no JavaScript.

Flow:  /  ->  /menu (add to cart)  ->  /checkout (details)  ->  confirmation
Admin:  /admin (session login) lists orders and changes their status.
Customer self-service:  /cancel?ref=..&token=..

The data layer (db.py) and email layer (mailer.py) are reused unchanged. A small
JSON API is also kept at /api/* for reference; the Jinja pages are the frontend.

Node/Express → Python/Flask notes specific to this file:
    res.render('view', data)   ->  return render_template("view.html", **data)
    res.redirect('/x')         ->  return redirect(url_for("x"))
    req.session                ->  Flask `session` (a signed cookie)
    req.body.field (form)      ->  request.form.get("field")
"""

import math
import os
import random
import re
import sqlite3
import string
import sys
from datetime import datetime, timezone, date as date_cls
from functools import wraps

from flask import (Flask, jsonify, redirect, render_template, request,
                   session, url_for, abort)

import db
import mailer

# Force UTF-8 + line-buffered stdout so the emoji banner / live logs work on
# Windows even when output is redirected (Node's console handles this natively).
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:  # noqa: BLE001
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# ---- Tiny .env loader (mirrors Node's --env-file-if-exists) ---------------
def load_env(path):
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env(os.path.join(BASE_DIR, ".env"))

# ---- Config ---------------------------------------------------------------
PORT = int(os.environ.get("PORT") or 5000)
ADMIN_KEY = os.environ.get("ADMIN_KEY") or "bakedbyprii-admin"   # CHANGE THIS before going live
DELIVERY_FEE = float(os.environ.get("DELIVERY_FEE") or 2.5)
FREE_DELIVERY_OVER = float(os.environ.get("FREE_DELIVERY_OVER") or 20)
DELIVERY_POSTCODE = re.compile(r"^OX11", re.IGNORECASE)          # Didcot
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
STATUSES = ["new", "confirmed", "completed", "cancelled"]
VALID_PAYMENTS = ["cash", "bank", "card", "paypal"]

PAYMENT_OPTIONS = [
    {"value": "cash",   "title": "Pay in person — cash", "desc": "Pay when you collect or on delivery. Nothing to pay now."},
    {"value": "bank",   "title": "Bank transfer",        "desc": "We'll give you our bank details and a reference to confirm your order."},
    {"value": "card",   "title": "Pay by card (secure link)", "desc": "We'll send a secure card-payment link — your card details never touch this site."},
    {"value": "paypal", "title": "PayPal",               "desc": "Pay via our PayPal link once your order is confirmed."},
]

app = Flask(__name__)  # templates/ and static/ are Flask's defaults
# Sessions (the cart + admin login) are signed with this key. Set SECRET_KEY in
# production; the dev default is fine locally.
app.secret_key = os.environ.get("SECRET_KEY") or "dev-secret-change-me"
db.init_db()


# ---- Cart helpers (the cart is a dict {item_id: qty} in the session) ------
def get_cart():
    return dict(session.get("cart", {}))


def save_cart(cart):
    session["cart"] = cart
    session.modified = True


def cart_lines(cart):
    """Turn the raw {id: qty} cart into display rows priced from the DB menu.
    Returns (lines, subtotal). Prices always come from the database, never the
    client — the same rule the whole app follows."""
    lines, subtotal = [], 0.0
    for item in db.get_menu():                 # DB order = menu order
        qty = cart.get(item["id"])
        if not qty:
            continue
        line_total = item["price"] * qty
        subtotal += line_total
        lines.append({"id": item["id"], "name": item["name"], "price": item["price"],
                      "qty": qty, "line_total": line_total})
    return lines, round2(subtotal)


@app.context_processor
def inject_globals():
    """Make cart_count available to every template (used in the nav)."""
    return {"cart_count": sum(get_cart().values())}


# ---- Menu grouping (for the menu page + home category cards) --------------
def grouped_menu():
    """Group active menu items by category, preserving the menu's order."""
    groups, index = [], {}
    for item in db.get_menu():
        cat = item["category"]
        if cat not in index:
            index[cat] = {"category": cat, "items": []}
            groups.append(index[cat])
        index[cat]["items"].append(item)
    return groups


def category_summaries():
    """[{name, min_price}] per category — drives the home page cards."""
    out, seen = [], {}
    for item in db.get_menu():
        cat = item["category"]
        if cat not in seen:
            seen[cat] = {"name": cat, "min_price": item["price"]}
            out.append(seen[cat])
        seen[cat]["min_price"] = min(seen[cat]["min_price"], item["price"])
    return out


# ---- Shared order pricing + persistence -----------------------------------
def build_priced_order(*, name, email, phone, notes, fulfilment, date, payment,
                       address_line, postcode, items_raw, base):
    """Validate + price + persist an order, then fire the emails.

    `items_raw` is an iterable of (item_id, qty). Returns (order, None) on
    success or (None, error_message). Used by BOTH the Jinja checkout and the
    JSON API, so the rules live in exactly one place.
    """
    name = str(name or "").strip()
    email = str(email or "").strip()
    phone = str(phone or "").strip()
    notes = str(notes or "").strip()[:1000]
    fulfilment = "delivery" if fulfilment == "delivery" else "collection"
    date = str(date or "").strip()
    payment = str(payment or "").strip()

    # --- Validate customer ---
    if not name or not email or not phone or not date:
        return None, "Please fill in your name, email, phone and required date."
    if not EMAIL_RE.match(email):
        return None, "Please enter a valid email address."
    if payment not in VALID_PAYMENTS:
        return None, "Please choose a payment method."

    # --- Validate + price items against the DB menu ---
    items_raw = list(items_raw)
    if not items_raw:
        return None, "Please add at least one item to your order."
    items = []
    subtotal = 0.0
    for raw_id, raw_qty in items_raw:
        menu_item = db.get_menu_item(str(raw_id or ""))
        if not menu_item:
            return None, "Sorry, one of the items is no longer available."
        qty = _to_int(raw_qty)
        if qty is None or qty < 1 or qty > 50:
            return None, "Please choose a valid quantity (1–50) for each item."
        items.append({"item_id": menu_item["id"], "name": menu_item["name"],
                      "price": menu_item["price"], "qty": qty})
        subtotal += menu_item["price"] * qty
    subtotal = round2(subtotal)

    # --- Fulfilment + delivery rules ---
    address, postcode_val, delivery_fee = None, None, 0
    if fulfilment == "delivery":
        address = str(address_line or "").strip()
        postcode_val = str(postcode or "").strip()
        if not address or not postcode_val:
            return None, "Please enter your Didcot delivery address and postcode."
        if not DELIVERY_POSTCODE.match(postcode_val.replace(" ", "")):
            return None, ("Sorry, we only deliver within Didcot (OX11). "
                          "You're welcome to collect from home instead.")
        delivery_fee = 0 if subtotal >= FREE_DELIVERY_OVER else DELIVERY_FEE
    total = round2(subtotal + delivery_fee)

    order = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "name": name, "email": email, "phone": phone, "notes": notes,
        "fulfilment": fulfilment, "address": address, "postcode": postcode_val,
        "required_date": date, "payment": payment,
        "subtotal": subtotal, "delivery_fee": delivery_fee, "total": total,
    }

    # --- Persist (retry ref on the very unlikely collision) ---
    ref, cancel_token = None, None
    for attempt in range(6):
        ref = gen_ref()
        try:
            cancel_token = db.create_order({**order, "ref": ref}, items)
            break
        except sqlite3.IntegrityError:
            if attempt == 5:
                raise

    full = {**order, "ref": ref, "cancel_token": cancel_token, "items": items}
    mailer.fire(mailer.send_order_placed, full, base)
    mailer.fire(mailer.notify_new_order, full)
    print(f"[order] {ref} · {fulfilment} · £{total:.2f} · {payment} · {name}")
    return full, None


# ===========================================================================
#  SERVER-RENDERED PAGES (the Python frontend)
# ===========================================================================
@app.get("/")
def home():
    return render_template("index.html", active_page="home", categories=category_summaries())


@app.get("/menu")
def menu():
    cart = get_cart()
    lines, subtotal = cart_lines(cart)
    return render_template("menu.html", active_page="menu", groups=grouped_menu(),
                           cart=cart, cart_lines=lines, subtotal=subtotal)


@app.post("/cart/add")
def cart_add():
    item_id = request.form.get("id", "")
    if db.get_menu_item(item_id):                 # ignore unknown ids
        cart = get_cart()
        cart[item_id] = min(50, cart.get(item_id, 0) + 1)   # cap at the 50 max
        save_cart(cart)
    return redirect(url_for("menu") + "#" + _anchor_for(item_id))


@app.post("/cart/remove")
def cart_remove():
    item_id = request.form.get("id", "")
    cart = get_cart()
    if cart.get(item_id):
        cart[item_id] -= 1
        if cart[item_id] <= 0:
            del cart[item_id]
        save_cart(cart)
    return redirect(url_for("menu") + "#" + _anchor_for(item_id))


@app.post("/cart/clear")
def cart_clear():
    session.pop("cart", None)
    return redirect(url_for("menu"))


@app.route("/checkout", methods=["GET", "POST"])
def checkout():
    cart = get_cart()
    lines, subtotal = cart_lines(cart)
    if not lines:                                 # nothing to check out
        return redirect(url_for("menu"))

    if request.method == "POST":
        order, error = build_priced_order(
            name=request.form.get("name"), email=request.form.get("email"),
            phone=request.form.get("phone"), notes=request.form.get("notes"),
            fulfilment=request.form.get("fulfilment"), date=request.form.get("date"),
            payment=request.form.get("payment"),
            address_line=request.form.get("address"), postcode=request.form.get("postcode"),
            items_raw=[(i["id"], i["qty"]) for i in lines], base=base_url())
        if error:
            # Re-render with the typed values preserved and the error shown.
            return render_template("checkout.html", active_page="checkout", error=error,
                                   form=request.form, cart_lines=lines, subtotal=subtotal,
                                   payment_options=PAYMENT_OPTIONS)
        session.pop("cart", None)                 # order placed — empty the cart
        return render_template("confirmation.html", active_page=None, order=order)

    return render_template("checkout.html", active_page="checkout", error=None,
                           form={"date": date_cls.today().isoformat()},
                           cart_lines=lines, subtotal=subtotal, payment_options=PAYMENT_OPTIONS)


@app.route("/cancel", methods=["GET", "POST"])
def cancel():
    if request.method == "POST":
        ref = request.form.get("ref", "")
        token = request.form.get("token", "")
        order = find_order_by_token(ref, token)
        if not order:
            return render_template("cancel.html", active_page=None, order=None)
        if order["status"] == "new":
            db.set_order_status(ref, "cancelled")
            updated = db.get_order(ref)
            base = base_url()
            mailer.fire(mailer.send_status_email, updated, "cancelled", base)
            mailer.fire(mailer.notify_admin_cancelled, updated)
            print(f"[cancel] {ref} cancelled by customer")
            return render_template("cancel.html", active_page=None, token=token,
                                   order=public_order_view(db.get_order(ref)),
                                   message="Your order has been cancelled. A confirmation email is on its way.")
        # Not 'new' — show the read-only view (template explains it can't be cancelled).
        return render_template("cancel.html", active_page=None, token=token,
                               order=public_order_view(order))

    ref = request.args.get("ref", "")
    token = request.args.get("token", "")
    order = find_order_by_token(ref, token)
    if not order:
        return render_template("cancel.html", active_page=None, order=None), 404
    return render_template("cancel.html", active_page=None, token=token,
                           order=public_order_view(order))


@app.get("/legal/<doc>")
def legal(doc):
    data = LEGAL_DOCS.get(doc)
    if not data:
        abort(404)
    return render_template("legal.html", active_page=None, doc=data)


# ---- Admin (session-based login) ------------------------------------------
@app.get("/admin")
def admin():
    if not session.get("admin"):
        return render_template("admin_login.html", active_page="admin", error=None)
    orders = db.list_orders()
    stats = {
        "total": len(orders),
        "new": sum(1 for o in orders if o["status"] == "new"),
        "revenue": round2(sum(o["total"] for o in orders if o["status"] != "cancelled")),
    }
    current = request.args.get("status", "all")
    shown = orders if current == "all" else [o for o in orders if o["status"] == current]
    return render_template("admin.html", active_page="admin", orders=shown, stats=stats,
                           statuses=STATUSES, current_filter=current)


@app.post("/admin/login")
def admin_login():
    if request.form.get("key", "") == ADMIN_KEY:
        session["admin"] = True
        return redirect(url_for("admin"))
    return render_template("admin_login.html", active_page="admin",
                           error="Incorrect admin key."), 401


@app.post("/admin/logout")
def admin_logout():
    session.pop("admin", None)
    return redirect(url_for("admin"))


@app.post("/admin/orders/<ref>/status")
def admin_set_status(ref):
    if not session.get("admin"):
        return redirect(url_for("admin"))
    status = request.form.get("status", "")
    current_filter = request.form.get("status_filter", "all")
    existing = db.get_order(ref)
    if existing and status in STATUSES and existing["status"] != status:
        db.set_order_status(ref, status)
        updated = db.get_order(ref)
        mailer.fire(mailer.send_status_email, updated, status, base_url())
    return redirect(url_for("admin", status=current_filter))


# ===========================================================================
#  JSON API (kept for reference — the Jinja pages above are the real frontend)
# ===========================================================================
@app.get("/api/health")
def api_health():
    return jsonify(ok=True, time=datetime.now(timezone.utc).isoformat())


@app.get("/api/menu")
def api_menu():
    return jsonify(ok=True, menu=db.get_menu())


@app.post("/api/orders")
def api_create_order():
    try:
        b = request.get_json(silent=True) or {}
        c = b.get("customer") or {}
        addr = b.get("address") or {}
        items_raw = [(str((it or {}).get("id") or ""), (it or {}).get("qty"))
                     for it in (b.get("items") or [])]
        order, error = build_priced_order(
            name=c.get("name"), email=c.get("email"), phone=c.get("phone"), notes=c.get("notes"),
            fulfilment=b.get("fulfilment"), date=b.get("date"), payment=b.get("payment"),
            address_line=addr.get("line"), postcode=addr.get("postcode"),
            items_raw=items_raw, base=base_url())
        if error:
            return jsonify(ok=False, error=error), 400
        return jsonify(ok=True, ref=order["ref"], subtotal=order["subtotal"],
                       delivery_fee=order["delivery_fee"], total=order["total"],
                       payment=order["payment"], fulfilment=order["fulfilment"])
    except Exception as e:  # noqa: BLE001
        print(f"[order error] {e}")
        return jsonify(ok=False, error="Something went wrong on our side. Please try again or contact us."), 500


@app.get("/api/orders/<ref>")
def api_get_order(ref):
    order = find_order_by_token(ref, request.args.get("token", ""))
    if not order:
        return jsonify(ok=False, error="Order not found or link is invalid."), 404
    return jsonify(ok=True, order=public_order_view(order))


@app.post("/api/orders/<ref>/cancel")
def api_cancel_order(ref):
    token = request.args.get("token") or (request.get_json(silent=True) or {}).get("token") or ""
    order = find_order_by_token(ref, token)
    if not order:
        return jsonify(ok=False, error="Order not found or link is invalid."), 404
    if order["status"] != "new":
        return jsonify(ok=False, error="This order can no longer be cancelled online. "
                       "Please contact us and we'll help."), 400
    db.set_order_status(ref, "cancelled")
    updated = db.get_order(ref)
    base = base_url()
    mailer.fire(mailer.send_status_email, updated, "cancelled", base)
    mailer.fire(mailer.notify_admin_cancelled, updated)
    return jsonify(ok=True)


def require_admin(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if (request.headers.get("x-admin-key") or "") != ADMIN_KEY:
            return jsonify(ok=False, error="Unauthorised"), 401
        return f(*args, **kwargs)
    return wrapper


@app.get("/api/admin/orders")
@require_admin
def api_admin_orders():
    orders = db.list_orders()
    stats = {"total": len(orders), "new": sum(1 for o in orders if o["status"] == "new"),
             "revenue": round2(sum(o["total"] for o in orders if o["status"] != "cancelled"))}
    return jsonify(ok=True, orders=orders, stats=stats)


# ---- Shared helpers -------------------------------------------------------
def find_order_by_token(ref, token):
    """Load an order only if the per-order secret token matches. The token is
    only ever shared in that order's email — it gates the customer view/cancel."""
    order = db.get_order(ref)
    if not order or not order.get("cancel_token") or not token or order["cancel_token"] != str(token):
        return None
    return order


def public_order_view(o):
    """Safe, read-only projection for the cancel page — no email, phone or token."""
    return {
        "ref": o["ref"], "name": str(o.get("name") or "").split(" ")[0], "status": o["status"],
        "fulfilment": o["fulfilment"], "address": o["address"], "postcode": o["postcode"],
        "required_date": o["required_date"], "payment": o["payment"],
        "subtotal": o["subtotal"], "delivery_fee": o["delivery_fee"], "total": o["total"],
        "items": o["items"], "created_at": o["created_at"], "cancellable": o["status"] == "new",
    }


def base_url():
    public = os.environ.get("PUBLIC_URL")
    if public:
        return public.rstrip("/")
    proto = request.headers.get("X-Forwarded-Proto") or request.scheme
    return f"{proto}://{request.host}"


def round2(n):
    return math.floor(n * 100 + 0.5) / 100   # JS Math.round half-up


def _to_int(value):
    try:
        return math.floor(float(value))
    except (TypeError, ValueError):
        return None


def gen_ref():
    return "BBP-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=4))


def _anchor_for(item_id):
    """The menu group anchor an item belongs to, so add/remove keeps your place."""
    item = db.get_menu_item(item_id)
    if not item:
        return ""
    for full in db.get_menu():
        if full["id"] == item_id:
            return full["category"].lower().replace(" ", "-")
    return ""


# ---- Legal / info content (server-rendered pages) -------------------------
_TODAY = datetime.now().strftime("%d %B %Y")
LEGAL_DOCS = {
    "allergens": {"eyebrow": "Food Information Regulations 2014", "title": "Allergen Information", "body_html": f"""
        <p class="muted">Last updated {_TODAY}</p>
        <p>In line with UK food law, we provide full allergen information for everything we bake. If you have a food
           allergy or intolerance, please tell us <strong>before you order</strong>.</p>
        <h3>Cross-contamination</h3>
        <p>Our bakes are made in a kitchen that handles <strong>gluten, eggs, milk, soya, nuts and peanuts</strong>.
           While we take care to avoid cross-contact, we cannot guarantee any product is completely free from any
           allergen.</p>
        <h3>Ask us</h3>
        <p>Full ingredient and allergen breakdowns are available on request — contact
           <a href="mailto:BakedbyPrii@gmail.com">BakedbyPrii@gmail.com</a> before ordering.</p>"""},
    "delivery": {"eyebrow": "Collection & Didcot delivery", "title": "Delivery & Returns", "body_html": f"""
        <p class="muted">Last updated {_TODAY}</p>
        <h3>Collection</h3>
        <p>bakedbyPrii is a home-based bakery in Didcot. Collection is <strong>free and open to everyone</strong>. We'll
           share the exact address and a collection time when we confirm your order.</p>
        <h3>Delivery</h3>
        <p>We currently deliver <strong>within Didcot (OX11) only</strong>. Delivery is <strong>free on orders over
           £20</strong>; otherwise a £2.50 charge applies.</p>
        <h3>Cancelling</h3>
        <p>While your order is still awaiting confirmation you can cancel it instantly and free using the
           <strong>“Cancel my order”</strong> link in your confirmation email — no payment will have been taken.</p>"""},
    "privacy": {"eyebrow": "UK GDPR & Data Protection Act 2018", "title": "Privacy Policy", "body_html": f"""
        <p class="muted">Last updated {_TODAY}</p>
        <p>This policy explains how bakedbyPrii collects and uses your personal data, in line with the UK GDPR.</p>
        <h3>What we collect</h3>
        <ul><li>Your name, email, phone and delivery address</li><li>Order details, including any allergy information
            you give us</li></ul>
        <h3>Your rights</h3>
        <p>You have the right to access, correct or delete your data. Contact
           <a href="mailto:BakedbyPrii@gmail.com">BakedbyPrii@gmail.com</a> to exercise these rights.</p>"""},
    "terms": {"eyebrow": "The important bit", "title": "Terms & Conditions", "body_html": f"""
        <p class="muted">Last updated {_TODAY}</p>
        <h3>Orders</h3>
        <p>An order is a request to buy; a contract is formed only when we confirm acceptance. Standard orders require
           48 hours' notice; custom orders require at least 5 working days.</p>
        <h3>Prices & payment</h3>
        <p>Prices are in GBP. No payment is taken on this website; we arrange payment once your order is confirmed.</p>
        <h3>Your rights</h3>
        <p>Nothing in these terms affects your statutory rights under the Consumer Rights Act 2015.</p>"""},
}


if __name__ == "__main__":
    print()
    print("  🧁  bakedbyPrii (Python/Flask · server-rendered) running")
    print(f"      Storefront →  http://localhost:{PORT}")
    print(f"      Admin      →  http://localhost:{PORT}/admin   (key: {ADMIN_KEY})")
    print()
    app.run(host="0.0.0.0", port=PORT, threaded=True)
