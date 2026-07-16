# Design — React frontend for bakedbyPrii (2026-07-16)

## Goal

Build a React storefront, admin dashboard, and customer cancel flow in a new
`react/` folder, served by Vite in development and talking to the existing
Node/Express JSON API on port 3000.

The React app is a **frontend only**. It adds no business rules. Pricing,
validation, and authorisation stay in `server.js`, exactly as they are today.

## Why the Node API, not Flask

The Node API is the only one already complete for this scope. Both backends
serve menu, order creation, order view, and cancel. Only Node exposes an admin
status change:

| Endpoint | Node | Flask |
|---|---|---|
| `GET /api/menu` | yes | yes |
| `POST /api/orders` | yes | yes |
| `GET /api/orders/:ref` | yes | yes |
| `POST /api/orders/:ref/cancel` | yes | yes |
| `GET /api/admin/orders` | yes | yes |
| `PATCH /api/admin/orders/:ref` | **yes** | **no — form POST only** |

Flask changes order status through a session-based HTML form
(`/admin/orders/<ref>/status`). Building React against Flask would mean writing
backend endpoints first, and designing an API and its client at the same time
with neither to check against. The Node API already answers a browser JS client
in production, so React replaces the view layer against a proven contract.

Two further reasons: `render.yaml` points at the Node app, so this targets the
backend actually deployed; and leaving `python/` alone preserves that branch's
documented premise — "the whole stack is Python, essentially no JavaScript".

## The problem this actually solves

The menu exists in three places, and they have already drifted.

| Copy | Location | Role |
|---|---|---|
| `MENU_SEED` | `lib/db.js` | The database. Authoritative. Prices every order. |
| 38 `menu-card` divs | `public/index.html` | What customers browse |
| `CHECKOUT_ITEMS` | `public/index.html` | The checkout steppers |

The database says `"Oreo Cookie"` and `"Chocolate Chip Cookie"`. The checkout
array says `"Oreo"` and `"Chocolate Chip"`. `DELIVERY_FEE` and
`FREE_DELIVERY_OVER` are hardcoded in the page beside the server's own
env-driven copies.

`GET /api/menu` exists and is never called. The current storefront makes exactly
one API call in 1100 lines: `POST /api/orders`.

React fetches `/api/menu` and renders both the browse page and the checkout
steppers from it. Three copies collapse to one. This is the payoff; a rewrite
that kept the hardcoded arrays would not be worth doing.

## Scope

**In:** storefront (home, menu, custom orders, reviews, legal), checkout,
order confirmation, token-gated customer cancel, admin dashboard with status
changes.

**Out:** production hosting; any change to `server.js`, `lib/`, `public/`, or
`python/`; a custom-orders enquiry API; payment processing.

## Placement

Branch `react-frontend`, cut from `master`. The `react/` folder sits beside
`server.js` at the repository root.

`python/` is not present on `master` and therefore cannot be affected. Its
source remains on the `python-port` branch.

```
Bakery/            (branch: react-frontend)
├─ server.js       ← untouched
├─ lib/            ← untouched
├─ public/         ← untouched, still the live frontend
└─ react/          ← new
```

## Stack

| Choice | Decision | Reason |
|---|---|---|
| Build tool | Vite | Fast, minimal config, standard for React |
| Language | TypeScript | Types on the API response catch exactly the drift this codebase already suffers |
| Routing | React Router | Real URLs; `/cancel` arrives from email links |
| Animation | GSAP via npm | Parity with the hero's existing theme transitions |
| Server calls | `fetch` in a typed API module | No client needed for six endpoints |
| Tests | Vitest, React Testing Library, MSW | Standard for Vite; MSW mocks the API |

### Dev proxy, not CORS

Vite serves on 5173 and proxies `/api/*` to `localhost:3000`. The browser sees
one origin, so no CORS middleware is needed and `server.js` stays untouched.

Consequence: Express will not serve the React build, because that would require
editing `server.js`. In development, Vite and Node run side by side. Production
hosting is deferred.

## Routes

The current SPA is one page of modal "sheets" with no URLs. React Router gives
real addresses, which `/cancel` and `/admin` need. The sheet *appearance* — a
panel over the hero backdrop — is kept, driven by routes.

| Route | Page |
|---|---|
| `/` | Hero, rotating category themes, category cards |
| `/menu` | Full menu, grouped by category, with quantity steppers |
| `/custom` | Bespoke enquiry (static; see below) |
| `/reviews` | Reviews |
| `/checkout` | Cart, customer details, fulfilment, payment |
| `/order/:ref` | Confirmation after placing an order (see below) |
| `/cancel?ref=&token=` | Token-gated customer view and self-cancel |
| `/admin` | Key entry, then orders dashboard |
| `/legal/:doc` | `allergens` \| `delivery` \| `privacy` \| `terms` |

### Confirmation cannot deep-link

`POST /api/orders` returns `ref`, `subtotal`, `delivery_fee`, `total`, `payment`,
and `fulfilment` — but **not** `cancel_token`. The token reaches the customer
only by email. `GET /api/orders/:ref` requires it.

So `/order/:ref` renders from the POST response handed over in router state. It
does not fetch. On a hard reload, that state is gone and no fetch can replace
it, so the page falls back to "Order `ref` placed — the details are in your
email" rather than erroring. This mirrors both existing apps, where confirmation
is rendered straight from the create-order response.

## State

| State | Where it lives | Notes |
|---|---|---|
| Menu | Fetched from `GET /api/menu` | Single source of truth |
| Cart | React state, mirrored to `localStorage` | Holds `{id: qty}` only — **never prices** |
| Admin key | `sessionStorage` | Sent as `x-admin-key`; cleared on 401 |
| Cancel token | URL query only | Never persisted |

The cart carries quantities, not money. The server reprices every order from the
database on `POST /api/orders`. This rule is enforced identically in both
existing backends and React must not weaken it. Any price React displays is a
convenience for the customer; the server's total is the real one.

## API contract

Read from `server.js` at commit `master`. React consumes this exactly as-is.

```
GET    /api/menu
       → { ok, menu: [{ id, category, name, price, allergens }] }

POST   /api/orders
       body { customer: { name, email, phone, notes },
              items: [{ id, qty }],
              fulfilment: 'collection' | 'delivery',
              date, payment: 'cash'|'bank'|'card'|'paypal',
              address: { line, postcode } }
       → 200 { ok, ref, subtotal, delivery_fee, total, payment, fulfilment }
       → 400 { ok: false, error }   → 500 { ok: false, error }

GET    /api/orders/:ref?token=
       → 200 { ok, order }  → 404 { ok: false, error }

POST   /api/orders/:ref/cancel?token=
       → 200 { ok }  → 400 (not cancellable)  → 404 (bad token)

GET    /api/admin/orders          header x-admin-key
       → 200 { ok, orders, stats: { total, new, revenue } }  → 401

PATCH  /api/admin/orders/:ref     header x-admin-key
       body { status: 'new'|'confirmed'|'completed'|'cancelled' }
       → 200 { ok } | { ok, unchanged: true }  → 400  → 404  → 401
```

`order` from `/api/orders/:ref` is the safe projection: `ref`, first name only,
`status`, `fulfilment`, `address`, `postcode`, `required_date`, `payment`,
`subtotal`, `delivery_fee`, `total`, `items`, `created_at`, `cancellable`. It
omits email, phone, and the token.

Rules the server enforces and React should mirror in its client-side hints:
quantity 1–50; delivery only within `OX11`; delivery £2.50, free over £20;
payment must be one of the four listed.

## The content gap

`GET /api/menu` returns `id, category, name, price, allergens`. The hardcoded
cards carry **descriptions and tags** ("Made to order", flavour copy) that the
API does not expose. React cannot rebuild the browse page from the API alone.

Resolution: a React content map keyed by item id supplies description and tags;
name, price, and allergens come from the API and win on conflict. **Facts live
in the database, prose lives in the frontend.**

The alternative — adding `description` and `tags` columns to `lib/db.js` and
`/api/menu` — is cleaner but edits Node files, which this design excludes. If
that constraint is lifted later, the content map is the thing to delete.

### Static content

The Custom Orders form is marked `data-demo`: it submits nowhere and flashes a
success message. No enquiry endpoint exists. React keeps this behaviour rather
than inventing an API.

The four bespoke items (Celebration Cakes from £45, Wedding Tiers from £180,
Number/Letter Cupcakes from £35, Dietary & Vegan on request) are not in the
database. They are enquiry-only and stay static.

## Brand

Carried over from `public/index.html`.

- Accent `#fbcfe8` on ink `#2a0d18`; text white; muted `rgba(255,255,255,.7)`
- Glass: `rgba(255,255,255,.05)` on `rgba(255,255,255,.1)` borders
- Fonts: Galada (headings), Inter (body), Manrope, Outfit
- Radial gradient background, themed per category and animated between them:

| Theme | inner | mid | outer |
|---|---|---|---|
| cakes | `#b03a5b` | `#5e1f33` | `#1a0a10` |
| cookies | `#a86b32` | `#5a3417` | `#170d05` |
| cupcakes | `#7b4fa8` | `#3d2459` | `#100817` |

Contact: BakedbyPrii@gmail.com · +44 7732 262999

## Error handling

Fetching the menu introduces a failure mode the static page never had: the
storefront can now fail to load its own content. That drives most of this list.

| Case | Behaviour |
|---|---|
| Menu fetch fails | Skeleton, then an error panel with Retry |
| Menu loads empty | "Menu unavailable" — never an empty page with a live checkout |
| `POST /api/orders` 400 | Show `error` inline, keep the cart and typed values |
| `POST /api/orders` 500 | Generic apology, keep the cart, offer retry |
| Admin 401 | Clear stored key, return to key entry, "Incorrect admin key" |
| Cancel 404 | "This link is invalid or has expired" |
| Cancel 400 | Show the server's message; order is no longer cancellable |
| Network failure | Distinguish from an API error; offer retry |
| Confirmation reloaded | Router state lost; show ref only, no fetch attempt |

## Component boundaries

Each unit has one purpose and is testable alone.

- `api/` — typed functions, one per endpoint. The only place `fetch` appears.
- `cart/` — reducer over `{id: qty}` plus `localStorage`. Pure; no network.
- `content/` — the item id → description/tags map. Data only.
- `components/` — presentational; take props, hold no server state.
- `routes/` — one file per route; compose the above.

The rule: nothing outside `api/` knows the endpoints exist, and nothing inside
`cart/` knows prices.

## Testing

- **Unit (Vitest):** cart reducer — add, remove, cap at 50, drop at 0, persist
  and rehydrate; delivery-fee display logic; form validation.
- **Component (RTL + MSW):** menu renders from a mocked `/api/menu`; error and
  empty states; checkout submits the right payload shape; admin 401 clears key.
- **Manual E2E:** against the real Node server on 3000 — place an order, see the
  ref, cancel via a real emailed token, change status in admin.

Nothing is claimed to work until it has been driven end-to-end against the real
server, not only against mocks.

## Verification plan

1. `npm run dev` in `react/` and `npm start` at the root, together.
2. Menu renders from the database — confirm by editing a price in `lib/db.js`,
   restarting Node, and seeing React reflect it with no React change.
3. Place an order; confirm the ref and that totals match the server's response.
4. Reject a non-OX11 delivery postcode; confirm the cart survives.
5. Cancel via a real token; confirm 404 on a bad token.
6. Admin: wrong key 401s; a status change persists and fires its email.
7. Confirm `git status` shows no change to `server.js`, `lib/`, or `public/`.

## Constraints honoured

- No file outside `react/` and `docs/` is modified.
- `python/` is untouched and unreachable from this branch.
- The existing vanilla-JS storefront keeps working, unchanged, as the reference
  implementation to compare against.
