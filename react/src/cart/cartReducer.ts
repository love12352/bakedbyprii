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
