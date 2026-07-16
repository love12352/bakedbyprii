# React Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React + TypeScript storefront, checkout, customer cancel flow, and admin dashboard in a new `react/` folder that talks to the existing Node/Express JSON API, without editing any file outside `react/`.

**Architecture:** Vite serves the React app on port 5173 and proxies `/api/*` to the Node server on port 3000, so the browser sees one origin and `server.js` needs no CORS change. The menu is fetched once from `GET /api/menu` and becomes the single source of truth for both browsing and checkout, replacing the three drifted copies in the current codebase. The cart holds `{id: qty}` only; the server reprices every order.

**Tech Stack:** React 18, TypeScript, Vite, React Router 6, GSAP (npm), Vitest, React Testing Library, MSW.

## Global Constraints

- **Node floor:** the API runs on Node `>=22` (`node:sqlite`). The React dev tooling has no Node-version constraint of its own, but the API it proxies to needs Node 22+.
- **No edits outside `react/` and `docs/`:** `server.js`, `lib/`, `public/`, `render.yaml`, and `python/` are never modified. Verify with `git status` before every commit.
- **Prices never come from the client:** the cart carries `{id: qty}`. Any money React shows is a display convenience; the server's returned total is authoritative. Nothing inside `src/cart/` imports prices.
- **`fetch` appears only in `src/api/client.ts`:** no other file calls the network directly.
- **Brand tokens (verbatim):** accent `#fbcfe8`, accent-ink `#2a0d18`, text `#ffffff`, muted `rgba(255,255,255,0.7)`, glass-bg `rgba(255,255,255,0.05)`, glass-border `rgba(255,255,255,0.1)`. Heading font `Galada`, body font `Inter`. Category themes — cakes `#b03a5b/#5e1f33/#1a0a10`, cookies `#a86b32/#5a3417/#170d05`, cupcakes `#7b4fa8/#3d2459/#100817`.
- **Contact (verbatim):** `BakedbyPrii@gmail.com` · `+44 7732 262999`.
- **Order rules the server enforces (mirror in client hints only):** quantity 1–50; delivery only within `OX11`; delivery fee £2.50, free over £20; payment ∈ `cash|bank|card|paypal`.
- **Branch:** all work on `react-frontend` (already cut from `master`).
- **Commit style:** each task ends with a commit. Conventional prefixes (`chore:`, `feat:`, `test:`).

---

## File Structure

```
react/
├─ package.json
├─ tsconfig.json
├─ tsconfig.node.json
├─ vite.config.ts             # React plugin + dev proxy + vitest config
├─ index.html
├─ .gitignore
└─ src/
   ├─ main.tsx                # mounts <App/> in BrowserRouter
   ├─ App.tsx                 # <Routes> + <Layout> shell
   ├─ types.ts                # MenuItem, PublicOrder, AdminOrder, ApiResult…
   ├─ money.ts                # gbp() formatter, delivery-fee helper
   ├─ api/
   │  └─ client.ts            # the ONLY file that calls fetch
   ├─ cart/
   │  ├─ cartReducer.ts       # pure reducer over {id:qty}
   │  └─ CartContext.tsx      # provider + localStorage mirror
   ├─ content/
   │  ├─ menuContent.ts       # id → {description, tags[]}
   │  ├─ bespoke.ts           # static enquiry-only items
   │  └─ theme.ts             # category → gradient + hero
   ├─ components/
   │  ├─ Layout.tsx           # header nav, footer, gradient background
   │  ├─ Sheet.tsx            # panel-over-backdrop wrapper
   │  ├─ MenuCard.tsx         # one menu item + stepper
   │  └─ QtyStepper.tsx       # − qty + control
   ├─ routes/
   │  ├─ Home.tsx
   │  ├─ Menu.tsx
   │  ├─ Custom.tsx
   │  ├─ Reviews.tsx
   │  ├─ Checkout.tsx
   │  ├─ OrderConfirmation.tsx
   │  ├─ Cancel.tsx
   │  ├─ Admin.tsx
   │  └─ Legal.tsx
   ├─ styles/
   │  └─ global.css
   └─ test/
      ├─ setup.ts
      └─ mocks/handlers.ts    # MSW request handlers
```

---

## Task 1: Scaffold the Vite + TypeScript app with the dev proxy

**Files:**
- Create: `react/package.json`, `react/tsconfig.json`, `react/tsconfig.node.json`, `react/vite.config.ts`, `react/index.html`, `react/.gitignore`, `react/src/main.tsx`, `react/src/App.tsx`, `react/src/styles/global.css`

**Interfaces:**
- Produces: a running dev server on 5173 that proxies `/api/*` to `localhost:3000`.

- [ ] **Step 1: Create `react/package.json`**

```json
{
  "name": "bakedbyprii-react",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "gsap": "^3.12.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^25.0.0",
    "msw": "^2.4.3",
    "typescript": "^5.5.4",
    "vite": "^5.4.3",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `react/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "useDefineForClassFields": true,
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `react/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `react/vite.config.ts`** (proxy + vitest in one config)

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Step 5: Create `react/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Galada&display=swap" rel="stylesheet" />
    <title>bakedbyPrii</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `react/.gitignore`**

```
node_modules
dist
*.local
```

- [ ] **Step 7: Create `react/src/styles/global.css`** (brand tokens + reset; expanded in Task 4)

```css
:root {
  --text-color: #ffffff;
  --muted-color: rgba(255, 255, 255, 0.7);
  --glass-bg: rgba(255, 255, 255, 0.05);
  --glass-border: rgba(255, 255, 255, 0.1);
  --accent: #fbcfe8;
  --accent-ink: #2a0d18;
  --font-main: 'Inter', sans-serif;
  --font-heading: 'Galada', cursive;
  --bg-inner: #b03a5b;
  --bg-mid: #5e1f33;
  --bg-outer: #1a0a10;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--font-main);
  color: var(--text-color);
  min-height: 100vh;
  background: radial-gradient(circle at center, var(--bg-inner) 0%, var(--bg-mid) 50%, var(--bg-outer) 100%);
  background-attachment: fixed;
}
a { color: inherit; }
```

- [ ] **Step 8: Create `react/src/App.tsx`** (placeholder, replaced in Task 4)

```tsx
export default function App() {
  return <h1 style={{ fontFamily: 'var(--font-heading)', padding: '2rem' }}>bakedbyPrii</h1>;
}
```

- [ ] **Step 9: Create `react/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 10: Install and boot**

Run: `cd react && npm install`
Then: `npm run dev`
Expected: Vite prints `Local: http://localhost:5173/`. Opening it shows the "bakedbyPrii" heading on the pink radial background.

- [ ] **Step 11: Verify the proxy reaches Node**

In one terminal at the repo root: `npm install && npm start` (Node server on 3000).
In the browser at `http://localhost:5173`, open devtools console and run:
`fetch('/api/health').then(r => r.json()).then(console.log)`
Expected: `{ ok: true, time: "…" }` — proving the proxy forwards to Node.

- [ ] **Step 12: Commit**

```bash
git add react/
git commit -m "chore: scaffold Vite + TS React app with dev proxy to Node API"
```

---

## Task 2: Types and the API client

**Files:**
- Create: `react/src/types.ts`, `react/src/api/client.ts`, `react/src/test/setup.ts`, `react/src/test/mocks/handlers.ts`
- Test: `react/src/api/client.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `MenuItem { id, category, name, price, allergens }`; `OrderItemInput { id, qty }`; `CreateOrderBody`; `CreateOrderResult { ref, subtotal, delivery_fee, total, payment, fulfilment }`; `PublicOrder`; `AdminOrder`; `AdminStats { total, new, revenue }`; `Status = 'new'|'confirmed'|'completed'|'cancelled'`.
  - `client.ts`: `getMenu(): Promise<MenuItem[]>`; `createOrder(body: CreateOrderBody): Promise<CreateOrderResult>`; `getOrder(ref: string, token: string): Promise<PublicOrder>`; `cancelOrder(ref: string, token: string): Promise<void>`; `adminListOrders(key: string): Promise<{ orders: AdminOrder[]; stats: AdminStats }>`; `adminSetStatus(ref: string, status: Status, key: string): Promise<void>`. All reject with `ApiError { message, status }` on `{ok:false}` or non-2xx.

- [ ] **Step 1: Create `react/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/handlers';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 2: Create `react/src/types.ts`**

```ts
export type Status = 'new' | 'confirmed' | 'completed' | 'cancelled';
export type Payment = 'cash' | 'bank' | 'card' | 'paypal';
export type Fulfilment = 'collection' | 'delivery';

export interface MenuItem {
  id: string;
  category: string;
  name: string;
  price: number;
  allergens: string;
}

export interface OrderItemInput { id: string; qty: number; }

export interface CreateOrderBody {
  customer: { name: string; email: string; phone: string; notes: string };
  items: OrderItemInput[];
  fulfilment: Fulfilment;
  date: string;
  payment: Payment;
  address: { line: string; postcode: string };
}

export interface CreateOrderResult {
  ref: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment: Payment;
  fulfilment: Fulfilment;
}

export interface OrderLine { item_id: string; name: string; price: number; qty: number; }

export interface PublicOrder {
  ref: string; name: string; status: Status;
  fulfilment: Fulfilment; address: string | null; postcode: string | null;
  required_date: string; payment: Payment;
  subtotal: number; delivery_fee: number; total: number;
  items: OrderLine[]; created_at: string; cancellable: boolean;
}

export interface AdminOrder {
  ref: string; created_at: string; name: string; email: string; phone: string;
  notes: string | null; fulfilment: Fulfilment; address: string | null; postcode: string | null;
  required_date: string; payment: Payment;
  subtotal: number; delivery_fee: number; total: number; status: Status;
  items: OrderLine[];
}

export interface AdminStats { total: number; new: number; revenue: number; }

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
```

- [ ] **Step 3: Create `react/src/test/mocks/handlers.ts`**

```ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const menuFixture = [
  { id: 'ck-chocchip', category: 'Cookies', name: 'Chocolate Chip Cookie', price: 2.75, allergens: 'Gluten, Egg, Milk, Soya' },
  { id: 'cake-vanilla', category: 'Cakes', name: 'Vanilla Buttercream Cake', price: 35.0, allergens: 'Gluten, Egg, Milk' },
];

export const handlers = [
  http.get('/api/menu', () => HttpResponse.json({ ok: true, menu: menuFixture })),
  http.post('/api/orders', () =>
    HttpResponse.json({ ok: true, ref: 'BBP-TEST', subtotal: 2.75, delivery_fee: 0, total: 2.75, payment: 'cash', fulfilment: 'collection' })),
];

export const server = setupServer(...handlers);
```

- [ ] **Step 4: Write the failing test `react/src/api/client.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server, menuFixture } from '../test/mocks/handlers';
import { getMenu, createOrder, adminSetStatus } from './client';
import { ApiError } from '../types';

describe('api client', () => {
  it('getMenu returns the menu array', async () => {
    const menu = await getMenu();
    expect(menu).toEqual(menuFixture);
  });

  it('createOrder returns the pricing result', async () => {
    const res = await createOrder({
      customer: { name: 'A', email: 'a@b.co', phone: '1', notes: '' },
      items: [{ id: 'ck-chocchip', qty: 1 }],
      fulfilment: 'collection', date: '2026-08-01', payment: 'cash',
      address: { line: '', postcode: '' },
    });
    expect(res.ref).toBe('BBP-TEST');
    expect(res.total).toBe(2.75);
  });

  it('rejects with ApiError carrying the server message on {ok:false}', async () => {
    server.use(http.post('/api/orders', () =>
      HttpResponse.json({ ok: false, error: 'Please choose a payment method.' }, { status: 400 })));
    await expect(createOrder({
      customer: { name: 'A', email: 'a@b.co', phone: '1', notes: '' },
      items: [{ id: 'x', qty: 1 }],
      fulfilment: 'collection', date: '2026-08-01', payment: 'cash',
      address: { line: '', postcode: '' },
    })).rejects.toMatchObject({ message: 'Please choose a payment method.', status: 400 } satisfies Partial<ApiError>);
  });

  it('adminSetStatus sends the x-admin-key header', async () => {
    let seenKey = '';
    server.use(http.patch('/api/admin/orders/:ref', ({ request }) => {
      seenKey = request.headers.get('x-admin-key') || '';
      return HttpResponse.json({ ok: true });
    }));
    await adminSetStatus('BBP-1', 'confirmed', 'secret-key');
    expect(seenKey).toBe('secret-key');
  });
});
```

- [ ] **Step 5: Run it to confirm it fails**

Run: `cd react && npx vitest run src/api/client.test.ts`
Expected: FAIL — `Failed to resolve import "./client"`.

- [ ] **Step 6: Implement `react/src/api/client.ts`**

```ts
import {
  ApiError, type MenuItem, type CreateOrderBody, type CreateOrderResult,
  type PublicOrder, type AdminOrder, type AdminStats, type Status,
} from '../types';

async function request<T>(url: string, init: RequestInit, pick: (body: any) => T): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError('Could not reach the bakery. Check your connection and try again.', 0);
  }
  let body: any = {};
  try { body = await res.json(); } catch { /* empty body */ }
  if (!res.ok || body?.ok === false) {
    throw new ApiError(body?.error || 'Something went wrong. Please try again.', res.status);
  }
  return pick(body);
}

const json = (data: unknown): RequestInit => ({
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});

export function getMenu(): Promise<MenuItem[]> {
  return request('/api/menu', { method: 'GET' }, (b) => b.menu as MenuItem[]);
}

export function createOrder(body: CreateOrderBody): Promise<CreateOrderResult> {
  return request('/api/orders', json(body), (b) => b as CreateOrderResult);
}

export function getOrder(ref: string, token: string): Promise<PublicOrder> {
  return request(`/api/orders/${encodeURIComponent(ref)}?token=${encodeURIComponent(token)}`,
    { method: 'GET' }, (b) => b.order as PublicOrder);
}

export function cancelOrder(ref: string, token: string): Promise<void> {
  return request(`/api/orders/${encodeURIComponent(ref)}/cancel?token=${encodeURIComponent(token)}`,
    { method: 'POST' }, () => undefined);
}

export function adminListOrders(key: string): Promise<{ orders: AdminOrder[]; stats: AdminStats }> {
  return request('/api/admin/orders', { method: 'GET', headers: { 'x-admin-key': key } },
    (b) => ({ orders: b.orders as AdminOrder[], stats: b.stats as AdminStats }));
}

export function adminSetStatus(ref: string, status: Status, key: string): Promise<void> {
  return request(`/api/admin/orders/${encodeURIComponent(ref)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
    body: JSON.stringify({ status }),
  }, () => undefined);
}
```

- [ ] **Step 7: Run the tests to confirm they pass**

Run: `cd react && npx vitest run src/api/client.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add react/src/types.ts react/src/api/ react/src/test/
git commit -m "feat: typed API client with MSW-backed tests"
```

---

## Task 3: Cart reducer and context

**Files:**
- Create: `react/src/cart/cartReducer.ts`, `react/src/cart/CartContext.tsx`
- Test: `react/src/cart/cartReducer.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `cartReducer.ts`: `type Cart = Record<string, number>`; `type CartAction = {type:'inc';id:string} | {type:'dec';id:string} | {type:'set';id:string;qty:number} | {type:'clear'}`; `cartReducer(state: Cart, action: CartAction): Cart`; `cartCount(cart: Cart): number`.
  - `CartContext.tsx`: `CartProvider` component; `useCart(): { cart: Cart; inc; dec; setQty; clear; count }`. Mirrors to `localStorage` key `bbp-cart`.
- The cart stores quantities only. **No prices anywhere in this folder.**

- [ ] **Step 1: Write the failing test `react/src/cart/cartReducer.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { cartReducer, cartCount, type Cart } from './cartReducer';

describe('cartReducer', () => {
  it('inc adds an item at qty 1 then increments', () => {
    let s: Cart = {};
    s = cartReducer(s, { type: 'inc', id: 'a' });
    expect(s).toEqual({ a: 1 });
    s = cartReducer(s, { type: 'inc', id: 'a' });
    expect(s).toEqual({ a: 2 });
  });

  it('caps quantity at 50', () => {
    const s = cartReducer({ a: 50 }, { type: 'inc', id: 'a' });
    expect(s.a).toBe(50);
  });

  it('dec removes the key when it reaches 0', () => {
    const s = cartReducer({ a: 1 }, { type: 'dec', id: 'a' });
    expect(s).toEqual({});
  });

  it('set clamps to 1..50 and removes on 0', () => {
    expect(cartReducer({}, { type: 'set', id: 'a', qty: 99 })).toEqual({ a: 50 });
    expect(cartReducer({}, { type: 'set', id: 'a', qty: 0 })).toEqual({});
    expect(cartReducer({ a: 3 }, { type: 'set', id: 'a', qty: -5 })).toEqual({});
  });

  it('clear empties the cart', () => {
    expect(cartReducer({ a: 2, b: 1 }, { type: 'clear' })).toEqual({});
  });

  it('cartCount sums quantities', () => {
    expect(cartCount({ a: 2, b: 3 })).toBe(5);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd react && npx vitest run src/cart/cartReducer.test.ts`
Expected: FAIL — cannot resolve `./cartReducer`.

- [ ] **Step 3: Implement `react/src/cart/cartReducer.ts`**

```ts
export type Cart = Record<string, number>;
export type CartAction =
  | { type: 'inc'; id: string }
  | { type: 'dec'; id: string }
  | { type: 'set'; id: string; qty: number }
  | { type: 'clear' };

const MAX = 50;
const clampSet = (cart: Cart, id: string, qty: number): Cart => {
  const q = Math.min(MAX, Math.floor(qty));
  const next = { ...cart };
  if (!Number.isFinite(q) || q < 1) delete next[id];
  else next[id] = q;
  return next;
};

export function cartReducer(state: Cart, action: CartAction): Cart {
  switch (action.type) {
    case 'inc': return clampSet(state, action.id, (state[action.id] || 0) + 1);
    case 'dec': return clampSet(state, action.id, (state[action.id] || 0) - 1);
    case 'set': return clampSet(state, action.id, action.qty);
    case 'clear': return {};
  }
}

export function cartCount(cart: Cart): number {
  return Object.values(cart).reduce((s, q) => s + q, 0);
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `cd react && npx vitest run src/cart/cartReducer.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Implement `react/src/cart/CartContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import { cartReducer, cartCount, type Cart } from './cartReducer';

const STORAGE_KEY = 'bbp-cart';

function load(): Cart {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Cart;
  } catch { /* ignore corrupt storage */ }
  return {};
}

interface CartApi {
  cart: Cart;
  count: number;
  inc: (id: string) => void;
  dec: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
}

const CartCtx = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, undefined, load);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch { /* quota */ }
  }, [cart]);

  const api: CartApi = {
    cart,
    count: cartCount(cart),
    inc: (id) => dispatch({ type: 'inc', id }),
    dec: (id) => dispatch({ type: 'dec', id }),
    setQty: (id, qty) => dispatch({ type: 'set', id, qty }),
    clear: () => dispatch({ type: 'clear' }),
  };
  return <CartCtx.Provider value={api}>{children}</CartCtx.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
```

- [ ] **Step 6: Commit**

```bash
git add react/src/cart/
git commit -m "feat: cart reducer (qty-only) and localStorage-backed context"
```

---

## Task 4: Brand styles, layout shell, and routing

**Files:**
- Modify: `react/src/App.tsx`, `react/src/main.tsx`, `react/src/styles/global.css`
- Create: `react/src/components/Layout.tsx`, `react/src/components/Sheet.tsx`, and stub route files `react/src/routes/{Home,Menu,Custom,Reviews,Checkout,OrderConfirmation,Cancel,Admin,Legal}.tsx`
- Test: `react/src/App.test.tsx`

**Interfaces:**
- Consumes: `CartProvider`, `useCart` (Task 3).
- Produces: `Layout` (header nav + footer + gradient background wrapping `<Outlet/>`); `Sheet({ title, eyebrow, children })`; a `BrowserRouter` with every route from the spec mounted. Route stubs each render an identifiable `<h2>` so routing can be tested now and filled in later.

- [ ] **Step 1: Write the failing test `react/src/App.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from './cart/CartContext';
import { AppRoutes } from './App';

function renderAt(path: string) {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </CartProvider>,
  );
}

describe('routing', () => {
  it('renders the home route', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: /bakedbyPrii|Home/i })).toBeInTheDocument();
  });

  it('renders the legal route for a known doc', () => {
    renderAt('/legal/terms');
    expect(screen.getByRole('heading', { name: /terms/i })).toBeInTheDocument();
  });

  it('shows a not-found heading for an unknown route', () => {
    renderAt('/nonsense');
    expect(screen.getByRole('heading', { name: /not found/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd react && npx vitest run src/App.test.tsx`
Expected: FAIL — `AppRoutes` is not exported.

- [ ] **Step 3: Create the nine route stubs** in `react/src/routes/`. Each file follows this shape with its own name (repeat for Home, Menu, Custom, Reviews, Checkout, OrderConfirmation, Cancel, Admin):

`react/src/routes/Home.tsx`
```tsx
export default function Home() {
  return <h2 style={{ fontFamily: 'var(--font-heading)' }}>bakedbyPrii — Home</h2>;
}
```
`react/src/routes/Menu.tsx`
```tsx
export default function Menu() {
  return <h2 style={{ fontFamily: 'var(--font-heading)' }}>Our Menu</h2>;
}
```
`react/src/routes/Custom.tsx`
```tsx
export default function Custom() {
  return <h2 style={{ fontFamily: 'var(--font-heading)' }}>Custom Orders</h2>;
}
```
`react/src/routes/Reviews.tsx`
```tsx
export default function Reviews() {
  return <h2 style={{ fontFamily: 'var(--font-heading)' }}>Reviews</h2>;
}
```
`react/src/routes/Checkout.tsx`
```tsx
export default function Checkout() {
  return <h2 style={{ fontFamily: 'var(--font-heading)' }}>Checkout</h2>;
}
```
`react/src/routes/OrderConfirmation.tsx`
```tsx
export default function OrderConfirmation() {
  return <h2 style={{ fontFamily: 'var(--font-heading)' }}>Order placed</h2>;
}
```
`react/src/routes/Cancel.tsx`
```tsx
export default function Cancel() {
  return <h2 style={{ fontFamily: 'var(--font-heading)' }}>Cancel your order</h2>;
}
```
`react/src/routes/Admin.tsx`
```tsx
export default function Admin() {
  return <h2 style={{ fontFamily: 'var(--font-heading)' }}>Admin</h2>;
}
```

- [ ] **Step 4: Create `react/src/routes/Legal.tsx`** (reads the `:doc` param; real content added in Task 10)

```tsx
import { useParams } from 'react-router-dom';

const TITLES: Record<string, string> = {
  allergens: 'Allergen Information',
  delivery: 'Delivery & Returns',
  privacy: 'Privacy Policy',
  terms: 'Terms & Conditions',
};

export default function Legal() {
  const { doc = '' } = useParams();
  const title = TITLES[doc];
  if (!title) return <h2>Not found</h2>;
  return <h2 style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2>;
}
```

- [ ] **Step 5: Create `react/src/components/Sheet.tsx`**

```tsx
import type { ReactNode } from 'react';

export function Sheet({ eyebrow, title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <section className="sheet-panel">
      {eyebrow && <span className="sheet-eyebrow">{eyebrow}</span>}
      <h2 className="sheet-title">{title}</h2>
      {children}
    </section>
  );
}
```

- [ ] **Step 6: Create `react/src/components/Layout.tsx`**

```tsx
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useCart } from '../cart/CartContext';

const NAV = [
  { to: '/menu', label: 'Menu' },
  { to: '/custom', label: 'Custom Orders' },
  { to: '/reviews', label: 'Reviews' },
];

export default function Layout() {
  const { count } = useCart();
  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand">bakedbyPrii</Link>
        <nav className="site-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="nav-item">{n.label}</NavLink>
          ))}
        </nav>
        <Link to="/checkout" className="contact-btn">
          Order Now{count > 0 ? ` (${count})` : ''}
        </Link>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <p>
          bakedbyPrii · Didcot ·{' '}
          <a href="mailto:BakedbyPrii@gmail.com">BakedbyPrii@gmail.com</a> ·{' '}
          <a href="tel:+447732262999">+44 7732 262999</a>
        </p>
        <p className="legal-links">
          <Link to="/legal/allergens">Allergens</Link> ·{' '}
          <Link to="/legal/delivery">Delivery</Link> ·{' '}
          <Link to="/legal/privacy">Privacy</Link> ·{' '}
          <Link to="/legal/terms">Terms</Link>
        </p>
      </footer>
    </>
  );
}
```

- [ ] **Step 7: Replace `react/src/App.tsx`**

```tsx
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './routes/Home';
import Menu from './routes/Menu';
import Custom from './routes/Custom';
import Reviews from './routes/Reviews';
import Checkout from './routes/Checkout';
import OrderConfirmation from './routes/OrderConfirmation';
import Cancel from './routes/Cancel';
import Admin from './routes/Admin';
import Legal from './routes/Legal';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="menu" element={<Menu />} />
        <Route path="custom" element={<Custom />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="order/:ref" element={<OrderConfirmation />} />
        <Route path="cancel" element={<Cancel />} />
        <Route path="admin" element={<Admin />} />
        <Route path="legal/:doc" element={<Legal />} />
        <Route path="*" element={<h2>Not found</h2>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
```

- [ ] **Step 8: Replace `react/src/main.tsx`** to add the router and cart provider

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { CartProvider } from './cart/CartContext';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CartProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </CartProvider>
  </StrictMode>,
);
```

- [ ] **Step 9: Append layout styles to `react/src/styles/global.css`**

```css
.site-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; padding: 1.1rem 1.6rem; position: sticky; top: 0; z-index: 10;
  backdrop-filter: blur(12px); background: rgba(26, 10, 16, 0.35);
  border-bottom: 1px solid var(--glass-border);
}
.brand { font-family: var(--font-heading); font-size: 1.7rem; text-decoration: none; }
.site-nav { display: flex; gap: 1.1rem; }
.nav-item { text-decoration: none; color: var(--muted-color); font-weight: 500; }
.nav-item:hover, .nav-item.active { color: var(--text-color); }
.contact-btn {
  text-decoration: none; padding: 0.55rem 1.1rem; border-radius: 999px;
  background: var(--accent); color: var(--accent-ink); font-weight: 600;
}
.site-main { max-width: 1100px; margin: 0 auto; padding: 2rem 1.6rem 4rem; }
.site-footer { text-align: center; padding: 2.5rem 1.6rem; color: var(--muted-color); border-top: 1px solid var(--glass-border); }
.site-footer a { color: var(--accent); }
.legal-links { margin-top: 0.6rem; font-size: 0.9rem; }
.sheet-panel {
  background: var(--glass-bg); border: 1px solid var(--glass-border);
  border-radius: 20px; padding: 2rem;
}
.sheet-eyebrow { color: var(--accent); text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.8rem; }
.sheet-title { font-family: var(--font-heading); font-size: 2rem; margin: 0.3rem 0 1rem; }
```

- [ ] **Step 10: Run the routing tests**

Run: `cd react && npx vitest run src/App.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 11: Visually verify**

Run `npm run dev`, click through the header nav to `/menu`, `/custom`, `/reviews`, `/checkout`, and a footer legal link. Each shows its stub heading inside the shell; the background gradient and sticky header render.

- [ ] **Step 12: Commit**

```bash
git add react/src/
git commit -m "feat: brand styles, layout shell, and full route table"
```

---

## Task 5: Content maps (descriptions, bespoke items, themes)

**Files:**
- Create: `react/src/content/menuContent.ts`, `react/src/content/bespoke.ts`, `react/src/content/theme.ts`
- Test: `react/src/content/menuContent.test.ts`

**Interfaces:**
- Produces:
  - `menuContent.ts`: `MENU_CONTENT: Record<string, { description: string; tags: string[] }>`; `contentFor(id: string): { description: string; tags: string[] }` (returns `{ description: '', tags: [] }` for unknown ids).
  - `bespoke.ts`: `BESPOKE: { name: string; price: string; blurb: string; tag: string }[]`.
  - `theme.ts`: `Theme { inner: string; mid: string; outer: string }`; `THEMES: Record<'Cakes'|'Cookies'|'Cupcakes', Theme>`; `DEFAULT_THEME: Theme`; `themeForCategory(category: string): Theme`.
- Data only; no React, no network.

- [ ] **Step 1: Write the failing test `react/src/content/menuContent.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { contentFor, MENU_CONTENT } from './menuContent';
import { themeForCategory, THEMES } from './theme';

// The full set of seeded menu ids (from lib/db.js MENU_SEED).
const SEED_IDS = [
  'ck-chocchip','ck-double','ck-white','ck-redvelvet','ck-oreo','ck-biscoff','ck-nutella','ck-kinder','ck-triple',
  'cup-vanilla','cup-choc','cup-nutella','cup-floral','cup-mini',
  'cake-vanilla','cake-choc','cake-redvelvet','cake-forest',
  'br-classic','br-double','br-ferrero','br-mini',
  'tea-butter','tea-marble','tea-scones',
];

describe('menu content', () => {
  it('has content for every seeded menu id', () => {
    for (const id of SEED_IDS) {
      expect(MENU_CONTENT[id], `missing content for ${id}`).toBeDefined();
    }
  });

  it('contentFor returns a safe empty default for unknown ids', () => {
    expect(contentFor('nope')).toEqual({ description: '', tags: [] });
  });

  it('maps categories to their theme and falls back to Cakes', () => {
    expect(themeForCategory('Cookies')).toEqual(THEMES.Cookies);
    expect(themeForCategory('Tea Time Bakes')).toEqual(THEMES.Cakes);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd react && npx vitest run src/content/menuContent.test.ts`
Expected: FAIL — cannot resolve `./menuContent`.

- [ ] **Step 3: Create `react/src/content/theme.ts`**

```ts
export interface Theme { inner: string; mid: string; outer: string; }

export const THEMES: Record<'Cakes' | 'Cookies' | 'Cupcakes', Theme> = {
  Cakes: { inner: '#b03a5b', mid: '#5e1f33', outer: '#1a0a10' },
  Cookies: { inner: '#a86b32', mid: '#5a3417', outer: '#170d05' },
  Cupcakes: { inner: '#7b4fa8', mid: '#3d2459', outer: '#100817' },
};

export const DEFAULT_THEME: Theme = THEMES.Cakes;

export function themeForCategory(category: string): Theme {
  if (category === 'Cookies') return THEMES.Cookies;
  if (category === 'Cupcakes') return THEMES.Cupcakes;
  return DEFAULT_THEME;
}
```

- [ ] **Step 4: Create `react/src/content/menuContent.ts`** (marketing copy keyed by id; facts still come from the API)

```ts
export interface ItemContent { description: string; tags: string[]; }

export const MENU_CONTENT: Record<string, ItemContent> = {
  'ck-chocchip': { description: 'The classic — soft centre, crisp edge, loaded with chocolate chips.', tags: ['Classic'] },
  'ck-double': { description: 'Cocoa dough with chocolate chips for double the depth.', tags: ['Classic'] },
  'ck-white': { description: 'Buttery cookie studded with creamy white chocolate.', tags: ['Classic'] },
  'ck-redvelvet': { description: 'Red velvet cookie with a subtle cocoa tang.', tags: ['Classic'] },
  'ck-oreo': { description: 'Cookies-and-cream throughout with crushed Oreo.', tags: ['Classic'] },
  'ck-biscoff': { description: 'Stuffed with molten Biscoff spread.', tags: ['Stuffed'] },
  'ck-nutella': { description: 'Oozing Nutella centre in a chocolate cookie.', tags: ['Stuffed'] },
  'ck-kinder': { description: 'Kinder chocolate baked into a gooey middle.', tags: ['Stuffed'] },
  'ck-triple': { description: 'Three chocolates in one indulgent cookie.', tags: ['Premium'] },
  'cup-vanilla': { description: 'Light vanilla sponge with smooth buttercream.', tags: ['Classic'] },
  'cup-choc': { description: 'Rich chocolate sponge and chocolate buttercream.', tags: ['Classic'] },
  'cup-nutella': { description: 'Vanilla cupcake with a hidden Nutella core.', tags: ['Stuffed'] },
  'cup-floral': { description: 'Hand-piped floral buttercream — almost too pretty to eat.', tags: ['Signature'] },
  'cup-mini': { description: 'Bite-sized cupcakes, perfect for dessert tables.', tags: ['Mini'] },
  'cake-vanilla': { description: '6-inch vanilla sponge layered with buttercream. Serves 8–10.', tags: ['Serves 8–10'] },
  'cake-choc': { description: 'Deep chocolate layers with chocolate buttercream. Serves 8–10.', tags: ['Serves 8–10'] },
  'cake-redvelvet': { description: 'Red velvet with cream-cheese frosting. Serves 8–10.', tags: ['Serves 8–10'] },
  'cake-forest': { description: 'Black Forest — chocolate, cherries and cream. Serves 8–10.', tags: ['Serves 8–10'] },
  'br-classic': { description: 'Fudgy, dense and generously chocolatey.', tags: ['Classic'] },
  'br-double': { description: 'Extra chocolate chunks folded through the batter.', tags: ['Classic'] },
  'br-ferrero': { description: 'Topped with Ferrero Rocher and hazelnut.', tags: ['Premium'] },
  'br-mini': { description: 'Little squares of fudgy brownie.', tags: ['Mini'] },
  'tea-butter': { description: 'Traditional buttery loaf cake for afternoon tea.', tags: ['Loaf'] },
  'tea-marble': { description: 'Swirled vanilla and chocolate loaf.', tags: ['Loaf'] },
  'tea-scones': { description: 'Four fresh scones — jam and cream optional.', tags: ['4-pack'] },
};

export function contentFor(id: string): ItemContent {
  return MENU_CONTENT[id] ?? { description: '', tags: [] };
}
```

- [ ] **Step 5: Create `react/src/content/bespoke.ts`**

```ts
export interface BespokeItem { name: string; price: string; blurb: string; tag: string; }

export const BESPOKE: BespokeItem[] = [
  { name: 'Celebration Cakes', price: 'from £45', blurb: 'Birthdays, anniversaries and milestones, personalised to your theme.', tag: 'Single & multi-layer' },
  { name: 'Wedding Tiers', price: 'from £180', blurb: 'Elegant tiered cakes with a free consultation and tasting.', tag: '2–5 tiers' },
  { name: 'Number / Letter Cupcakes', price: 'from £35', blurb: 'Pull-apart cupcakes shaped into a number or letter for the big day.', tag: 'Customisable' },
  { name: 'Dietary & Vegan', price: 'on request', blurb: 'Vegan, gluten-free and reduced-sugar options available.', tag: 'Ask us' },
];
```

- [ ] **Step 6: Run the content tests**

Run: `cd react && npx vitest run src/content/menuContent.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add react/src/content/
git commit -m "feat: menu content map, bespoke items, and category themes"
```

---

## Task 6: money helper, QtyStepper, MenuCard

**Files:**
- Create: `react/src/money.ts`, `react/src/components/QtyStepper.tsx`, `react/src/components/MenuCard.tsx`
- Test: `react/src/money.test.ts`, `react/src/components/MenuCard.test.tsx`

**Interfaces:**
- Consumes: `useCart` (Task 3), `contentFor` (Task 5), `MenuItem` (Task 2).
- Produces:
  - `money.ts`: `gbp(n: number): string` → `"£2.75"`; `deliveryFee(subtotal: number): number` (2.5, or 0 when `subtotal >= 20`).
  - `QtyStepper.tsx`: `QtyStepper({ qty, onDec, onInc })`.
  - `MenuCard.tsx`: `MenuCard({ item }: { item: MenuItem })` — shows name, price, description, tags, allergens, and a stepper wired to the cart.

- [ ] **Step 1: Write `react/src/money.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { gbp, deliveryFee } from './money';

describe('money', () => {
  it('formats GBP to two decimals', () => {
    expect(gbp(2.75)).toBe('£2.75');
    expect(gbp(35)).toBe('£35.00');
  });
  it('charges delivery under £20 and frees it at/over £20', () => {
    expect(deliveryFee(19.99)).toBe(2.5);
    expect(deliveryFee(20)).toBe(0);
    expect(deliveryFee(42)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd react && npx vitest run src/money.test.ts`
Expected: FAIL — cannot resolve `./money`.

- [ ] **Step 3: Create `react/src/money.ts`**

```ts
export const DELIVERY_FEE = 2.5;
export const FREE_DELIVERY_OVER = 20;

export function gbp(n: number): string {
  return '£' + n.toFixed(2);
}

export function deliveryFee(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `cd react && npx vitest run src/money.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Create `react/src/components/QtyStepper.tsx`**

```tsx
export function QtyStepper({ qty, onDec, onInc }: { qty: number; onDec: () => void; onInc: () => void }) {
  return (
    <span className="qty">
      <button type="button" aria-label="Remove one" onClick={onDec} disabled={qty === 0}>−</button>
      <span aria-label="Quantity">{qty}</span>
      <button type="button" aria-label="Add one" onClick={onInc}>+</button>
    </span>
  );
}
```

- [ ] **Step 6: Create `react/src/components/MenuCard.tsx`**

```tsx
import type { MenuItem } from '../types';
import { useCart } from '../cart/CartContext';
import { contentFor } from '../content/menuContent';
import { gbp } from '../money';
import { QtyStepper } from './QtyStepper';

export function MenuCard({ item }: { item: MenuItem }) {
  const { cart, inc, dec } = useCart();
  const { description, tags } = contentFor(item.id);
  const qty = cart[item.id] || 0;
  return (
    <div className="menu-card">
      <div className="row">
        <h4>{item.name}</h4>
        <span className="price">{gbp(item.price)}</span>
      </div>
      {description && <p>{description}</p>}
      <div className="menu-card-foot">
        <span className="tags">{[...tags, item.allergens].filter(Boolean).join(' · ')}</span>
        <QtyStepper qty={qty} onDec={() => dec(item.id)} onInc={() => inc(item.id)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write `react/src/components/MenuCard.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartProvider } from '../cart/CartContext';
import { MenuCard } from './MenuCard';
import type { MenuItem } from '../types';

const item: MenuItem = { id: 'ck-chocchip', category: 'Cookies', name: 'Chocolate Chip Cookie', price: 2.75, allergens: 'Gluten, Egg, Milk, Soya' };

describe('MenuCard', () => {
  it('shows name, price and allergens', () => {
    render(<CartProvider><MenuCard item={item} /></CartProvider>);
    expect(screen.getByText('Chocolate Chip Cookie')).toBeInTheDocument();
    expect(screen.getByText('£2.75')).toBeInTheDocument();
    expect(screen.getByText(/Gluten, Egg, Milk, Soya/)).toBeInTheDocument();
  });

  it('increments quantity when + is clicked', async () => {
    render(<CartProvider><MenuCard item={item} /></CartProvider>);
    expect(screen.getByLabelText('Quantity')).toHaveTextContent('0');
    await userEvent.click(screen.getByLabelText('Add one'));
    expect(screen.getByLabelText('Quantity')).toHaveTextContent('1');
  });
});
```

- [ ] **Step 8: Append card styles to `react/src/styles/global.css`**

```css
.menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
.menu-card { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 16px; padding: 1.1rem 1.2rem; }
.menu-card .row { display: flex; justify-content: space-between; align-items: baseline; gap: 0.75rem; }
.menu-card h4 { font-size: 1.1rem; }
.menu-card .price { color: var(--accent); font-weight: 600; white-space: nowrap; }
.menu-card p { color: var(--muted-color); font-size: 0.92rem; margin: 0.5rem 0 0.8rem; }
.menu-card-foot { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; }
.tags { color: var(--muted-color); font-size: 0.78rem; }
.qty { display: flex; align-items: center; gap: 0.55rem; }
.qty button { width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.06); color: #fff; cursor: pointer; font-size: 1.05rem; line-height: 1; }
.qty button:hover:not(:disabled) { background: var(--accent); color: var(--accent-ink); }
.qty button:disabled { opacity: 0.4; cursor: default; }
.qty > span { width: 22px; text-align: center; font-weight: 600; }
```

- [ ] **Step 9: Run the component tests**

Run: `cd react && npx vitest run src/money.test.ts src/components/MenuCard.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 10: Commit**

```bash
git add react/src/money.ts react/src/money.test.ts react/src/components/ react/src/styles/global.css
git commit -m "feat: money helper, quantity stepper, and menu card"
```

---

## Task 7: Menu page (fetch, group, error and empty states)

**Files:**
- Modify: `react/src/routes/Menu.tsx`
- Create: `react/src/useMenu.ts`
- Test: `react/src/routes/Menu.test.tsx`

**Interfaces:**
- Consumes: `getMenu` (Task 2), `MenuCard` (Task 6), `MenuItem` (Task 2).
- Produces: `useMenu(): { menu: MenuItem[] | null; error: string | null; loading: boolean; reload: () => void }`; a Menu page grouping items by category in first-seen order, with loading, error+retry, and empty states.

- [ ] **Step 1: Write the failing test `react/src/routes/Menu.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../cart/CartContext';
import { server } from '../test/mocks/handlers';
import Menu from './Menu';

const wrap = () => render(
  <CartProvider><MemoryRouter><Menu /></MemoryRouter></CartProvider>,
);

describe('Menu page', () => {
  it('renders items grouped by category from the API', async () => {
    wrap();
    expect(await screen.findByText('Chocolate Chip Cookie')).toBeInTheDocument();
    expect(screen.getByText('Vanilla Buttercream Cake')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cookies' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cakes' })).toBeInTheDocument();
  });

  it('shows an error with a retry when the menu fails to load', async () => {
    server.use(http.get('/api/menu', () => HttpResponse.json({ ok: false, error: 'boom' }, { status: 500 })));
    wrap();
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows an unavailable message when the menu is empty', async () => {
    server.use(http.get('/api/menu', () => HttpResponse.json({ ok: true, menu: [] })));
    wrap();
    expect(await screen.findByText(/menu is unavailable/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd react && npx vitest run src/routes/Menu.test.tsx`
Expected: FAIL — Menu is still the stub.

- [ ] **Step 3: Create `react/src/useMenu.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { getMenu } from './api/client';
import type { MenuItem } from './types';

export function useMenu() {
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getMenu()
      .then((m) => setMenu(m))
      .catch((e) => setError(e.message || 'Could not load the menu.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { menu, error, loading, reload: load };
}

export function groupByCategory(menu: MenuItem[]): { category: string; items: MenuItem[] }[] {
  const groups: { category: string; items: MenuItem[] }[] = [];
  const index = new Map<string, MenuItem[]>();
  for (const item of menu) {
    if (!index.has(item.category)) {
      const items: MenuItem[] = [];
      index.set(item.category, items);
      groups.push({ category: item.category, items });
    }
    index.get(item.category)!.push(item);
  }
  return groups;
}
```

- [ ] **Step 4: Replace `react/src/routes/Menu.tsx`**

```tsx
import { useMenu, groupByCategory } from '../useMenu';
import { MenuCard } from '../components/MenuCard';

export default function Menu() {
  const { menu, error, loading, reload } = useMenu();

  if (loading) return <p className="state-msg">Loading the menu…</p>;
  if (error) {
    return (
      <div className="state-msg">
        <p>Sorry — we couldn’t load the menu.</p>
        <button className="submit-btn" onClick={reload}>Try again</button>
      </div>
    );
  }
  if (!menu || menu.length === 0) return <p className="state-msg">Our menu is unavailable right now. Please check back soon.</p>;

  return (
    <div>
      <h2 className="sheet-title">Our Menu</h2>
      {groupByCategory(menu).map((group) => (
        <section key={group.category} style={{ marginBottom: '2rem' }}>
          <h3 className="group-heading">{group.category}</h3>
          <div className="menu-grid">
            {group.items.map((item) => <MenuCard key={item.id} item={item} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Append styles to `react/src/styles/global.css`**

```css
.state-msg { text-align: center; padding: 3rem 1rem; color: var(--muted-color); }
.group-heading { font-family: var(--font-heading); font-size: 1.5rem; margin-bottom: 0.9rem; }
.submit-btn { padding: 0.7rem 1.4rem; border: none; border-radius: 999px; background: var(--accent); color: var(--accent-ink); font-weight: 600; cursor: pointer; }
.submit-btn:disabled { opacity: 0.5; cursor: default; }
```

- [ ] **Step 6: Run the menu tests**

Run: `cd react && npx vitest run src/routes/Menu.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Manually verify against the real API**

With Node running on 3000 and `npm run dev`, open `/menu`. The full seeded menu renders grouped by Cookies, Cupcakes, Cakes, Brownies, Tea Time Bakes; steppers change quantities and the header count updates.

- [ ] **Step 8: Commit**

```bash
git add react/src/useMenu.ts react/src/routes/Menu.tsx react/src/routes/Menu.test.tsx react/src/styles/global.css
git commit -m "feat: menu page rendered from /api/menu with error and empty states"
```

---

## Task 8: Home page (category cards + GSAP theme rotation)

**Files:**
- Modify: `react/src/routes/Home.tsx`
- Test: `react/src/routes/Home.test.tsx`

**Interfaces:**
- Consumes: `useMenu` (Task 7), `themeForCategory`/`DEFAULT_THEME` (Task 5), `gbp` (Task 6).
- Produces: a hero plus category cards. Each card shows the category name and its lowest price (computed from the menu). Clicking a card animates the page background to that category's theme via GSAP and links to `/menu`.

- [ ] **Step 1: Write the failing test `react/src/routes/Home.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../cart/CartContext';
import Home from './Home';

describe('Home page', () => {
  it('renders the brand hero and category cards with from-prices', async () => {
    render(<CartProvider><MemoryRouter><Home /></MemoryRouter></CartProvider>);
    expect(screen.getByRole('heading', { name: /bakedbyPrii/i })).toBeInTheDocument();
    expect(await screen.findByText('Cookies')).toBeInTheDocument();
    // Chocolate Chip Cookie 2.75 is the cheapest in the fixture's Cookies group.
    expect(screen.getByText(/from £2\.75/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd react && npx vitest run src/routes/Home.test.tsx`
Expected: FAIL — Home is still the stub.

- [ ] **Step 3: Replace `react/src/routes/Home.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { useMenu } from '../useMenu';
import { themeForCategory } from '../content/theme';
import { gbp } from '../money';
import type { MenuItem } from '../types';

function categorySummaries(menu: MenuItem[]): { category: string; min: number }[] {
  const out: { category: string; min: number }[] = [];
  const index = new Map<string, { category: string; min: number }>();
  for (const item of menu) {
    const seen = index.get(item.category);
    if (!seen) {
      const rec = { category: item.category, min: item.price };
      index.set(item.category, rec);
      out.push(rec);
    } else {
      seen.min = Math.min(seen.min, item.price);
    }
  }
  return out;
}

function applyTheme(category: string) {
  const t = themeForCategory(category);
  gsap.to(document.body, {
    '--bg-inner': t.inner, '--bg-mid': t.mid, '--bg-outer': t.outer,
    duration: 1.2, ease: 'power2.inOut',
  });
}

export default function Home() {
  const { menu } = useMenu();
  const cats = menu ? categorySummaries(menu) : [];
  return (
    <div>
      <section className="hero">
        <h1 className="hero-title">bakedbyPrii</h1>
        <p className="hero-lead">Home-baked cookies, cupcakes, brownies and celebration cakes — freshly made in Didcot.</p>
        <Link to="/menu" className="contact-btn">Browse the menu</Link>
      </section>
      <div className="menu-grid">
        {cats.map((c) => (
          <Link key={c.category} to="/menu" className="menu-card cat-card"
                onMouseEnter={() => applyTheme(c.category)}>
            <div className="row"><h4>{c.category}</h4><span className="price">from {gbp(c.min)}</span></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Append hero styles to `react/src/styles/global.css`**

```css
.hero { text-align: center; padding: 3.5rem 1rem 2.5rem; }
.hero-title { font-family: var(--font-heading); font-size: clamp(2.6rem, 8vw, 4.5rem); }
.hero-lead { color: var(--muted-color); max-width: 42ch; margin: 1rem auto 1.6rem; }
.cat-card { text-decoration: none; display: block; }
.cat-card:hover { border-color: var(--accent); }
```

- [ ] **Step 5: Run the home test**

Run: `cd react && npx vitest run src/routes/Home.test.tsx`
Expected: PASS. (GSAP runs only on hover, so it does not execute during this render test.)

- [ ] **Step 6: Manually verify**

On `/`, hover the category cards — the background gradient eases toward each theme. Cards show correct from-prices. Clicking goes to `/menu`.

- [ ] **Step 7: Commit**

```bash
git add react/src/routes/Home.tsx react/src/routes/Home.test.tsx react/src/styles/global.css
git commit -m "feat: home page with category cards and GSAP theme rotation"
```

---

## Task 9: Checkout (cart review, form, validation, place order)

**Files:**
- Modify: `react/src/routes/Checkout.tsx`
- Create: `react/src/routes/checkoutValidation.ts`
- Test: `react/src/routes/checkoutValidation.test.ts`, `react/src/routes/Checkout.test.tsx`

**Interfaces:**
- Consumes: `useCart` (Task 3), `useMenu` (Task 7), `createOrder` (Task 2), `gbp`/`deliveryFee` (Task 6), `CreateOrderBody`/`CreateOrderResult` (Task 2).
- Produces:
  - `checkoutValidation.ts`: `validateCheckout(form): string | null` returning the first client-side error message or null, mirroring the server's rules (name/email/phone/date required, email shape, payment whitelist, delivery needs OX11 address).
  - Checkout page: line items priced from the menu, quantity steppers, subtotal + delivery preview, customer form, fulfilment toggle, payment radios, submit → `createOrder` → navigate to `/order/:ref` passing the result in router state. Server errors shown inline; cart preserved on error.

- [ ] **Step 1: Write `react/src/routes/checkoutValidation.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { validateCheckout } from './checkoutValidation';

const base = {
  name: 'Sam', email: 'sam@example.com', phone: '07700900000', notes: '',
  fulfilment: 'collection' as const, date: '2026-08-01', payment: 'cash' as const,
  address: '', postcode: '',
};

describe('validateCheckout', () => {
  it('accepts a valid collection order', () => {
    expect(validateCheckout(base)).toBeNull();
  });
  it('requires name, email, phone and date', () => {
    expect(validateCheckout({ ...base, name: '' })).toMatch(/name/i);
  });
  it('rejects a malformed email', () => {
    expect(validateCheckout({ ...base, email: 'nope' })).toMatch(/valid email/i);
  });
  it('rejects an unlisted payment method', () => {
    expect(validateCheckout({ ...base, payment: 'crypto' as never })).toMatch(/payment/i);
  });
  it('requires a Didcot address for delivery', () => {
    expect(validateCheckout({ ...base, fulfilment: 'delivery', address: '', postcode: '' })).toMatch(/address/i);
  });
  it('rejects a non-OX11 delivery postcode', () => {
    expect(validateCheckout({ ...base, fulfilment: 'delivery', address: '1 High St', postcode: 'RG1 1AA' })).toMatch(/OX11|Didcot/i);
  });
  it('accepts an OX11 delivery order', () => {
    expect(validateCheckout({ ...base, fulfilment: 'delivery', address: '1 High St', postcode: 'OX11 7AA' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd react && npx vitest run src/routes/checkoutValidation.test.ts`
Expected: FAIL — cannot resolve `./checkoutValidation`.

- [ ] **Step 3: Create `react/src/routes/checkoutValidation.ts`**

```ts
import type { Fulfilment, Payment } from '../types';

export interface CheckoutForm {
  name: string; email: string; phone: string; notes: string;
  fulfilment: Fulfilment; date: string; payment: Payment;
  address: string; postcode: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const OX11 = /^OX11/i;
const PAYMENTS = ['cash', 'bank', 'card', 'paypal'];

export function validateCheckout(f: CheckoutForm): string | null {
  if (!f.name.trim() || !f.email.trim() || !f.phone.trim() || !f.date.trim())
    return 'Please fill in your name, email, phone and required date.';
  if (!EMAIL_RE.test(f.email.trim())) return 'Please enter a valid email address.';
  if (!PAYMENTS.includes(f.payment)) return 'Please choose a payment method.';
  if (f.fulfilment === 'delivery') {
    if (!f.address.trim() || !f.postcode.trim()) return 'Please enter your Didcot delivery address and postcode.';
    if (!OX11.test(f.postcode.replace(/\s/g, '')))
      return "Sorry, we only deliver within Didcot (OX11). You're welcome to collect from home instead.";
  }
  return null;
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `cd react && npx vitest run src/routes/checkoutValidation.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Replace `react/src/routes/Checkout.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart/CartContext';
import { useMenu } from '../useMenu';
import { createOrder } from '../api/client';
import { gbp, deliveryFee } from '../money';
import { validateCheckout, type CheckoutForm } from './checkoutValidation';
import { QtyStepper } from '../components/QtyStepper';
import type { Payment } from '../types';

const PAYMENTS: { value: Payment; label: string }[] = [
  { value: 'cash', label: 'Pay in person — cash' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'card', label: 'Pay by card (secure link)' },
  { value: 'paypal', label: 'PayPal' },
];

export default function Checkout() {
  const { cart, inc, dec } = useCart();
  const { menu } = useMenu();
  const navigate = useNavigate();
  const [form, setForm] = useState<CheckoutForm>({
    name: '', email: '', phone: '', notes: '',
    fulfilment: 'collection', date: new Date().toISOString().slice(0, 10),
    payment: 'cash', address: '', postcode: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lines = useMemo(() => {
    if (!menu) return [];
    return menu.filter((m) => cart[m.id]).map((m) => ({ ...m, qty: cart[m.id], lineTotal: m.price * cart[m.id] }));
  }, [menu, cart]);

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const fee = form.fulfilment === 'delivery' ? deliveryFee(subtotal) : 0;
  const total = subtotal + fee;
  const set = (patch: Partial<CheckoutForm>) => setForm((f) => ({ ...f, ...patch }));

  if (menu && lines.length === 0) {
    return (
      <div className="state-msg">
        <p>Your basket is empty.</p>
        <Link className="submit-btn" to="/menu">Browse the menu</Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clientError = validateCheckout(form);
    if (clientError) { setError(clientError); return; }
    setSubmitting(true); setError(null);
    try {
      const result = await createOrder({
        customer: { name: form.name, email: form.email, phone: form.phone, notes: form.notes },
        items: lines.map((l) => ({ id: l.id, qty: l.qty })),
        fulfilment: form.fulfilment, date: form.date, payment: form.payment,
        address: { line: form.address, postcode: form.postcode },
      });
      navigate(`/order/${result.ref}`, { state: { result } });
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form className="checkout" onSubmit={submit}>
      <h2 className="sheet-title">Checkout</h2>

      <section className="glass-block">
        <h3 className="group-heading">Your order</h3>
        {lines.map((l) => (
          <div key={l.id} className="line-item">
            <span className="li-name">{l.name}</span>
            <QtyStepper qty={l.qty} onDec={() => dec(l.id)} onInc={() => inc(l.id)} />
            <span className="li-price">{gbp(l.lineTotal)}</span>
          </div>
        ))}
        <div className="totals">
          <div><span>Subtotal</span><span>{gbp(subtotal)}</span></div>
          {form.fulfilment === 'delivery' && <div><span>Delivery</span><span>{fee === 0 ? 'Free' : gbp(fee)}</span></div>}
          <div className="grand"><span>Total</span><span>{gbp(total)}</span></div>
        </div>
      </section>

      <section className="glass-block form">
        <div><label htmlFor="co-name">Your name</label><input id="co-name" value={form.name} onChange={(e) => set({ name: e.target.value })} required /></div>
        <div><label htmlFor="co-email">Email</label><input id="co-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required /></div>
        <div><label htmlFor="co-phone">Phone</label><input id="co-phone" type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} required /></div>
        <div><label htmlFor="co-date">Required date</label><input id="co-date" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} required /></div>

        <div className="full">
          <label>Fulfilment</label>
          <div className="toggle">
            <label><input type="radio" name="fulfilment" checked={form.fulfilment === 'collection'} onChange={() => set({ fulfilment: 'collection' })} /> Collection (free)</label>
            <label><input type="radio" name="fulfilment" checked={form.fulfilment === 'delivery'} onChange={() => set({ fulfilment: 'delivery' })} /> Delivery (Didcot OX11)</label>
          </div>
        </div>

        {form.fulfilment === 'delivery' && (
          <>
            <div className="full"><label htmlFor="co-address">Delivery address</label><input id="co-address" value={form.address} onChange={(e) => set({ address: e.target.value })} /></div>
            <div><label htmlFor="co-postcode">Postcode</label><input id="co-postcode" value={form.postcode} onChange={(e) => set({ postcode: e.target.value })} placeholder="OX11 …" /></div>
          </>
        )}

        <div className="full"><label htmlFor="co-notes">Notes (optional)</label><textarea id="co-notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Allergies, message on the cake, collection time…" /></div>

        <div className="full">
          <label>Payment</label>
          {PAYMENTS.map((p) => (
            <label key={p.value} className="pay-option">
              <input type="radio" name="payment" checked={form.payment === p.value} onChange={() => set({ payment: p.value })} /> {p.label}
            </label>
          ))}
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? 'Placing your order…' : `Place order · ${gbp(total)}`}
        </button>
        <p className="form-note">No payment is taken on this site. We confirm your order and arrange payment afterwards.</p>
      </section>
    </form>
  );
}
```

- [ ] **Step 6: Write `react/src/routes/Checkout.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from '../cart/CartContext';
import { server } from '../test/mocks/handlers';
import Checkout from './Checkout';

function renderCheckout() {
  localStorage.setItem('bbp-cart', JSON.stringify({ 'ck-chocchip': 2 }));
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={['/checkout']}>
        <Routes>
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:ref" element={<h2>Order placed</h2>} />
        </Routes>
      </MemoryRouter>
    </CartProvider>,
  );
}

describe('Checkout', () => {
  beforeEach(() => localStorage.clear());

  it('lists cart lines and a total from the menu', async () => {
    renderCheckout();
    expect(await screen.findByText('Chocolate Chip Cookie')).toBeInTheDocument();
    expect(screen.getByText('£5.50')).toBeInTheDocument(); // 2 × 2.75
  });

  it('shows the server error inline and keeps the cart', async () => {
    server.use(http.post('/api/orders', () => HttpResponse.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 })));
    renderCheckout();
    await screen.findByText('Chocolate Chip Cookie');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sam');
    await userEvent.type(screen.getByLabelText('Email'), 'sam@example.com');
    await userEvent.type(screen.getByLabelText('Phone'), '07700900000');
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid email/i);
    expect(screen.getByText('Chocolate Chip Cookie')).toBeInTheDocument();
  });

  it('navigates to confirmation on success', async () => {
    renderCheckout();
    await screen.findByText('Chocolate Chip Cookie');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sam');
    await userEvent.type(screen.getByLabelText('Email'), 'sam@example.com');
    await userEvent.type(screen.getByLabelText('Phone'), '07700900000');
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByRole('heading', { name: /order placed/i })).toBeInTheDocument();
  });
});
```

Note: the Checkout inputs use explicit `htmlFor`/`id` pairs (e.g. `co-name`), so `getByLabelText('Your name')` resolves. The radio-group `<label>`s wrap their inputs, which RTL also matches.

- [ ] **Step 7: Append checkout styles to `react/src/styles/global.css`**

```css
.glass-block { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 18px; padding: 1.4rem; margin-bottom: 1.4rem; }
.line-item { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 1rem; padding: 0.5rem 0; border-bottom: 1px solid var(--glass-border); }
.li-price { min-width: 4rem; text-align: right; color: var(--accent); font-weight: 600; }
.totals { margin-top: 1rem; display: grid; gap: 0.3rem; }
.totals > div { display: flex; justify-content: space-between; color: var(--muted-color); }
.totals .grand { color: var(--text-color); font-weight: 700; font-size: 1.1rem; margin-top: 0.4rem; }
.form { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form .full { grid-column: 1 / -1; }
.form label { display: block; font-size: 0.85rem; color: var(--muted-color); margin-bottom: 0.3rem; }
.form input, .form textarea { width: 100%; padding: 0.6rem 0.7rem; border-radius: 10px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.04); color: #fff; font: inherit; }
.form textarea { min-height: 90px; resize: vertical; }
.toggle, .pay-option { display: block; color: var(--text-color); }
.pay-option { padding: 0.3rem 0; }
.form-error { grid-column: 1 / -1; color: #ffd7d7; background: rgba(180,40,60,0.3); border: 1px solid rgba(255,120,140,0.4); padding: 0.7rem 0.9rem; border-radius: 10px; }
.form-note { grid-column: 1 / -1; color: var(--muted-color); font-size: 0.82rem; }
```

- [ ] **Step 8: Run the checkout tests**

Run: `cd react && npx vitest run src/routes/checkoutValidation.test.ts src/routes/Checkout.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 9: Manually place a real order**

With Node on 3000: add items on `/menu`, go to `/checkout`, fill the form, place a collection order. Confirm the console logs `[order] BBP-…` on the Node side and the browser navigates to `/order/BBP-…`.

- [ ] **Step 10: Commit**

```bash
git add react/src/routes/checkoutValidation.ts react/src/routes/checkoutValidation.test.ts react/src/routes/Checkout.tsx react/src/routes/Checkout.test.tsx react/src/styles/global.css
git commit -m "feat: checkout with client validation, live totals, and order placement"
```

---

## Task 10: Order confirmation (router-state render + reload fallback)

**Files:**
- Modify: `react/src/routes/OrderConfirmation.tsx`
- Test: `react/src/routes/OrderConfirmation.test.tsx`

**Interfaces:**
- Consumes: `CreateOrderResult` (Task 2), `gbp` (Task 6), `useCart` (Task 3, to clear on mount).
- Produces: a confirmation page that reads `location.state.result`; if absent (hard reload), shows a ref-only fallback. Clears the cart once on successful mount.

- [ ] **Step 1: Write the failing test `react/src/routes/OrderConfirmation.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from '../cart/CartContext';
import OrderConfirmation from './OrderConfirmation';

const result = { ref: 'BBP-ABCD', subtotal: 5.5, delivery_fee: 0, total: 5.5, payment: 'cash', fulfilment: 'collection' };

function renderAt(state: unknown) {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={[{ pathname: '/order/BBP-ABCD', state }]}>
        <Routes><Route path="/order/:ref" element={<OrderConfirmation />} /></Routes>
      </MemoryRouter>
    </CartProvider>,
  );
}

describe('OrderConfirmation', () => {
  it('shows the ref and total from router state', () => {
    renderAt({ result });
    expect(screen.getByText('BBP-ABCD')).toBeInTheDocument();
    expect(screen.getByText(/£5\.50/)).toBeInTheDocument();
  });

  it('falls back to a ref-only message when state is missing (hard reload)', () => {
    renderAt(null);
    expect(screen.getByText('BBP-ABCD')).toBeInTheDocument();
    expect(screen.getByText(/in your email/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd react && npx vitest run src/routes/OrderConfirmation.test.tsx`
Expected: FAIL — stub has no such content.

- [ ] **Step 3: Replace `react/src/routes/OrderConfirmation.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useCart } from '../cart/CartContext';
import { gbp } from '../money';
import type { CreateOrderResult } from '../types';

export default function OrderConfirmation() {
  const { ref = '' } = useParams();
  const location = useLocation();
  const result = (location.state as { result?: CreateOrderResult } | null)?.result;
  const { clear } = useCart();
  const cleared = useRef(false);

  useEffect(() => {
    if (result && !cleared.current) { clear(); cleared.current = true; }
  }, [result, clear]);

  return (
    <div className="sheet-panel confirm">
      <span className="sheet-eyebrow">Thank you</span>
      <h2 className="sheet-title">Order placed</h2>
      <p>Your reference is <strong className="ref">{ref}</strong>.</p>
      {result ? (
        <div className="totals" style={{ maxWidth: 320 }}>
          <div><span>Subtotal</span><span>{gbp(result.subtotal)}</span></div>
          {result.fulfilment === 'delivery' && <div><span>Delivery</span><span>{result.delivery_fee === 0 ? 'Free' : gbp(result.delivery_fee)}</span></div>}
          <div className="grand"><span>Total</span><span>{gbp(result.total)}</span></div>
        </div>
      ) : (
        <p className="muted">The full details are in your email. Please check your inbox for confirmation and your cancel link.</p>
      )}
      <p style={{ marginTop: '1.2rem' }}>We’ll email you to confirm and arrange payment. <Link to="/menu">Back to the menu →</Link></p>
    </div>
  );
}
```

- [ ] **Step 4: Add the `.muted` / `.ref` styles to `react/src/styles/global.css`**

```css
.muted { color: var(--muted-color); }
.ref { color: var(--accent); letter-spacing: 0.05em; }
.confirm p { margin-bottom: 0.6rem; }
```

- [ ] **Step 5: Run the confirmation tests**

Run: `cd react && npx vitest run src/routes/OrderConfirmation.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Manually verify the cart empties**

Place an order (Task 9 flow); confirm the confirmation page shows the ref and total, and the header cart count returns to 0.

- [ ] **Step 7: Commit**

```bash
git add react/src/routes/OrderConfirmation.tsx react/src/routes/OrderConfirmation.test.tsx react/src/styles/global.css
git commit -m "feat: order confirmation from router state with reload fallback"
```

---

## Task 11: Customer cancel (token-gated view + cancel)

**Files:**
- Modify: `react/src/routes/Cancel.tsx`
- Test: `react/src/routes/Cancel.test.tsx`

**Interfaces:**
- Consumes: `getOrder`, `cancelOrder` (Task 2), `gbp` (Task 6), `PublicOrder` (Task 2).
- Produces: a page reading `?ref=&token=` from the URL. Loads the order; shows its state; a Cancel button when `cancellable`; success and error (bad token / not cancellable) states. Missing ref/token → an "invalid link" message without a fetch.

- [ ] **Step 1: Write the failing test `react/src/routes/Cancel.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '../test/mocks/handlers';
import Cancel from './Cancel';

const order = {
  ref: 'BBP-ABCD', name: 'Sam', status: 'new', fulfilment: 'collection',
  address: null, postcode: null, required_date: '2026-08-01', payment: 'cash',
  subtotal: 5.5, delivery_fee: 0, total: 5.5,
  items: [{ item_id: 'ck-chocchip', name: 'Chocolate Chip Cookie', price: 2.75, qty: 2 }],
  created_at: '2026-07-16T10:00:00Z', cancellable: true,
};

const renderAt = (search: string) =>
  render(<MemoryRouter initialEntries={[`/cancel${search}`]}><Cancel /></MemoryRouter>);

describe('Cancel', () => {
  it('shows an invalid-link message when ref/token are missing', () => {
    renderAt('');
    expect(screen.getByText(/invalid/i)).toBeInTheDocument();
  });

  it('loads an order and cancels it', async () => {
    server.use(
      http.get('/api/orders/:ref', () => HttpResponse.json({ ok: true, order })),
      http.post('/api/orders/:ref/cancel', () => HttpResponse.json({ ok: true })),
    );
    renderAt('?ref=BBP-ABCD&token=secret');
    await userEvent.click(await screen.findByRole('button', { name: /cancel my order/i }));
    expect(await screen.findByText(/has been cancelled/i)).toBeInTheDocument();
  });

  it('shows an invalid message on a bad token (404)', async () => {
    server.use(http.get('/api/orders/:ref', () => HttpResponse.json({ ok: false, error: 'Order not found or link is invalid.' }, { status: 404 })));
    renderAt('?ref=BBP-ABCD&token=wrong');
    expect(await screen.findByText(/not found or link is invalid/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd react && npx vitest run src/routes/Cancel.test.tsx`
Expected: FAIL — stub has none of this.

- [ ] **Step 3: Replace `react/src/routes/Cancel.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOrder, cancelOrder } from '../api/client';
import { gbp } from '../money';
import type { PublicOrder } from '../types';

type View =
  | { kind: 'loading' }
  | { kind: 'invalid'; message: string }
  | { kind: 'loaded'; order: PublicOrder }
  | { kind: 'cancelled'; order: PublicOrder };

export default function Cancel() {
  const [params] = useSearchParams();
  const ref = params.get('ref') || '';
  const token = params.get('token') || '';
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ref || !token) { setView({ kind: 'invalid', message: 'This cancellation link is invalid or has expired.' }); return; }
    getOrder(ref, token)
      .then((order) => setView({ kind: 'loaded', order }))
      .catch((e) => setView({ kind: 'invalid', message: e.message }));
  }, [ref, token]);

  async function doCancel(order: PublicOrder) {
    setBusy(true);
    try {
      await cancelOrder(ref, token);
      setView({ kind: 'cancelled', order: { ...order, status: 'cancelled', cancellable: false } });
    } catch (e) {
      setView({ kind: 'invalid', message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (view.kind === 'loading') return <p className="state-msg">Loading your order…</p>;
  if (view.kind === 'invalid') return <div className="sheet-panel"><h2 className="sheet-title">Cancel your order</h2><p>{view.message}</p></div>;

  const order = view.order;
  return (
    <div className="sheet-panel">
      <h2 className="sheet-title">Order {order.ref}</h2>
      {view.kind === 'cancelled' && <p className="cancelled-note">Your order has been cancelled. A confirmation email is on its way.</p>}
      <p className="muted">Hi {order.name} — status: <strong>{order.status}</strong> · required {order.required_date}</p>
      <ul className="cancel-items">
        {order.items.map((it) => <li key={it.item_id}>{it.qty} × {it.name} — {gbp(it.price * it.qty)}</li>)}
      </ul>
      <p className="totals grand"><span>Total</span> <span>{gbp(order.total)}</span></p>
      {view.kind === 'loaded' && order.cancellable && (
        <button className="submit-btn" disabled={busy} onClick={() => doCancel(order)}>
          {busy ? 'Cancelling…' : 'Cancel my order'}
        </button>
      )}
      {view.kind === 'loaded' && !order.cancellable && (
        <p className="muted">This order can no longer be cancelled online. Please contact us at BakedbyPrii@gmail.com or +44 7732 262999.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Append styles to `react/src/styles/global.css`**

```css
.cancel-items { list-style: none; margin: 1rem 0; display: grid; gap: 0.3rem; color: var(--muted-color); }
.cancelled-note { color: #cdefd0; background: rgba(40,120,70,0.3); border: 1px solid rgba(120,220,150,0.4); padding: 0.7rem 0.9rem; border-radius: 10px; margin-bottom: 1rem; }
```

- [ ] **Step 5: Run the cancel tests**

Run: `cd react && npx vitest run src/routes/Cancel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Manually verify with a real token**

Place an order with SMTP configured (or read the `cancel_token` from `data/bakery.db`), then open `/cancel?ref=BBP-…&token=…`. Confirm a bad token shows the invalid message and a good token cancels (Node logs `[cancel] BBP-… cancelled by customer`).

- [ ] **Step 7: Commit**

```bash
git add react/src/routes/Cancel.tsx react/src/routes/Cancel.test.tsx react/src/styles/global.css
git commit -m "feat: token-gated customer cancel flow"
```

---

## Task 12: Admin dashboard (key entry, list, status change)

**Files:**
- Modify: `react/src/routes/Admin.tsx`
- Test: `react/src/routes/Admin.test.tsx`

**Interfaces:**
- Consumes: `adminListOrders`, `adminSetStatus` (Task 2), `gbp` (Task 6), `AdminOrder`/`AdminStats`/`Status` (Task 2).
- Produces: a key-entry gate storing the key in `sessionStorage` (`bbp-admin-key`); on success, a stats row and an orders table with a status `<select>` per order that calls `adminSetStatus`. A 401 clears the key and returns to the gate with an error.

- [ ] **Step 1: Write the failing test `react/src/routes/Admin.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/handlers';
import Admin from './Admin';

const adminOrder = {
  ref: 'BBP-ABCD', created_at: '2026-07-16T10:00:00Z', name: 'Sam', email: 's@e.co', phone: '1',
  notes: null, fulfilment: 'collection', address: null, postcode: null, required_date: '2026-08-01',
  payment: 'cash', subtotal: 5.5, delivery_fee: 0, total: 5.5, status: 'new',
  items: [{ item_id: 'ck-chocchip', name: 'Chocolate Chip Cookie', price: 2.75, qty: 2 }],
};
const stats = { total: 1, new: 1, revenue: 5.5 };

describe('Admin', () => {
  beforeEach(() => sessionStorage.clear());

  it('rejects a wrong key with a 401 message', async () => {
    server.use(http.get('/api/admin/orders', () => HttpResponse.json({ ok: false, error: 'Unauthorised' }, { status: 401 })));
    render(<Admin />);
    await userEvent.type(screen.getByLabelText(/admin key/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/incorrect admin key/i)).toBeInTheDocument();
  });

  it('lists orders and changes a status', async () => {
    let patched = '';
    server.use(
      http.get('/api/admin/orders', () => HttpResponse.json({ ok: true, orders: [adminOrder], stats })),
      http.patch('/api/admin/orders/:ref', async ({ request }) => {
        patched = ((await request.json()) as { status: string }).status;
        return HttpResponse.json({ ok: true });
      }),
    );
    render(<Admin />);
    await userEvent.type(screen.getByLabelText(/admin key/i), 'bakedbyprii-admin');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('BBP-ABCD')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/status for BBP-ABCD/i), 'confirmed');
    expect(patched).toBe('confirmed');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd react && npx vitest run src/routes/Admin.test.tsx`
Expected: FAIL — stub only.

- [ ] **Step 3: Replace `react/src/routes/Admin.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { adminListOrders, adminSetStatus } from '../api/client';
import { gbp } from '../money';
import { ApiError, type AdminOrder, type AdminStats, type Status } from '../types';

const KEY_STORAGE = 'bbp-admin-key';
const STATUSES: Status[] = ['new', 'confirmed', 'completed', 'cancelled'];

export default function Admin() {
  const [key, setKey] = useState<string>(() => sessionStorage.getItem(KEY_STORAGE) || '');
  const [authed, setAuthed] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((k: string) => {
    adminListOrders(k)
      .then(({ orders, stats }) => { setOrders(orders); setStats(stats); setAuthed(true); setError(null); })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          sessionStorage.removeItem(KEY_STORAGE); setKey(''); setAuthed(false);
          setError('Incorrect admin key.');
        } else setError((e as Error).message);
      });
  }, []);

  useEffect(() => { if (key) load(key); }, [key, load]);

  function signIn(e: React.FormEvent) {
    e.preventDefault();
    sessionStorage.setItem(KEY_STORAGE, keyInput);
    setKey(keyInput);
  }

  async function changeStatus(ref: string, status: Status) {
    try {
      await adminSetStatus(ref, status, key);
      load(key);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { sessionStorage.removeItem(KEY_STORAGE); setKey(''); setAuthed(false); setError('Incorrect admin key.'); }
      else setError((e as Error).message);
    }
  }

  if (!authed) {
    return (
      <form className="sheet-panel admin-login" onSubmit={signIn}>
        <h2 className="sheet-title">Admin</h2>
        <label htmlFor="admin-key">Admin key</label>
        <input id="admin-key" type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="submit-btn" type="submit">Sign in</button>
      </form>
    );
  }

  return (
    <div>
      <h2 className="sheet-title">Orders</h2>
      {stats && (
        <div className="admin-stats">
          <div><span>{stats.total}</span> orders</div>
          <div><span>{stats.new}</span> new</div>
          <div><span>{gbp(stats.revenue)}</span> revenue</div>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="admin-table">
        {orders.map((o) => (
          <div key={o.ref} className="admin-row">
            <div className="admin-cell ref">{o.ref}</div>
            <div className="admin-cell">{o.name}<br /><span className="muted">{o.fulfilment} · {o.required_date}</span></div>
            <div className="admin-cell">{o.items.map((it) => `${it.qty}×${it.name}`).join(', ')}</div>
            <div className="admin-cell">{gbp(o.total)}</div>
            <div className="admin-cell">
              <label className="visually-hidden" htmlFor={`st-${o.ref}`}>Status for {o.ref}</label>
              <select id={`st-${o.ref}`} value={o.status} onChange={(e) => changeStatus(o.ref, e.target.value as Status)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Append admin styles to `react/src/styles/global.css`**

```css
.admin-login { max-width: 360px; }
.admin-login input { width: 100%; padding: 0.6rem 0.7rem; border-radius: 10px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.04); color: #fff; margin: 0.4rem 0 0.9rem; }
.admin-stats { display: flex; gap: 1rem; margin-bottom: 1.4rem; }
.admin-stats div { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 12px; padding: 0.8rem 1.1rem; color: var(--muted-color); }
.admin-stats span { display: block; font-size: 1.4rem; color: var(--text-color); font-weight: 700; }
.admin-table { display: grid; gap: 0.5rem; }
.admin-row { display: grid; grid-template-columns: 6rem 1.4fr 2fr 5rem 8rem; gap: 0.8rem; align-items: center; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 12px; padding: 0.7rem 0.9rem; }
.admin-cell.ref { color: var(--accent); font-weight: 600; }
.admin-row select { padding: 0.4rem; border-radius: 8px; background: rgba(255,255,255,0.06); color: #fff; border: 1px solid var(--glass-border); }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
```

- [ ] **Step 5: Run the admin tests**

Run: `cd react && npx vitest run src/routes/Admin.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Manually verify against Node**

Open `/admin`, enter `bakedbyprii-admin` (the dev `ADMIN_KEY`). Confirm the orders you placed appear with stats, changing a status persists (reload shows it) and Node sends the status email. A wrong key shows "Incorrect admin key."

- [ ] **Step 7: Commit**

```bash
git add react/src/routes/Admin.tsx react/src/routes/Admin.test.tsx react/src/styles/global.css
git commit -m "feat: admin dashboard with key gate and status changes"
```

---

## Task 13: Static pages — Legal, Custom Orders (demo), Reviews

**Files:**
- Create: `react/src/content/legalDocs.ts`
- Modify: `react/src/routes/Legal.tsx`, `react/src/routes/Custom.tsx`, `react/src/routes/Reviews.tsx`
- Test: `react/src/routes/Legal.test.tsx`, `react/src/routes/Custom.test.tsx`

**Interfaces:**
- Consumes: `BESPOKE` (Task 5), `Sheet` (Task 4).
- Produces: `legalDocs.ts` with `LEGAL_DOCS: Record<string, { eyebrow: string; title: string; bodyHtml: string }>`; a Legal page rendering the doc for `:doc` (404 for unknown); a Custom page that shows bespoke items and a demo enquiry form which never submits to a server (shows a thank-you inline); a Reviews page with static testimonials.

- [ ] **Step 1: Write `react/src/routes/Legal.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Legal from './Legal';

const renderDoc = (doc: string) => render(
  <MemoryRouter initialEntries={[`/legal/${doc}`]}>
    <Routes><Route path="/legal/:doc" element={<Legal />} /></Routes>
  </MemoryRouter>,
);

describe('Legal', () => {
  it('renders a known doc', () => {
    renderDoc('privacy');
    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
  });
  it('shows not-found for an unknown doc', () => {
    renderDoc('banana');
    expect(screen.getByRole('heading', { name: /not found/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write `react/src/routes/Custom.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Custom from './Custom';

describe('Custom', () => {
  it('lists bespoke items and shows a thank-you without hitting a server', async () => {
    render(<MemoryRouter><Custom /></MemoryRouter>);
    expect(screen.getByText('Wedding Tiers')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/your name/i), 'Sam');
    await userEvent.type(screen.getByLabelText(/email/i), 'sam@example.com');
    await userEvent.type(screen.getByLabelText(/about your cake/i), 'A three-tier lemon cake');
    await userEvent.click(screen.getByRole('button', { name: /send enquiry/i }));
    expect(screen.getByText(/thank you/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run both to confirm they fail**

Run: `cd react && npx vitest run src/routes/Legal.test.tsx src/routes/Custom.test.tsx`
Expected: FAIL — stubs only.

- [ ] **Step 4: Create `react/src/content/legalDocs.ts`** (text adapted from the current site; the MSW `onUnhandledRequest:'error'` rule is not relevant — these pages make no requests)

```ts
export interface LegalDoc { eyebrow: string; title: string; bodyHtml: string; }

const CONTACT = 'BakedbyPrii@gmail.com';

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  allergens: {
    eyebrow: 'Food Information Regulations 2014', title: 'Allergen Information',
    bodyHtml: `<p>We provide full allergen information for everything we bake. If you have a food allergy or intolerance, please tell us <strong>before you order</strong>.</p>
      <h3>Cross-contamination</h3>
      <p>Our bakes are made in a kitchen that handles <strong>gluten, eggs, milk, soya, nuts and peanuts</strong>. We cannot guarantee any product is completely free from any allergen.</p>
      <h3>Ask us</h3>
      <p>Full ingredient breakdowns are available on request — contact <a href="mailto:${CONTACT}">${CONTACT}</a> before ordering.</p>`,
  },
  delivery: {
    eyebrow: 'Collection & Didcot delivery', title: 'Delivery & Returns',
    bodyHtml: `<h3>Collection</h3><p>bakedbyPrii is a home-based bakery in Didcot. Collection is <strong>free</strong>. We share the address and a time when we confirm your order.</p>
      <h3>Delivery</h3><p>We deliver <strong>within Didcot (OX11) only</strong>. Delivery is <strong>free on orders over £20</strong>; otherwise a £2.50 charge applies.</p>
      <h3>Cancelling</h3><p>While your order is still awaiting confirmation you can cancel it instantly and free using the “Cancel my order” link in your confirmation email.</p>`,
  },
  privacy: {
    eyebrow: 'UK GDPR & Data Protection Act 2018', title: 'Privacy Policy',
    bodyHtml: `<p>This policy explains how bakedbyPrii collects and uses your personal data, in line with the UK GDPR.</p>
      <h3>What we collect</h3><ul><li>Your name, email, phone and delivery address</li><li>Order details, including any allergy information you give us</li></ul>
      <h3>Your rights</h3><p>You have the right to access, correct or delete your data. Contact <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`,
  },
  terms: {
    eyebrow: 'The important bit', title: 'Terms & Conditions',
    bodyHtml: `<h3>Orders</h3><p>An order is a request to buy; a contract is formed only when we confirm acceptance. Standard orders require 48 hours' notice; custom orders at least 5 working days.</p>
      <h3>Prices & payment</h3><p>Prices are in GBP. No payment is taken on this website; we arrange payment once your order is confirmed.</p>
      <h3>Your rights</h3><p>Nothing in these terms affects your statutory rights under the Consumer Rights Act 2015.</p>`,
  },
};
```

- [ ] **Step 5: Replace `react/src/routes/Legal.tsx`**

```tsx
import { useParams } from 'react-router-dom';
import { LEGAL_DOCS } from '../content/legalDocs';

export default function Legal() {
  const { doc = '' } = useParams();
  const data = LEGAL_DOCS[doc];
  if (!data) return <h2 className="sheet-title">Not found</h2>;
  return (
    <article className="sheet-panel legal">
      <span className="sheet-eyebrow">{data.eyebrow}</span>
      <h2 className="sheet-title">{data.title}</h2>
      <div dangerouslySetInnerHTML={{ __html: data.bodyHtml }} />
    </article>
  );
}
```

Note: `dangerouslySetInnerHTML` is safe here because `LEGAL_DOCS` is static, developer-authored constant content — no user input reaches it.

- [ ] **Step 6: Replace `react/src/routes/Custom.tsx`**

```tsx
import { useState } from 'react';
import { BESPOKE } from '../content/bespoke';

export default function Custom() {
  const [sent, setSent] = useState(false);
  return (
    <div>
      <span className="sheet-eyebrow">Made just for you</span>
      <h2 className="sheet-title">Custom Orders</h2>
      <p className="muted" style={{ maxWidth: '60ch' }}>
        Celebration cakes, dessert tables and bespoke bakes for any occasion. We ask for at least
        <strong> 5 working days'</strong> notice (more for tiered/wedding cakes).
      </p>
      <div className="menu-grid" style={{ margin: '1.5rem 0' }}>
        {BESPOKE.map((b) => (
          <div key={b.name} className="menu-card">
            <div className="row"><h4>{b.name}</h4><span className="price">{b.price}</span></div>
            <p>{b.blurb}</p>
            <span className="tags">{b.tag}</span>
          </div>
        ))}
      </div>
      <h3 className="group-heading">Start your enquiry</h3>
      {sent ? (
        <p className="cancelled-note">Thank you! Your enquiry is noted. We aim to reply within 1 working day. (This demo form does not send email — please also contact BakedbyPrii@gmail.com.)</p>
      ) : (
        <form className="form glass-block" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
          <div><label htmlFor="c-name">Your name</label><input id="c-name" required /></div>
          <div><label htmlFor="c-email">Email</label><input id="c-email" type="email" required /></div>
          <div><label htmlFor="c-phone">Phone (optional)</label><input id="c-phone" type="tel" /></div>
          <div><label htmlFor="c-date">Event date</label><input id="c-date" type="date" /></div>
          <div className="full"><label htmlFor="c-details">Tell us about your cake</label><textarea id="c-details" required placeholder="Occasion, servings, flavours, theme, any allergies…" /></div>
          <button type="submit" className="submit-btn">Send enquiry</button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Replace `react/src/routes/Reviews.tsx`**

```tsx
const REVIEWS = [
  { name: 'Hannah', text: 'The Biscoff stuffed cookies were unreal — gone in minutes at the party.' },
  { name: 'Priya', text: 'Ordered a red velvet cake for my mum’s birthday. Beautiful and delicious.' },
  { name: 'Tom', text: 'Reliable, local and the brownies are the fudgiest I’ve had.' },
];

export default function Reviews() {
  return (
    <div>
      <span className="sheet-eyebrow">Kind words</span>
      <h2 className="sheet-title">Reviews</h2>
      <div className="menu-grid">
        {REVIEWS.map((r) => (
          <blockquote key={r.name} className="menu-card">
            <p>“{r.text}”</p>
            <span className="tags">— {r.name}</span>
          </blockquote>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Append legal styles to `react/src/styles/global.css`**

```css
.legal h3 { font-family: var(--font-heading); margin: 1.1rem 0 0.4rem; }
.legal p, .legal li { color: var(--muted-color); margin-bottom: 0.5rem; }
.legal ul { padding-left: 1.2rem; }
.legal a { color: var(--accent); }
```

- [ ] **Step 9: Run the static-page tests**

Run: `cd react && npx vitest run src/routes/Legal.test.tsx src/routes/Custom.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 10: Commit**

```bash
git add react/src/content/legalDocs.ts react/src/routes/Legal.tsx react/src/routes/Custom.tsx react/src/routes/Reviews.tsx react/src/routes/Legal.test.tsx react/src/routes/Custom.test.tsx react/src/styles/global.css
git commit -m "feat: legal, custom-orders demo, and reviews pages"
```

---

## Task 14: Full-suite green, typecheck, README, and final verification

**Files:**
- Create: `react/README.md`
- Verify only: everything.

**Interfaces:** none produced; this task proves the whole app.

- [ ] **Step 1: Run the entire test suite**

Run: `cd react && npm test`
Expected: all suites PASS (types, cart, content, money, MenuCard, App routing, Menu, Home, checkoutValidation, Checkout, OrderConfirmation, Cancel, Admin, Legal, Custom).

- [ ] **Step 2: Typecheck and production build**

Run: `cd react && npm run build`
Expected: `tsc -b` reports no errors and Vite writes `dist/`. Fix any type errors before proceeding.

- [ ] **Step 3: Create `react/README.md`**

```markdown
# bakedbyPrii — React frontend

A React + TypeScript storefront, checkout, customer cancel flow, and admin
dashboard for bakedbyPrii. It is a **frontend only** — all pricing, validation
and auth stay in the Node API (`../server.js`). The menu is fetched from
`GET /api/menu`, so it is the single source of truth for prices and items.

## Run it

Two processes, both from the repo root layout:

```bash
# Terminal 1 — the Node API (port 3000)
npm install && npm start

# Terminal 2 — the React app (port 5173)
cd react && npm install && npm run dev
```

Open http://localhost:5173. Vite proxies `/api/*` to the Node server on 3000,
so there is no CORS setup and `server.js` is never modified.

Admin: http://localhost:5173/admin — dev key `bakedbyprii-admin` (matches the
Node app's default `ADMIN_KEY`).

## Test

```bash
cd react && npm test        # Vitest + React Testing Library + MSW
npm run build               # typecheck (tsc -b) + production build
```

## What lives where

- `src/api/client.ts` — the only file that calls `fetch`.
- `src/cart/` — cart reducer (quantities only) + context; prices never appear here.
- `src/content/` — marketing copy, bespoke items, category themes, legal text.
- `src/routes/` — one file per page.
- `src/components/` — presentational pieces.

## Known boundaries

- Menu descriptions/tags live in `src/content/menuContent.ts` because
  `/api/menu` returns only facts (name, price, allergens). Facts win on conflict.
- The Custom Orders form is a demo — it does not send email (no enquiry API).
- The order confirmation page renders from router state; a hard reload shows a
  ref-only fallback, because the cancel token is emailed, not returned by the
  create-order call.
```

- [ ] **Step 4: End-to-end pass against the real Node server**

With Node on 3000 and Vite on 5173, in the browser:
1. `/menu` renders the full seeded menu; steppers update the header count.
2. Edit one price in `lib/db.js`, delete `data/bakery.db*`, restart Node; `/menu` reflects the new price with no React change. **This proves the single-source-of-truth goal.** (Restore `lib/db.js` afterward — it must stay unmodified.)
3. Place a collection order → `/order/BBP-…` shows ref + total; cart empties.
4. Place a delivery order with `RG1 1AA` → rejected inline, cart preserved; retry with `OX11 7AA` → succeeds.
5. `/admin` with the dev key → order appears; change status → persists on reload.
6. `/cancel?ref=…&token=…` with a bad token → invalid message; with the real token → cancels.

- [ ] **Step 5: Confirm no file outside `react/` and `docs/` changed**

Run: `git status --porcelain && git diff --stat master -- server.js lib public render.yaml`
Expected: the diff against `master` for those paths is **empty**. Only `react/` (and this plan under `docs/`) is new. If `lib/db.js` shows a diff from Step 4, `git checkout master -- lib/db.js`.

- [ ] **Step 6: Commit**

```bash
git add react/README.md
git commit -m "docs: add react/ README and finalise frontend"
```

---

## Self-Review notes (for the executor)

- **Spec coverage:** every spec section maps to a task — API contract → T2; cart qty-only → T3; brand/layout/routes → T4; content gap → T5/T13; menu single-source → T7 (proven in T14 step 4.2); home themes → T8; checkout + validation + repricing → T9; confirmation deep-link limitation → T10; token cancel → T11; admin + `PATCH` → T12; legal/custom/reviews + static bespoke → T13; error/empty states → T7/T9/T11/T12; testing strategy → every task + T14.
- **No Node edits:** enforced by T14 step 5 and every commit's `git status` habit.
- **Type consistency:** `MenuItem`, `PublicOrder`, `AdminOrder`, `CreateOrderResult`, `Status`, `Payment`, `Fulfilment`, `CheckoutForm`, `Cart`, `ApiError` are defined once (T2/T3/T9) and reused by name throughout.
