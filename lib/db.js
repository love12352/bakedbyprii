// Database layer for bakedbyPri — uses Node's built-in SQLite (node:sqlite, Node 22+).
// No native build steps, no external DB to install.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(join(DATA_DIR, 'bakery.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
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
`);

// ---- Seed the menu once (mirrors the storefront) ----
// Fixed-price items only. Bespoke items (custom celebration cakes,
// number/letter cupcakes) are handled via the Custom Orders enquiry form.
const MENU_SEED = [
  // Cookies — Classic Range £2.75, Premium/Stuffed Range £3.75 (each)
  ['ck-chocchip',   'Cookies',        'Chocolate Chip Cookie',      2.75, 'Gluten, Egg, Milk, Soya'],
  ['ck-double',     'Cookies',        'Double Chocolate Cookie',    2.75, 'Gluten, Egg, Milk, Soya'],
  ['ck-white',      'Cookies',        'White Chocolate Cookie',     2.75, 'Gluten, Egg, Milk, Soya'],
  ['ck-redvelvet',  'Cookies',        'Red Velvet Cookie',          2.75, 'Gluten, Egg, Milk'],
  ['ck-oreo',       'Cookies',        'Oreo Cookie',                2.75, 'Gluten, Egg, Milk, Soya'],
  ['ck-biscoff',    'Cookies',        'Biscoff Stuffed Cookie',     3.75, 'Gluten, Egg, Milk, Soya'],
  ['ck-nutella',    'Cookies',        'Nutella Stuffed Cookie',     3.75, 'Gluten, Egg, Milk, Soya, Nuts'],
  ['ck-kinder',     'Cookies',        'Kinder Cookie',              3.75, 'Gluten, Egg, Milk, Soya, Nuts'],
  ['ck-triple',     'Cookies',        'Triple Chocolate Cookie',    3.75, 'Gluten, Egg, Milk, Soya'],

  // Cupcakes (each)
  ['cup-vanilla',   'Cupcakes',       'Vanilla Cupcake',            3.00, 'Gluten, Egg, Milk'],
  ['cup-choc',      'Cupcakes',       'Chocolate Cupcake',          3.00, 'Gluten, Egg, Milk, Soya'],
  ['cup-nutella',   'Cupcakes',       'Nutella Stuffed Cupcake',    3.75, 'Gluten, Egg, Milk, Soya, Nuts'],
  ['cup-floral',    'Cupcakes',       'Floral Cupcake',             4.00, 'Gluten, Egg, Milk'],
  ['cup-mini',      'Cupcakes',       'Mini Cupcake',               1.50, 'Gluten, Egg, Milk'],

  // Cakes — 6" round, serves 8–10
  ['cake-vanilla',  'Cakes',          'Vanilla Buttercream Cake',  35.00, 'Gluten, Egg, Milk'],
  ['cake-choc',     'Cakes',          'Chocolate Cake',            38.00, 'Gluten, Egg, Milk, Soya'],
  ['cake-redvelvet','Cakes',          'Red Velvet Cake',           40.00, 'Gluten, Egg, Milk'],
  ['cake-forest',   'Cakes',          'Black Forest Cake',         42.00, 'Gluten, Egg, Milk, Soya'],

  // Brownies (each)
  ['br-classic',    'Brownies',       'Classic Fudgy Brownie',      2.75, 'Gluten, Egg, Milk, Soya'],
  ['br-double',     'Brownies',       'Double Chocolate Brownie',   3.00, 'Gluten, Egg, Milk, Soya'],
  ['br-ferrero',    'Brownies',       'Ferrero Rocher Brownie',     3.75, 'Gluten, Egg, Milk, Soya, Nuts'],
  ['br-mini',       'Brownies',       'Mini Brownie',               1.50, 'Gluten, Egg, Milk, Soya'],

  // Tea Time Bakes
  ['tea-butter',    'Tea Time Bakes', 'Butter Cake (loaf)',        12.00, 'Gluten, Egg, Milk'],
  ['tea-marble',    'Tea Time Bakes', 'Marble Cake (loaf)',        14.00, 'Gluten, Egg, Milk'],
  ['tea-scones',    'Tea Time Bakes', 'Scones (4-pack)',            6.00, 'Gluten, Egg, Milk']
];
const menuCount = db.prepare('SELECT COUNT(*) AS n FROM menu').get().n;
if (menuCount === 0) {
  const ins = db.prepare('INSERT INTO menu (id, category, name, price, allergens) VALUES (?, ?, ?, ?, ?)');
  for (const row of MENU_SEED) ins.run(...row);
}

// ---- Prepared statements ----
const stmts = {
  menu:        db.prepare('SELECT id, category, name, price, allergens FROM menu WHERE active = 1'),
  menuItem:    db.prepare('SELECT id, name, price FROM menu WHERE id = ? AND active = 1'),
  insertOrder: db.prepare(`INSERT INTO orders
      (ref, created_at, name, email, phone, notes, fulfilment, address, postcode, required_date, payment, subtotal, delivery_fee, total, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`),
  insertItem:  db.prepare('INSERT INTO order_items (order_ref, item_id, name, price, qty) VALUES (?, ?, ?, ?, ?)'),
  listOrders:  db.prepare('SELECT * FROM orders ORDER BY created_at DESC'),
  orderItems:  db.prepare('SELECT item_id, name, price, qty FROM order_items WHERE order_ref = ?'),
  setStatus:   db.prepare('UPDATE orders SET status = ? WHERE ref = ?')
};

function insertOrderTx(order, items) {
  db.exec('BEGIN');
  try {
    stmts.insertOrder.run(
      order.ref, order.created_at, order.name, order.email, order.phone, order.notes,
      order.fulfilment, order.address, order.postcode, order.required_date, order.payment,
      order.subtotal, order.delivery_fee, order.total
    );
    for (const it of items) stmts.insertItem.run(order.ref, it.item_id, it.name, it.price, it.qty);
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  }
}

export function getMenu() {
  return stmts.menu.all();
}

export function getMenuItem(id) {
  return stmts.menuItem.get(id);
}

export function createOrder(order, items) {
  insertOrderTx(order, items);
}

export function listOrders() {
  return stmts.listOrders.all().map(o => ({ ...o, items: stmts.orderItems.all(o.ref) }));
}

export function setOrderStatus(ref, status) {
  const res = stmts.setStatus.run(status, ref);
  return res.changes > 0;
}

export default db;
