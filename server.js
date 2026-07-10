// bakedbyPrii backend — serves the storefront + admin, and handles orders.
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMenu, getMenuItem, createOrder, listOrders, setOrderStatus, getOrder } from './lib/db.js';
import { notifyNewOrder, sendOrderPlaced, sendStatusEmail, notifyAdminCancelled, verifyMailer } from './lib/mailer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- Config (override with environment variables) ----
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'bakedbyprii-admin';   // CHANGE THIS before going live
const DELIVERY_FEE = Number(process.env.DELIVERY_FEE ?? 2.5);
const FREE_DELIVERY_OVER = Number(process.env.FREE_DELIVERY_OVER ?? 20);
const DELIVERY_POSTCODE = /^OX11/i;                              // Didcot
const STATUSES = ['new', 'confirmed', 'completed', 'cancelled'];

const app = express();
app.use(express.json({ limit: '64kb' }));

// ---- Static storefront ----
app.use(express.static(join(__dirname, 'public'), { extensions: ['html'] }));
app.get('/admin', (_req, res) => res.sendFile(join(__dirname, 'public', 'admin.html')));

// ---- Public API ----
app.get('/api/menu', (_req, res) => res.json({ ok: true, menu: getMenu() }));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Temporary email diagnostics (remove once email is confirmed working).
// Admin-gated. Reports which SMTP vars are set and whether Gmail accepts the login.
app.get('/api/diag', async (req, res) => {
  const key = req.get('x-admin-key') || req.query.key || '';
  if (key !== ADMIN_KEY) return res.status(401).json({ ok: false, error: 'Unauthorised' });
  const mailer = await verifyMailer();
  res.json({ ok: true, build: 'diag-1', node: process.version, mailer });
});

app.post('/api/orders', (req, res) => {
  try {
    const b = req.body || {};
    const c = b.customer || {};
    const name = String(c.name || '').trim();
    const email = String(c.email || '').trim();
    const phone = String(c.phone || '').trim();
    const notes = String(c.notes || '').trim().slice(0, 1000);
    const fulfilment = b.fulfilment === 'delivery' ? 'delivery' : 'collection';
    const date = String(b.date || '').trim();
    const payment = String(b.payment || '').trim();

    // --- Validate customer ---
    if (!name || !email || !phone || !date) return bad(res, 'Please fill in your name, email, phone and required date.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad(res, 'Please enter a valid email address.');
    if (!['cash', 'bank', 'card', 'paypal'].includes(payment)) return bad(res, 'Please choose a payment method.');

    // --- Validate + price items against the server menu (never trust client prices) ---
    if (!Array.isArray(b.items) || b.items.length === 0) return bad(res, 'Please add at least one item to your order.');
    const items = [];
    let subtotal = 0;
    for (const raw of b.items) {
      const menuItem = getMenuItem(String(raw?.id || ''));
      if (!menuItem) return bad(res, `Sorry, one of the items is no longer available.`);
      const qty = Math.floor(Number(raw?.qty));
      if (!Number.isFinite(qty) || qty < 1 || qty > 50) return bad(res, 'Please choose a valid quantity (1–50) for each item.');
      items.push({ item_id: menuItem.id, name: menuItem.name, price: menuItem.price, qty });
      subtotal += menuItem.price * qty;
    }
    subtotal = round2(subtotal);

    // --- Fulfilment + delivery rules ---
    let address = null, postcode = null, delivery_fee = 0;
    if (fulfilment === 'delivery') {
      const a = b.address || {};
      address = String(a.line || '').trim();
      postcode = String(a.postcode || '').trim();
      if (!address || !postcode) return bad(res, 'Please enter your Didcot delivery address and postcode.');
      if (!DELIVERY_POSTCODE.test(postcode.replace(/\s/g, ''))) {
        return bad(res, "Sorry, we only deliver within Didcot (OX11). You're welcome to collect from home instead.");
      }
      delivery_fee = subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
    }
    const total = round2(subtotal + delivery_fee);

    // --- Persist (retry ref on the very unlikely collision) ---
    const order = {
      created_at: new Date().toISOString(),
      name, email, phone, notes, fulfilment, address, postcode,
      required_date: date, payment, subtotal, delivery_fee, total
    };
    let ref, cancel_token;
    for (let attempt = 0; attempt < 6; attempt++) {
      ref = genRef();
      try { cancel_token = createOrder({ ...order, ref }, items); break; }
      catch (e) { if (attempt === 5) throw e; }
    }

    const base = baseUrl(req);
    sendOrderPlaced({ ...order, ref, cancel_token, items }, base).catch(() => {});
    notifyNewOrder({ ...order, ref, items }).catch(() => {});
    console.log(`[order] ${ref} · ${fulfilment} · £${total.toFixed(2)} · ${payment} · ${name}`);

    res.json({ ok: true, ref, subtotal, delivery_fee, total, payment, fulfilment });
  } catch (e) {
    console.error('[order error]', e);
    res.status(500).json({ ok: false, error: 'Something went wrong on our side. Please try again or contact us.' });
  }
});

// ---- Customer self-service: view + cancel one's own order (token-gated) ----
// The cancel token is a per-order secret, only ever shared in that order's email.
function loadTokenedOrder(req) {
  const token = String(req.query.token || req.body?.token || '');
  const order = getOrder(req.params.ref);
  if (!order || !order.cancel_token || !token || order.cancel_token !== token) return null;
  return order;
}

// Safe, read-only view for the cancel page (no other customers' data, no token).
function publicOrderView(o) {
  return {
    ref: o.ref, name: String(o.name || '').split(' ')[0], status: o.status,
    fulfilment: o.fulfilment, address: o.address, postcode: o.postcode,
    required_date: o.required_date, payment: o.payment,
    subtotal: o.subtotal, delivery_fee: o.delivery_fee, total: o.total,
    items: o.items, created_at: o.created_at,
    cancellable: o.status === 'new'
  };
}

app.get('/api/orders/:ref', (req, res) => {
  const order = loadTokenedOrder(req);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found or link is invalid.' });
  res.json({ ok: true, order: publicOrderView(order) });
});

app.post('/api/orders/:ref/cancel', (req, res) => {
  const order = loadTokenedOrder(req);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found or link is invalid.' });
  if (order.status !== 'new') {
    return bad(res, "This order can no longer be cancelled online. Please contact us at BakedbyPrii@gmail.com or +44 7732 262999 and we'll help.");
  }
  setOrderStatus(order.ref, 'cancelled');
  const updated = getOrder(order.ref);
  sendStatusEmail(updated, 'cancelled', baseUrl(req)).catch(() => {});
  notifyAdminCancelled(updated).catch(() => {});
  console.log(`[cancel] ${order.ref} cancelled by customer`);
  res.json({ ok: true });
});

// ---- Admin API (header: x-admin-key) ----
function requireAdmin(req, res, next) {
  if ((req.get('x-admin-key') || '') !== ADMIN_KEY) return res.status(401).json({ ok: false, error: 'Unauthorised' });
  next();
}

app.get('/api/admin/orders', requireAdmin, (_req, res) => {
  const orders = listOrders();
  const stats = {
    total: orders.length,
    new: orders.filter(o => o.status === 'new').length,
    revenue: round2(orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0))
  };
  res.json({ ok: true, orders, stats });
});

app.patch('/api/admin/orders/:ref', requireAdmin, (req, res) => {
  const status = String(req.body?.status || '');
  if (!STATUSES.includes(status)) return bad(res, 'Invalid status.');
  const existing = getOrder(req.params.ref);
  if (!existing) return res.status(404).json({ ok: false, error: 'Order not found.' });
  if (existing.status === status) return res.json({ ok: true, unchanged: true }); // no-op, no email
  setOrderStatus(req.params.ref, status);
  const updated = getOrder(req.params.ref);
  sendStatusEmail(updated, status, baseUrl(req)).catch(() => {}); // confirmed / completed / cancelled
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n  🧁  bakedbyPrii running`);
  console.log(`      Storefront →  http://localhost:${PORT}`);
  console.log(`      Admin      →  http://localhost:${PORT}/admin   (key: ${ADMIN_KEY})\n`);
});

// ---- helpers ----
// Absolute site origin for links inside emails. Prefers PUBLIC_URL (set this in
// production so links point at your real domain), else derives from the request.
function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  const proto = req.get('x-forwarded-proto') || req.protocol;
  return `${proto}://${req.get('host')}`;
}
function bad(res, error) { return res.status(400).json({ ok: false, error }); }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function genRef() {
  const s = Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, '0');
  return 'BBP-' + s.padEnd(4, '0');
}
