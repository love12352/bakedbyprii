#!/usr/bin/env python3
"""
Sugar & Crumb — Home Bakery backend
===================================

A small, zero-dependency web server (Python standard library only) that:

  * serves the static front-end (HTML / CSS / JS) from ./separated
  * exposes the product catalogue at        GET  /api/products
  * accepts customer orders at              POST /api/order   (saved to orders.json)
  * gzip-compresses text responses
  * sends sensible Cache-Control headers
  * handles requests concurrently (ThreadingHTTPServer)

Run:
    python server.py                # http://localhost:8001
    python server.py --port 9000
"""

from __future__ import annotations

import argparse
import gzip
import html
import json
import re
import sys
import time
from datetime import datetime, date
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# --------------------------------------------------------------------------- #
# Configuration & data
# --------------------------------------------------------------------------- #

ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "separated"          # where index.html / styles.css / script.js live
ORDERS_FILE = ROOT / "orders.json"
IMG = "https://images.unsplash.com/"
Q = "?auto=format&fit=crop&w=600&q=80"

# Single source of truth for the menu (the front-end can fetch this instead of
# hard-coding its own copy).
PRODUCTS = [
    {"cat": "cookies",  "emoji": "🍪", "img": IMG + "photo-1499636136210-6f4ee915583e" + Q, "name": "Classic Choc-Chip",  "desc": "Brown-butter cookies loaded with dark chocolate.", "price": 180, "unit": "/ box of 6", "tag": "Bestseller"},
    {"cat": "cookies",  "emoji": "🍫", "img": IMG + "photo-1558961363-fa8fdf82db35" + Q, "name": "Double Chocolate",   "desc": "Fudgy cocoa cookies with melty chunks.",            "price": 200, "unit": "/ box of 6", "tag": ""},
    {"cat": "cookies",  "emoji": "🥜", "img": IMG + "photo-1490567674331-72de84996ff1" + Q, "name": "Peanut Butter",      "desc": "Soft, nutty & lightly salted.",                     "price": 190, "unit": "/ box of 6", "tag": "Veg"},
    {"cat": "cakes",    "emoji": "🎂", "img": IMG + "photo-1535141192574-5d4897c12636" + Q, "name": "Classic Vanilla",    "desc": "Soft vanilla sponge with silky buttercream.",       "price": 650, "unit": "/ 500g",     "tag": ""},
    {"cat": "cakes",    "emoji": "🍰", "img": IMG + "photo-1606890658317-7d14490b76fd" + Q, "name": "Chocolate Truffle",  "desc": "Rich chocolate layers & ganache drip.",             "price": 750, "unit": "/ 500g",     "tag": "Bestseller"},
    {"cat": "cakes",    "emoji": "🍓", "img": IMG + "photo-1586788680434-30d324b2d46f" + Q, "name": "Red Velvet",         "desc": "Velvety cocoa cake with cream cheese frosting.",     "price": 800, "unit": "/ 500g",     "tag": "New"},
    {"cat": "cupcakes", "emoji": "🧁", "img": IMG + "photo-1614707267537-b85aaf00c4b7" + Q, "name": "Vanilla Swirl",      "desc": "Fluffy sponge, classic buttercream swirl.",         "price": 240, "unit": "/ set of 6", "tag": ""},
    {"cat": "cupcakes", "emoji": "🍫", "img": IMG + "photo-1599785209707-a456fc1337bb" + Q, "name": "Choco Overload",     "desc": "Chocolate cupcake topped with ganache.",            "price": 280, "unit": "/ set of 6", "tag": "Bestseller"},
    {"cat": "cupcakes", "emoji": "🍒", "img": IMG + "photo-1563729784474-d77dbb933a9e" + Q, "name": "Berry Bliss",        "desc": "Berry-kissed sponge & whipped frosting.",           "price": 300, "unit": "/ set of 6", "tag": "New"},
]

VALID_ITEMS = {p["name"] for p in PRODUCTS} | {
    "Cookies — box", "Custom Cake", "Cupcakes — set of 6",
    "Cupcakes — set of 12", "Mixed / not sure yet",
}
PHONE_RE = re.compile(r"^[\d\s+()-]{7,20}$")

# Static assets get cached hard; HTML is always revalidated.
LONG_CACHE = {".css", ".js", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".ico", ".woff2"}
GZIP_TYPES = {"text/html", "text/css", "text/javascript", "application/javascript",
              "application/json", "image/svg+xml", "text/plain"}
GZIP_MIN_BYTES = 256


# --------------------------------------------------------------------------- #
# Request handler
# --------------------------------------------------------------------------- #

class BakeryHandler(SimpleHTTPRequestHandler):
    """Serves the static site + a tiny JSON API, with gzip and caching."""

    server_version = "SugarCrumb/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    # ----- routing ----------------------------------------------------------
    def do_GET(self):
        route = self.path.split("?")[0]
        if route == "/api/products":
            return self._send_json(HTTPStatus.OK, {"products": PRODUCTS, "count": len(PRODUCTS)})
        if route == "/api/orders":
            return self._send_json(HTTPStatus.OK, {"orders": self._read_orders()})
        if route == "/admin":
            return self._render_admin()
        return self._serve_static()

    def do_HEAD(self):
        return self._serve_static()

    # ----- static files (with gzip + caching) -------------------------------
    def _serve_static(self):
        # translate_path() safely maps the URL into STATIC_DIR (blocks ../ escapes)
        fs_path = Path(self.translate_path(self.path.split("?")[0]))
        if fs_path.is_dir():
            fs_path = fs_path / "index.html"
        if not fs_path.is_file():
            return self._send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})

        try:
            body = fs_path.read_bytes()
        except OSError:
            return self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "read failed"})

        ctype = self.guess_type(str(fs_path))
        cacheable = fs_path.suffix.lower() in LONG_CACHE
        self._write(HTTPStatus.OK, body, ctype, cacheable=cacheable)

    def do_POST(self):
        if self.path.split("?")[0] == "/api/order":
            return self._handle_order()
        return self._send_json(HTTPStatus.NOT_FOUND, {"error": "unknown endpoint"})

    # ----- /api/order -------------------------------------------------------
    def _handle_order(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > 100_000:
                return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "empty or oversized body"})
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, json.JSONDecodeError):
            return self._send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid JSON"})

        ok, problem = self._validate(payload)
        if not ok:
            return self._send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {"error": problem})

        order = {
            "name": payload["name"].strip(),
            "phone": payload["phone"].strip(),
            "item": payload["item"],
            "date": payload.get("date", ""),
            "notes": str(payload.get("msg", "")).strip()[:1000],
            "received_at": datetime.now().isoformat(timespec="seconds"),
        }
        self._append_order(order)
        return self._send_json(HTTPStatus.CREATED,
                               {"ok": True, "message": "Order received! We'll be in touch soon.", "order": order})

    @staticmethod
    def _validate(p: dict):
        if not isinstance(p, dict):
            return False, "body must be an object"
        if not str(p.get("name", "")).strip():
            return False, "name is required"
        if not PHONE_RE.match(str(p.get("phone", "")).strip()):
            return False, "a valid phone number is required"
        if p.get("item") not in VALID_ITEMS:
            return False, "please choose a valid item"
        d = str(p.get("date", "")).strip()
        if d:
            try:
                if date.fromisoformat(d) < date.today():
                    return False, "pickup date cannot be in the past"
            except ValueError:
                return False, "date must be YYYY-MM-DD"
        return True, ""

    @staticmethod
    def _read_orders():
        if ORDERS_FILE.exists():
            try:
                data = json.loads(ORDERS_FILE.read_text("utf-8"))
                return data if isinstance(data, list) else []
            except (ValueError, OSError):
                return []
        return []

    def _append_order(self, order: dict):
        orders = self._read_orders()
        orders.append(order)
        ORDERS_FILE.write_text(json.dumps(orders, ensure_ascii=False, indent=2), "utf-8")

    # ----- /admin (orders dashboard) ---------------------------------------
    def _render_admin(self):
        orders = list(reversed(self._read_orders()))  # newest first
        if orders:
            rows = "\n".join(
                "<tr>"
                f"<td>{html.escape(o.get('received_at', ''))}</td>"
                f"<td><b>{html.escape(o.get('name', ''))}</b></td>"
                f"<td><a href='tel:{html.escape(o.get('phone', ''))}'>{html.escape(o.get('phone', ''))}</a></td>"
                f"<td>{html.escape(o.get('item', ''))}</td>"
                f"<td>{html.escape(o.get('date', '') or '—')}</td>"
                f"<td>{html.escape(o.get('notes', '') or '—')}</td>"
                "</tr>"
                for o in orders
            )
            table = (
                "<table><thead><tr>"
                "<th>Received</th><th>Name</th><th>Phone</th><th>Item</th><th>Needed by</th><th>Notes</th>"
                f"</tr></thead><tbody>{rows}</tbody></table>"
            )
        else:
            table = "<p class='empty'>No orders yet. They'll appear here as customers submit the form. 🧁</p>"

        page = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Orders · Sugar &amp; Crumb</title>
<style>
  :root{{ --ink:#3a2b22; --cream:#fdf6ee; --berry:#b3456a; --rose:#d4607c; --line:#eaddcf; }}
  *{{ box-sizing:border-box; }}
  body{{ margin:0; font-family:system-ui,Segoe UI,Roboto,sans-serif; background:var(--cream); color:var(--ink); }}
  header{{ background:var(--ink); color:var(--cream); padding:1.2rem clamp(1rem,4vw,2.5rem); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; }}
  header h1{{ margin:0; font-size:1.3rem; }} header h1 span{{ color:var(--rose); }}
  .count{{ background:var(--berry); padding:.3rem .8rem; border-radius:100px; font-size:.85rem; font-weight:700; }}
  main{{ padding:clamp(1rem,4vw,2.5rem); max-width:1100px; margin:0 auto; }}
  .bar{{ display:flex; gap:.8rem; margin-bottom:1.2rem; flex-wrap:wrap; }}
  .bar a, .bar button{{ border:1px solid var(--line); background:#fff; color:var(--ink); padding:.55rem 1rem; border-radius:10px; font-weight:600; cursor:pointer; text-decoration:none; font-size:.9rem; }}
  .bar a:hover, .bar button:hover{{ background:var(--ink); color:var(--cream); }}
  table{{ width:100%; border-collapse:collapse; background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 10px 30px rgba(90,58,44,.08); }}
  th{{ background:#f7ebdd; text-align:left; font-size:.78rem; letter-spacing:.04em; text-transform:uppercase; color:#6b5546; padding:.85rem 1rem; }}
  td{{ padding:.85rem 1rem; border-top:1px solid var(--line); font-size:.92rem; vertical-align:top; }}
  tr:hover td{{ background:#fffaf3; }}
  td a{{ color:var(--berry); }}
  .empty{{ background:#fff; padding:3rem; border-radius:14px; text-align:center; color:#6b5546; }}
  @media (max-width:640px){{ thead{{ display:none; }} table,tbody,tr,td{{ display:block; width:100%; }} tr{{ border-top:6px solid var(--cream); }} td{{ border:none; padding:.4rem 1rem; }} td::before{{ content:attr(data-l); font-weight:700; color:#6b5546; display:block; font-size:.72rem; text-transform:uppercase; }} }}
</style></head>
<body>
  <header>
    <h1>🧁 Sugar<span>&amp;</span>Crumb — Orders</h1>
    <span class="count">{len(orders)} order{'s' if len(orders) != 1 else ''}</span>
  </header>
  <main>
    <div class="bar">
      <button onclick="location.reload()">↻ Refresh</button>
      <a href="/api/orders" target="_blank">Raw JSON</a>
      <a href="/">← Back to site</a>
    </div>
    {table}
  </main>
</body></html>"""
        self._write(HTTPStatus.OK, page.encode("utf-8"), "text/html; charset=utf-8", cacheable=False)

    # ----- response helpers -------------------------------------------------
    def _send_json(self, status: HTTPStatus, obj: dict):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self._write(status, body, "application/json; charset=utf-8", cacheable=False)

    def _write(self, status, body: bytes, content_type: str, cacheable: bool):
        gzipped = False
        base_type = content_type.split(";")[0].strip()
        if (base_type in GZIP_TYPES
                and len(body) >= GZIP_MIN_BYTES
                and "gzip" in self.headers.get("Accept-Encoding", "")):
            body = gzip.compress(body, compresslevel=6)
            gzipped = True

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        if gzipped:
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
        self.send_header("Cache-Control",
                         "public, max-age=31536000, immutable" if cacheable else "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    # Quieter, single-line access log.
    def log_message(self, fmt, *args):
        print(f"{self.log_date_time_string()}  {self.address_string()}  {fmt % args}")


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #

def main():
    ap = argparse.ArgumentParser(description="Sugar & Crumb bakery server")
    ap.add_argument("--port", type=int, default=8001)
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()

    # Windows consoles default to cp1252 and choke on emoji; force UTF-8.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass

    if not (STATIC_DIR / "index.html").exists():
        raise SystemExit(f"Static site not found at {STATIC_DIR} (expected index.html)")

    httpd = ThreadingHTTPServer((args.host, args.port), BakeryHandler)
    httpd.daemon_threads = True
    print(f"🧁  Sugar & Crumb running at http://{args.host}:{args.port}")
    print(f"    Static : {STATIC_DIR}")
    print(f"    API    : GET /api/products   POST /api/order   GET /api/orders")
    print(f"    Admin  : http://{args.host}:{args.port}/admin")
    print("    Ctrl+C to stop.\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋  Shutting down.")
        httpd.shutdown()


if __name__ == "__main__":
    main()
