# bakedbyPrii 🧁

A home-bakery website **and** order backend for a Didcot-based business.
Single-page storefront, a real order system with a SQLite database, and an admin dashboard.

- **Storefront** — menu, custom orders, reviews, UK legal pages, and a full checkout
  (collection from home, or delivery within Didcot/OX11; payment by cash, bank transfer, card link or PayPal).
- **Backend** — Express API that validates and prices orders server-side and stores them in a database.
- **Admin** — a private dashboard to watch orders come in and move them through New → Confirmed → Completed.

## Requirements

- **Node.js 22 or newer** (uses Node's built-in SQLite — no database to install).

Check your version: `node --version`

## Run it

```bash
npm install      # installs Express (one dependency)
npm start
```

Then open:

- **Storefront:** http://localhost:3000
- **Admin dashboard:** http://localhost:3000/admin

The admin key defaults to `bakedbyprii-admin` — **change it** (see Configuration).

That's it. Place a test order on the storefront and watch it appear in the admin dashboard.

## How it works

```
server.js          Express app — serves the site and the API
lib/db.js          SQLite database (orders, order_items, menu) — auto-created in /data
lib/mailer.js      Optional email notifications (off by default)
public/index.html  The storefront
public/admin.html  The orders dashboard
data/bakery.db     Created automatically on first run (git-ignored)
```

**API**

| Method | Route | Notes |
|---|---|---|
| `GET`  | `/api/menu` | Current menu |
| `POST` | `/api/orders` | Place an order (validated + priced on the server) |
| `GET`  | `/api/admin/orders` | List orders + stats (needs `x-admin-key` header) |
| `PATCH`| `/api/admin/orders/:ref` | Update an order's status (needs `x-admin-key`) |

Prices and the delivery rules are enforced on the server, so totals can't be tampered with from the browser.

## Configuration

Copy `.env.example` to `.env` and edit (all optional):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Server port |
| `ADMIN_KEY` | `bakedbyprii-admin` | **Change this** — the key for `/admin` |
| `DELIVERY_FEE` | `2.50` | Didcot delivery charge |
| `FREE_DELIVERY_OVER` | `20` | Free delivery over this order value |
| `SMTP_*`, `ORDER_NOTIFY_TO` | — | Optional email alerts for new orders (`npm install nodemailer`) |

The menu lives in `lib/db.js` (`MENU_SEED`) and is seeded into the database on first run.
To change prices/items later, edit the `menu` table or reset by deleting `data/bakery.db`.

## Taking real payments (optional, for go-live)

This page never collects card numbers itself (that wouldn't be secure). Today the checkout records the
customer's chosen method and shows them how to pay:

- **Cash** on collection/delivery
- **Bank transfer** — set your details in `public/index.html` (`BANK = { name, sort, acc }`)
- **Card / PayPal** — paste a secure payment link (`CARD_LINK`, `PAYPAL_LINK` in `public/index.html`)

For automatic card payments, create a free **Stripe** or **SumUp** account and either drop in a Payment Link,
or wire `/api/orders` to create a Stripe Checkout Session (a small, well-documented add-on).

## Before you go live — details to fill in

Search `public/index.html` for `[` to find placeholders, and set:

- Business identity (sole trader / Ltd + company number), registered/trading address
- Contact email & phone
- Local authority you're food-registered with, and your FSA hygiene rating
- Bank details and any card/PayPal payment links
- A new `ADMIN_KEY`

The UK legal pages (Allergens, Privacy, Cookies, Terms, Delivery & Returns) are drafted but should be
reviewed by a professional before publishing.
