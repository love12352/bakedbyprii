# Design — Python port of bakedbyPrii (2026-07-13)

## Goal

Re-implement the bakedbyPrii full stack in **Python**, as a standalone learning
project that sits beside the original Node app so the two can be compared
line-for-line. Learning the Python is the point; the app itself is unchanged in
behaviour.

## Repository layout

The repo was reorganised into two sibling folders under `Bakery/`:

```
Bakery/
├─ node-express/   ← the original app, MOVED intact (contents byte-identical)
└─ python/         ← this port
```

- The Node app was relocated with `git mv` (a pure rename — no content changes).
- The two folders never import from or depend on each other.
- Deploy note: `render.yaml` moved with the Node app, so a future Render deploy
  points its "Root Directory" at `node-express` (a dashboard setting, no edit).

## Stack decision

| Layer | Node original | Python port | Why |
|---|---|---|---|
| Web server | Express | **Flask** | Closest small-framework analogue; routes map 1:1 |
| Database | `node:sqlite` (built-in) | **`sqlite3`** (stdlib) | Same engine, same SQL, no new dependency |
| Email | `nodemailer` | **`smtplib`** (stdlib) | Standard library keeps the dependency list to just Flask |
| Env loading | `--env-file-if-exists` | tiny `load_env()` in `app.py` | Avoids an extra dependency; teaches what `--env-file` does |

Flask is the only third-party dependency, mirroring how the Node app leaned on
built-ins.

## Frontend: server-rendered (updated)

The first cut of this port reused the Node app's JavaScript frontend (static HTML
calling a JSON API). It was then **re-done as a server-rendered Python frontend**
at the user's request — because "the frontend in Python" is most idiomatically a
Flask + Jinja server-rendered app:

- Python builds every page from **Jinja2 templates** in `templates/`.
- The shopping cart is a dict in the **Flask session** (a signed cookie).
- Every interaction is a plain **HTML form POST** (add/remove item, checkout,
  cancel, admin status change) — no client-side JavaScript.
- Animation-only effects from the original SPA (GSAP, 3D tilt, sugar-dust, modal
  transitions) are intentionally dropped: they are inherently client-side and
  cannot "be Python". The brand look (colors, fonts, glass cards) is preserved in
  `static/styles.css`.

## Components

- **`app.py`** (≈ `server.js`) — routes, page rendering, the session cart, and
  `build_priced_order()` (the single copy of validation + pricing, used by both
  the Jinja checkout and the JSON API). Also admin session login and the
  token-gated cancel flow.
- **`db.py`** (≈ `lib/db.js`) — schema creation, `cancel_token` migration, menu
  seed, and the query functions (`get_menu`, `get_menu_item`, `create_order`,
  `list_orders`, `get_order`, `set_order_status`). Unchanged.
- **`mailer.py`** (≈ `lib/mailer.js`) — lifecycle + admin emails, no-reply
  headers, HTML shell, graceful no-op when SMTP is unset. Unchanged.
- **`templates/`** — Jinja templates: `base.html` (shared shell), `index.html`,
  `menu.html`, `checkout.html`, `confirmation.html`, `cancel.html`,
  `admin_login.html`, `admin.html`, `legal.html`.
- **`static/styles.css`** — the brand stylesheet.

## Behavioural parity (the contract)

Same rules as the Node app, now driven by server-rendered pages:

- **Pages:** `/` (home), `/menu` (cart builder), `/cart/add|remove|clear`,
  `/checkout` (GET form / POST place order), `/cancel` (GET view / POST cancel),
  `/admin` + `/admin/login|logout` + `/admin/orders/<ref>/status`, `/legal/<doc>`.
- **JSON API kept for reference:** `/api/health`, `/api/menu`, `/api/orders`,
  `/api/orders/<ref>`, `/api/orders/<ref>/cancel`, `/api/admin/orders`.
- **Validation:** required name/email/phone/date, email regex, payment whitelist
  (`cash|bank|card|paypal`), quantity 1–50, delivery only within `OX11`.
- **Pricing:** always computed server-side from the DB menu; delivery £2.50, free
  over £20. One implementation in `build_priced_order()`.
- **Security:** admin dashboard behind a session login (JSON admin still uses the
  `x-admin-key` header); customer view/cancel gated by a per-order `cancel_token`
  secret; the public order view hides email, phone and the token.

## Intentional differences

- **Server-rendered frontend** (Jinja + session cart + forms) instead of the
  Node app's JS-over-JSON SPA — this is the point of this version.
- **Default port 5000** (Node uses 3000) so both can run at once.
- **Separate database** at `python/data/bakery.db` — no shared state.
- **Background threads** for email (Python is synchronous where Node is async),
  giving the same fire-and-forget, non-blocking behaviour.
- **UTF-8 + line-buffered stdout** forced at startup so the emoji banner and live
  logs work on Windows.

## Verification (done)

Exercised end-to-end against the running server (via curl with session cookies +
a real browser click): home (Python-computed category prices), menu rendered from
the DB with working −/+ steppers, session cart subtotal, checkout placing an order
with correct pricing, cart emptied afterwards, rejected non-OX11 delivery with the
typed form values preserved, admin session login (401 on wrong key) with stats and
a persisted status change, and the token-gated cancel flow (Cancel button shown,
404 on a bad token, cancellation succeeds). The moved Node app was confirmed to
still boot and serve.

## Constraints honoured

- No existing file *contents* were edited (only relocated via `git mv`).
- The two stacks are fully isolated.
- Nothing was committed or pushed — left for the user to review.
