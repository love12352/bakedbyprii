"""Database layer for bakedbyPrii — Python port of ``node-express/lib/db.js``.

Uses Python's standard-library ``sqlite3`` (the Node version used the built-in
``node:sqlite``). No external database, no native build steps.

Node → Python mapping for this file:
    new DatabaseSync(path)          ->  sqlite3.connect(path)
    db.prepare(sql).run(...)        ->  con.execute(sql, (...))
    db.prepare(sql).get(...)        ->  con.execute(sql, (...)).fetchone()
    db.prepare(sql).all(...)        ->  con.execute(sql, (...)).fetchall()
    db.exec('BEGIN'/'COMMIT'/...)   ->  ``with con:``  (auto commit / rollback)
    randomBytes(16).toString('hex') ->  secrets.token_hex(16)

Threading note: the Flask dev server handles each request on its own thread, and
a single ``sqlite3`` connection may not be shared across threads. So instead of
one module-level connection (as the Node app has), we open a short-lived
connection per operation via ``_connect()``. SQLite handles this cheaply, and it
keeps every function self-contained and thread-safe.
"""

import os
import secrets
import sqlite3

# ---- Paths ----------------------------------------------------------------
# This file lives in python/, and the database goes in python/data/bakery.db —
# the Python app keeps its OWN database, completely separate from the Node app.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "bakery.db")
os.makedirs(DATA_DIR, exist_ok=True)


def _connect():
    """Open a new SQLite connection configured the way every query expects.

    ``row_factory = sqlite3.Row`` makes rows behave like dicts (``row["name"]``),
    which mirrors how the Node app's rows came back as plain objects.
    ``PRAGMA foreign_keys`` is per-connection in SQLite, so we set it each time.
    """
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


# ---- Menu seed (mirrors the storefront) -----------------------------------
# Fixed-price items only. Bespoke items (custom celebration cakes, number/letter
# cupcakes) are handled via the Custom Orders enquiry form.
# Each row: (id, category, name, price, allergens)
MENU_SEED = [
    # Cookies — Classic Range £2.75, Premium/Stuffed Range £3.75 (each)
    ("ck-chocchip",   "Cookies",        "Chocolate Chip Cookie",      2.75, "Gluten, Egg, Milk, Soya"),
    ("ck-double",     "Cookies",        "Double Chocolate Cookie",    2.75, "Gluten, Egg, Milk, Soya"),
    ("ck-white",      "Cookies",        "White Chocolate Cookie",     2.75, "Gluten, Egg, Milk, Soya"),
    ("ck-redvelvet",  "Cookies",        "Red Velvet Cookie",          2.75, "Gluten, Egg, Milk"),
    ("ck-oreo",       "Cookies",        "Oreo Cookie",                2.75, "Gluten, Egg, Milk, Soya"),
    ("ck-biscoff",    "Cookies",        "Biscoff Stuffed Cookie",     3.75, "Gluten, Egg, Milk, Soya"),
    ("ck-nutella",    "Cookies",        "Nutella Stuffed Cookie",     3.75, "Gluten, Egg, Milk, Soya, Nuts"),
    ("ck-kinder",     "Cookies",        "Kinder Cookie",              3.75, "Gluten, Egg, Milk, Soya, Nuts"),
    ("ck-triple",     "Cookies",        "Triple Chocolate Cookie",    3.75, "Gluten, Egg, Milk, Soya"),

    # Cupcakes (each)
    ("cup-vanilla",   "Cupcakes",       "Vanilla Cupcake",            3.00, "Gluten, Egg, Milk"),
    ("cup-choc",      "Cupcakes",       "Chocolate Cupcake",          3.00, "Gluten, Egg, Milk, Soya"),
    ("cup-nutella",   "Cupcakes",       "Nutella Stuffed Cupcake",    3.75, "Gluten, Egg, Milk, Soya, Nuts"),
    ("cup-floral",    "Cupcakes",       "Floral Cupcake",             4.00, "Gluten, Egg, Milk"),
    ("cup-mini",      "Cupcakes",       "Mini Cupcake",               1.50, "Gluten, Egg, Milk"),

    # Cakes — 6" round, serves 8–10
    ("cake-vanilla",   "Cakes",         "Vanilla Buttercream Cake",  35.00, "Gluten, Egg, Milk"),
    ("cake-choc",      "Cakes",         "Chocolate Cake",            38.00, "Gluten, Egg, Milk, Soya"),
    ("cake-redvelvet", "Cakes",         "Red Velvet Cake",           40.00, "Gluten, Egg, Milk"),
    ("cake-forest",    "Cakes",         "Black Forest Cake",         42.00, "Gluten, Egg, Milk, Soya"),

    # Brownies (each)
    ("br-classic",    "Brownies",       "Classic Fudgy Brownie",      2.75, "Gluten, Egg, Milk, Soya"),
    ("br-double",     "Brownies",       "Double Chocolate Brownie",   3.00, "Gluten, Egg, Milk, Soya"),
    ("br-ferrero",    "Brownies",       "Ferrero Rocher Brownie",     3.75, "Gluten, Egg, Milk, Soya, Nuts"),
    ("br-mini",       "Brownies",       "Mini Brownie",               1.50, "Gluten, Egg, Milk, Soya"),

    # Tea Time Bakes
    ("tea-butter",    "Tea Time Bakes", "Butter Cake (loaf)",        12.00, "Gluten, Egg, Milk"),
    ("tea-marble",    "Tea Time Bakes", "Marble Cake (loaf)",        14.00, "Gluten, Egg, Milk"),
    ("tea-scones",    "Tea Time Bakes", "Scones (4-pack)",            6.00, "Gluten, Egg, Milk"),
]


def init_db():
    """Create tables, run the one migration, and seed the menu once.

    Idempotent — safe to call on every startup (mirrors how ``db.js`` runs its
    schema on import). ``CREATE TABLE IF NOT EXISTS`` and the seed-count check
    mean nothing is duplicated on repeat runs.
    """
    con = _connect()
    try:
        # WAL is a database-level setting that persists, so setting it once is enough.
        con.execute("PRAGMA journal_mode = WAL")

        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS menu (
                id        TEXT PRIMARY KEY,
                category  TEXT NOT NULL,
                name      TEXT NOT NULL,
                price     REAL NOT NULL,
                allergens TEXT,
                active    INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS orders (
                ref           TEXT PRIMARY KEY,
                created_at    TEXT NOT NULL,
                name          TEXT NOT NULL,
                email         TEXT NOT NULL,
                phone         TEXT NOT NULL,
                notes         TEXT,
                fulfilment    TEXT NOT NULL,
                address       TEXT,
                postcode      TEXT,
                required_date TEXT NOT NULL,
                payment       TEXT NOT NULL,
                subtotal      REAL NOT NULL,
                delivery_fee  REAL NOT NULL,
                total         REAL NOT NULL,
                status        TEXT NOT NULL DEFAULT 'new'
            );

            CREATE TABLE IF NOT EXISTS order_items (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                order_ref TEXT NOT NULL,
                item_id   TEXT NOT NULL,
                name      TEXT NOT NULL,
                price     REAL NOT NULL,
                qty       INTEGER NOT NULL,
                FOREIGN KEY (order_ref) REFERENCES orders(ref) ON DELETE CASCADE
            );
            """
        )

        # ---- Migration: add the customer self-cancel token if it's missing ----
        # Older databases predate this column; add it in place so existing
        # orders keep working. (PRAGMA table_info lists the current columns.)
        cols = [row["name"] for row in con.execute("PRAGMA table_info(orders)")]
        if "cancel_token" not in cols:
            con.execute("ALTER TABLE orders ADD COLUMN cancel_token TEXT")

        # ---- Seed the menu once ----
        count = con.execute("SELECT COUNT(*) AS n FROM menu").fetchone()["n"]
        if count == 0:
            con.executemany(
                "INSERT INTO menu (id, category, name, price, allergens) VALUES (?, ?, ?, ?, ?)",
                MENU_SEED,
            )
            con.commit()
    finally:
        con.close()


# ---- Public query functions (same names/shape as db.js exports) -----------

def get_menu():
    """All active menu items, as a list of dicts (JSON-ready)."""
    con = _connect()
    try:
        rows = con.execute(
            "SELECT id, category, name, price, allergens FROM menu WHERE active = 1"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        con.close()


def get_menu_item(item_id):
    """One active menu item (id, name, price) or None — used for server-side pricing."""
    con = _connect()
    try:
        row = con.execute(
            "SELECT id, name, price FROM menu WHERE id = ? AND active = 1", (item_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        con.close()


def create_order(order, items):
    """Insert an order and its items in a single transaction; return the cancel token.

    ``with con:`` is SQLite's transaction context: it commits if the block
    succeeds and rolls back if anything raises — the Python equivalent of the
    BEGIN / COMMIT / ROLLBACK dance in ``insertOrderTx``.

    Raises ``sqlite3.IntegrityError`` if ``ref`` collides with an existing order
    (the caller retries with a fresh ref, just like the Node version).
    """
    token = order.get("cancel_token") or secrets.token_hex(16)
    con = _connect()
    try:
        with con:  # transaction
            con.execute(
                """INSERT INTO orders
                    (ref, created_at, name, email, phone, notes, fulfilment, address,
                     postcode, required_date, payment, subtotal, delivery_fee, total,
                     cancel_token, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')""",
                (
                    order["ref"], order["created_at"], order["name"], order["email"],
                    order["phone"], order["notes"], order["fulfilment"], order["address"],
                    order["postcode"], order["required_date"], order["payment"],
                    order["subtotal"], order["delivery_fee"], order["total"], token,
                ),
            )
            con.executemany(
                "INSERT INTO order_items (order_ref, item_id, name, price, qty) VALUES (?, ?, ?, ?, ?)",
                [(order["ref"], it["item_id"], it["name"], it["price"], it["qty"]) for it in items],
            )
        return token
    finally:
        con.close()


def _order_items(con, ref):
    rows = con.execute(
        "SELECT item_id, name, price, qty FROM order_items WHERE order_ref = ?", (ref,)
    ).fetchall()
    return [dict(r) for r in rows]


def list_orders():
    """Every order, newest first, each with its ``items`` list attached."""
    con = _connect()
    try:
        orders = con.execute("SELECT * FROM orders ORDER BY created_at DESC").fetchall()
        result = []
        for o in orders:
            d = dict(o)
            d["items"] = _order_items(con, d["ref"])
            result.append(d)
        return result
    finally:
        con.close()


def get_order(ref):
    """One order (with its items) by ref, or None."""
    con = _connect()
    try:
        o = con.execute("SELECT * FROM orders WHERE ref = ?", (ref,)).fetchone()
        if not o:
            return None
        d = dict(o)
        d["items"] = _order_items(con, ref)
        return d
    finally:
        con.close()


def set_order_status(ref, status):
    """Update an order's status; return True if a row actually changed."""
    con = _connect()
    try:
        with con:
            cur = con.execute("UPDATE orders SET status = ? WHERE ref = ?", (status, ref))
        return cur.rowcount > 0
    finally:
        con.close()
