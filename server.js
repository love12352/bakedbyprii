// bakedbyPri backend — serves the storefront + admin, and handles orders.
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMenu, getMenuItem, createOrder, listOrders, setOrderStatus } from './lib/db.js';
import { notifyNewOrder } from './lib/mailer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- Config (override with environment variables) ----
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'bakedbypri-admin';   // CHANGE THIS before going live
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
    let ref;
    for (let attempt = 0; attempt < 6; attempt++) {
      ref = genRef();
      try { createOrder({ ...order, ref }, items); break; }
      catch (e) { if (attempt === 5) throw e; }
    }

    notifyNewOrder({ ...order, ref, items }).catch(() => {});
    console.log(`[order] ${ref} · ${fulfilment} · £${total.toFixed(2)} · ${payment} · ${name}`);

    res.json({ ok: true, ref, subtotal, delivery_fee, total, payment, fulfilment });
  } catch (e) {
    console.error('[order error]', e);
    res.status(500).json({ ok: false, error: 'Something went wrong on our side. Please try again or contact us.' });
  }
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
  const updated = setOrderStatus(req.params.ref, status);
  if (!updated) return res.status(404).json({ ok: false, error: 'Order not found.' });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n  🧁  bakedbyPri running`);
  console.log(`      Storefront →  http://localhost:${PORT}`);
  console.log(`      Admin      →  http://localhost:${PORT}/admin   (key: ${ADMIN_KEY})\n`);
});

// ---- helpers ----
function bad(res, error) { return res.status(400).json({ ok: false, error }); }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function genRef() {
  const s = Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, '0');
  return 'BBP-' + s.padEnd(4, '0');
}
