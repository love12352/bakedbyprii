# bakedbyPrii — React frontend

A React + TypeScript storefront, checkout, customer cancel flow, and admin
dashboard for bakedbyPrii. It is a **frontend only** — all pricing, validation
and auth stay in the Node API (`../server.js`). Nothing outside this folder was
modified to build it.

## Why this exists

The menu used to live in three places that had already drifted apart: the
database seed in `lib/db.js`, 38 hardcoded cards in `public/index.html`, and a
`CHECKOUT_ITEMS` array in the same file. The database said
`"Chocolate Chip Cookie"`; the checkout array said `"Chocolate Chip"`.
Meanwhile `GET /api/menu` existed and was never called — the old storefront made
exactly one API call in 1100 lines.

This app fetches the menu and renders everything from it, so the database is the
single source of truth. Change a price in `lib/db.js` and the storefront follows
with no frontend change.

## Run it

Two processes, both from the repo root:

```bash
# Terminal 1 — the Node API (port 3000)
npm install && npm start

# Terminal 2 — the React app (port 5173)
cd react && npm install && npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api/*` to the Node server on 3000,
so there is no CORS setup and `server.js` is never touched.

Admin: <http://localhost:5173/admin> — dev key `bakedbyprii-admin` (matches the
Node app's default `ADMIN_KEY`).

## Test

```bash
cd react
npm test    # Vitest + React Testing Library + MSW — 67 tests
npm run build   # tsc -b (typecheck) + production build
```

Run `npm run build` before trusting a green test run: Vitest strips types with
esbuild **without** type-checking them, so tests can pass while the build is
broken.

## What lives where

| Path | Responsibility |
|---|---|
| `src/api/client.ts` | The only file that calls `fetch`. Typed, one function per endpoint. |
| `src/cart/` | Cart reducer + context. Holds `{id: qty}` — **never prices**. |
| `src/content/` | Marketing copy, bespoke items, category themes, legal text. |
| `src/routes/` | One file per page. |
| `src/components/` | Presentational pieces. |
| `src/useMenu.ts` | Fetches and groups the menu. |
| `src/money.ts` | `gbp()` formatting and the delivery-fee rule (display only). |

## Rules that matter

**Prices never come from the client.** The cart carries quantities. The checkout
POSTs only `{id, qty}` per item; the server reprices every order from its own
database and its total is authoritative. Anything this app displays is a
convenience for the customer.

**`fetch` only appears in `src/api/client.ts`.** Everything else goes through it.

**The API returns `{ok:false}` with HTTP 200 on some paths**, so the client
treats `body.ok === false` as an error regardless of status.

## Known boundaries

- **Menu prose lives here, not in the database.** `/api/menu` returns only facts
  (name, price, allergens), so descriptions and tags sit in
  `src/content/menuContent.ts`, keyed by item id, and are merged at render.
  Facts win. A menu item added to the database later renders with no description
  rather than breaking.
- **The Custom Orders form is a demo.** There is no enquiry endpoint, so it
  submits nowhere and says so, pointing at the real email address.
- **The order confirmation cannot deep-link.** `POST /api/orders` returns the ref
  and totals but not the `cancel_token` — that only reaches the customer by
  email, and `GET /api/orders/:ref` requires it. So `/order/:ref` renders from
  router state and falls back to a ref-only message on reload.
- **Admin auth is a shared key**, not a session — the existing API's design. It
  lives in `sessionStorage` and is sent as `x-admin-key`.
- **The double-submit guards** in `Checkout.tsx` and `Cancel.tsx` are not covered
  by tests: jsdom flushes click events synchronously, so the `disabled` prop
  blocks the second click and the tests pass with or without the guards. They
  exist for real browsers. See the comments above those tests.

## Production

Express does not serve this build — that would mean editing `server.js`, which
this project deliberately does not do. In development, Vite and Node run side by
side. Deployment is an open decision.
