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
