# bakedbyPrii — Python edition 🧁

A **Python/Flask** re-implementation of the bakedbyPrii home-bakery storefront +
order backend, in the sibling `../node-express/` folder — same validation, same
database schema, same emails — written so you can **learn how the Node concepts
map to Python**.

**The whole stack is Python here — including the frontend.** The Node app's
frontend is JavaScript in the browser talking to a JSON API. This version instead
uses **server-side rendering**: Python builds every page from **Jinja2 templates**,
the shopping cart lives in the **Flask session**, and every interaction is a plain
**HTML form** that Python handles. There is essentially no JavaScript.

The two apps are completely independent: this one has its own database, its own
dependencies, and never imports from the Node folder.

---

## Quick start

From this `python/` folder:

```powershell
# 1. Create an isolated environment (once)
python -m venv venv

# 2. Activate it
venv\Scripts\Activate.ps1        # PowerShell
# venv\Scripts\activate.bat       # cmd.exe
# source venv/bin/activate        # macOS/Linux

# 3. Install the one dependency (Flask)
pip install -r requirements.txt

# 4. Run
python app.py
```

Then open:

- Storefront → <http://localhost:5000>
- Admin dashboard → <http://localhost:5000/admin>  (key: `bakedbyprii-admin`)

> **Port 5000** (not 3000) on purpose — so you can run this *and* the Node app at
> the same time and compare them in two browser tabs. Override with `PORT` if you
> like. Email is off until you configure SMTP (see **Configuration**); until then
> orders still save and everything else works.

---

## What's in here

| File | Role | Node counterpart |
|------|------|------------------|
| `app.py` | Flask app — routes, pages, session cart, validation, pricing, auth | `server.js` |
| `db.py` | SQLite data layer — schema, seed, queries | `lib/db.js` |
| `mailer.py` | Order lifecycle emails over SMTP | `lib/mailer.js` |
| `templates/` | **Jinja2 HTML templates** — the frontend, rendered by Python | (was `public/*.html` + JS) |
| `static/` | `styles.css` — the brand stylesheet | (was inline `<style>`) |
| `requirements.txt` | Python dependencies (just Flask) | `package.json` |
| `.env.example` | Template for configuration | `.env.example` |
| `data/` | SQLite database, created on first run (git-ignored) | `data/` |

### The templates (`templates/`)

| Template | Page | Rendered by |
|---|---|---|
| `base.html` | Shared shell (nav, footer, `<head>`) every page extends | — |
| `index.html` | Home — hero + category cards priced from Python | `home()` |
| `menu.html` | Menu + cart builder (−/+ steppers are form POSTs) | `menu()` |
| `checkout.html` | Details + payment form | `checkout()` |
| `confirmation.html` | Order-placed page with payment next-steps | `checkout()` (POST) |
| `cancel.html` | Customer self-cancel (token-gated) | `cancel()` |
| `admin_login.html` / `admin.html` | Admin sign-in + orders dashboard | `admin()` |
| `legal.html` | Allergens / Delivery / Privacy / Terms pages | `legal()` |

### How a page request flows

```
Browser → GET /menu → menu() reads the DB + session cart
        → render_template("menu.html", groups=..., cart=...)
        → Python fills the Jinja template with data → HTML → Browser

Browser → clicks "+" (form POST /cart/add) → cart_add() updates session
        → redirect back to /menu (the classic Post/Redirect/Get pattern)
```

---

## Node → Python: the concept map

The single most useful thing for learning. Each row is something you'll see in
both codebases.

### Tooling & language

| Node / JavaScript | Python | Notes |
|---|---|---|
| `package.json` + `npm install` | `requirements.txt` + `pip install` | Dependency manifest |
| `node_modules/` | `venv/` | Where installed packages live |
| `npm start` | `python app.py` | Run the app |
| `import x from 'y'` | `import y` / `from y import x` | Modules |
| `export function f() {}` | `def f():` (all top-level names are importable) | Python has no `export` keyword |
| `const` / `let` | plain assignment (`x = 1`) | Python has no declaration keyword |
| `async`/`await`, Promises | plain function calls (+ threads for background work) | Flask is synchronous |
| `req.body?.token` | `(request.get_json() or {}).get("token")` | Optional chaining → `.get()` |
| `String(x).trim()` | `str(x).strip()` | |
| `Array.isArray(x)` | `isinstance(x, list)` | |
| `x.map(f)` | `[f(i) for i in x]` | List comprehension |
| `JSON` object `{}` | `dict` `{}` | |
| `` `£${n}` `` (template string) | `f"£{n}"` (f-string) | |

### Web framework (Express → Flask)

| Express | Flask |
|---|---|
| `const app = express()` | `app = Flask(__name__)` |
| `app.get('/x', (req, res) => …)` | `@app.get("/x")` above `def x():` |
| `req.params.ref` | the function argument `ref` (from `<ref>` in the route) |
| `req.query.token` | `request.args.get("token")` |
| `req.body.field` (form POST) | `request.form.get("field")` |
| `req.body` (JSON) | `request.get_json(silent=True)` |
| `res.json({...})` | `return jsonify(...)` |
| `res.status(400).json({...})` | `return jsonify(...), 400` |
| `res.redirect('/x')` | `return redirect(url_for("x"))` |
| middleware `requireAdmin` | a decorator `@require_admin` |
| `app.listen(PORT)` | `app.run(port=PORT)` |

### Frontend: JavaScript-in-the-browser → Jinja-on-the-server

This is the big difference from the Node app. There, the browser fetches JSON and
builds the page with JS. Here, **Python builds the HTML** and sends it ready-made.

| Node app (client-side JS) | This app (server-side Python) |
|---|---|
| `fetch('/api/menu')` then build DOM | `menu()` reads the DB, `render_template("menu.html", groups=…)` |
| a JS `cart = {}` object in the page | `session["cart"]` — a dict kept in a signed cookie |
| `cart[id]++` in JS | POST to `/cart/add`, `cart_add()` updates the session |
| compute subtotal in JS | `cart_lines()` computes it in Python |
| `` `<div>${name}</div>` `` template literals | `{{ name }}` in a Jinja template (auto-escaped) |
| `array.map(x => …).join('')` | `{% for x in array %}…{% endfor %}` |
| `if (cond) {...}` to show/hide | `{% if cond %}…{% endif %}` |
| build links by hand | `{{ url_for('menu') }}` (Flask builds the URL) |
| SPA — one page, JS swaps content | multi-page — each URL is its own server-rendered page |

Jinja template basics used in `templates/`:

- `{% extends "base.html" %}` — inherit the shared shell
- `{% block content %}…{% endblock %}` — fill a named slot
- `{{ value }}` — print a Python value (HTML-escaped for safety)
- `{{ value | safe }}` — print trusted HTML without escaping
- `{{ '%.2f' | format(n) }}` — format a number (like `n.toFixed(2)`)

### Database (`node:sqlite` → `sqlite3`)

| Node | Python |
|---|---|
| `new DatabaseSync(path)` | `sqlite3.connect(path)` |
| `db.prepare(sql).run(a, b)` | `con.execute(sql, (a, b))` |
| `db.prepare(sql).get(id)` | `con.execute(sql, (id,)).fetchone()` |
| `db.prepare(sql).all()` | `con.execute(sql, ()).fetchall()` |
| `db.exec('BEGIN' / 'COMMIT' / 'ROLLBACK')` | `with con:` (auto commit / rollback) |
| `randomBytes(16).toString('hex')` | `secrets.token_hex(16)` |
| result row `.name` | `row["name"]` (via `sqlite3.Row`) |

### Email (`nodemailer` → `smtplib`)

| Node | Python |
|---|---|
| `nodemailer.createTransport({...})` | `smtplib.SMTP(host, port)` / `SMTP_SSL` |
| `transporter.sendMail({from, to, subject, text, html})` | build an `EmailMessage`, then `smtp.send_message(msg)` |
| `sendOrderPlaced(...).catch(() => {})` (fire-and-forget) | `mailer.fire(mailer.send_order_placed, ...)` (background thread) |

---

## How each layer works

**`db.py`** — On startup, `init_db()` creates the three tables (`menu`,
`orders`, `order_items`), runs the one migration (adds `cancel_token` if an old
database is missing it), and seeds the fixed-price menu once. Every query
function opens a short-lived connection (`_connect()`), which keeps things
thread-safe on Flask's threaded dev server. `create_order()` wraps the order +
its items in a single transaction with `with con:`.

**`app.py`** — Defines every route and renders the templates. The frontend flow
is `/` → `/menu` (build the cart) → `/checkout` (details) → confirmation. The cart
is a `session["cart"]` dict; `build_priced_order()` holds the one copy of the
validation + pricing rules and is used by both the Jinja checkout and the JSON
API. The important safety detail (shared with the Node app): **prices are always
looked up from the database, never trusted from the browser.** Delivery is
Didcot-only (`OX11`), £2.50, free over £20. The admin dashboard is protected by a
session login; customers can view and cancel *their own* order via a secret
per-order token that only ever appears in their email.

A small **JSON API** (`/api/health`, `/api/menu`, `/api/orders`, `/api/admin/*`,
gated by the `x-admin-key` header) is kept for reference, so you can compare the
server-rendered style with the REST style — but the Jinja pages are the frontend.

**`mailer.py`** — Sends branded HTML + plain-text emails at each stage (placed,
confirmed, completed, cancelled) plus admin copies. If SMTP isn't configured it
quietly does nothing, so the app runs fully without email. Sends run in a
background thread so they never delay the customer's response.

---

## Configuration

Copy `.env.example` to `.env` and fill in what you need (all optional locally):

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Port to listen on | `5000` |
| `ADMIN_KEY` | Key for `/admin` — **change before going live** | `bakedbyprii-admin` |
| `SECRET_KEY` | Signs the session cookie (cart + admin login) — set in production | `dev-secret-change-me` |
| `DELIVERY_FEE` | Delivery charge | `2.50` |
| `FREE_DELIVERY_OVER` | Free delivery threshold | `20` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP for email (e.g. a Gmail App Password) | unset → email off |
| `SMTP_FROM` | From header | `bakedbyPrii <SMTP_USER>` |
| `ORDER_NOTIFY_TO` | Where new/cancelled order copies go | unset |
| `PUBLIC_URL` | Site origin used in email links | derived from request |

---

## Running both apps at once

```powershell
# Terminal 1 — Node (port 3000)
cd ..\node-express ; npm start

# Terminal 2 — Python (port 5000)
cd ..\python ; venv\Scripts\Activate.ps1 ; python app.py
```

Open both and compare the identical behaviour: <http://localhost:3000> and
<http://localhost:5000>. They keep separate databases, so orders in one do not
appear in the other.
