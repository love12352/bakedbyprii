import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
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

  // Memoised so the callbacks keep a stable identity. Without this, any
  // consumer with `clear` in an effect's deps re-runs that effect every
  // render — and since the reducer's 'clear' returns a fresh {} each time,
  // that effect would loop forever. OrderConfirmation depends on this.
  const api: CartApi = useMemo(() => ({
    cart,
    count: cartCount(cart),
    inc: (id) => dispatch({ type: 'inc', id }),
    dec: (id) => dispatch({ type: 'dec', id }),
    setQty: (id, qty) => dispatch({ type: 'set', id, qty }),
    clear: () => dispatch({ type: 'clear' }),
  }), [cart]);
  return <CartCtx.Provider value={api}>{children}</CartCtx.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
