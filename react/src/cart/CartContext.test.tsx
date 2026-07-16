import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CartProvider, useCart } from './CartContext';

const STORAGE_KEY = 'bbp-cart';

describe('CartContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('useCart outside CartProvider', () => {
    it('throws a clear error when called outside CartProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useCart());
      }).toThrow('useCart must be used within CartProvider');

      consoleError.mockRestore();
    });
  });

  describe('CartProvider mutations', () => {
    it('reflects inc through cart and count', () => {
      const { result } = renderHook(() => useCart(), {
        wrapper: CartProvider,
      });

      expect(result.current.cart).toEqual({});
      expect(result.current.count).toBe(0);

      act(() => {
        result.current.inc('item-a');
      });

      expect(result.current.cart).toEqual({ 'item-a': 1 });
      expect(result.current.count).toBe(1);

      act(() => {
        result.current.inc('item-a');
      });

      expect(result.current.cart).toEqual({ 'item-a': 2 });
      expect(result.current.count).toBe(2);
    });

    it('reflects dec through cart and count', () => {
      const { result } = renderHook(() => useCart(), {
        wrapper: CartProvider,
      });

      act(() => {
        result.current.inc('item-a');
        result.current.inc('item-a');
      });

      expect(result.current.count).toBe(2);

      act(() => {
        result.current.dec('item-a');
      });

      expect(result.current.cart).toEqual({ 'item-a': 1 });
      expect(result.current.count).toBe(1);

      act(() => {
        result.current.dec('item-a');
      });

      expect(result.current.cart).toEqual({});
      expect(result.current.count).toBe(0);
    });

    it('reflects setQty through cart and count', () => {
      const { result } = renderHook(() => useCart(), {
        wrapper: CartProvider,
      });

      act(() => {
        result.current.setQty('item-a', 5);
      });

      expect(result.current.cart).toEqual({ 'item-a': 5 });
      expect(result.current.count).toBe(5);

      act(() => {
        result.current.setQty('item-a', 3);
      });

      expect(result.current.cart).toEqual({ 'item-a': 3 });
      expect(result.current.count).toBe(3);
    });

    it('reflects clear through cart and count', () => {
      const { result } = renderHook(() => useCart(), {
        wrapper: CartProvider,
      });

      act(() => {
        result.current.inc('item-a');
        result.current.inc('item-b');
      });

      expect(result.current.count).toBe(2);

      act(() => {
        result.current.clear();
      });

      expect(result.current.cart).toEqual({});
      expect(result.current.count).toBe(0);
    });

    it('handles multiple items correctly', () => {
      const { result } = renderHook(() => useCart(), {
        wrapper: CartProvider,
      });

      act(() => {
        result.current.setQty('item-a', 2);
        result.current.setQty('item-b', 3);
        result.current.setQty('item-c', 1);
      });

      expect(result.current.cart).toEqual({
        'item-a': 2,
        'item-b': 3,
        'item-c': 1,
      });
      expect(result.current.count).toBe(6);
    });
  });

  describe('localStorage persistence', () => {
    it('persists cart state to localStorage', () => {
      const { result } = renderHook(() => useCart(), {
        wrapper: CartProvider,
      });

      act(() => {
        result.current.setQty('item-a', 5);
        result.current.setQty('item-b', 3);
      });

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).toBe(JSON.stringify({ 'item-a': 5, 'item-b': 3 }));
    });

    it('rehydrates cart from localStorage on mount', () => {
      // Set up localStorage with initial data
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'item-x': 7, 'item-y': 2 }));

      // Mount a new provider and hook
      const { result } = renderHook(() => useCart(), {
        wrapper: CartProvider,
      });

      expect(result.current.cart).toEqual({ 'item-x': 7, 'item-y': 2 });
      expect(result.current.count).toBe(9);
    });

    it('round-trips: mount, mutate, unmount, remount', () => {
      // First mount: add items
      const { unmount } = renderHook(() => useCart(), {
        wrapper: CartProvider,
        initialProps: undefined,
      });

      // We need to get the hook to interact with it
      let hookResult: any;
      const { result } = renderHook(() => useCart(), {
        wrapper: CartProvider,
      });

      act(() => {
        result.current.setQty('item-1', 4);
        result.current.setQty('item-2', 6);
      });

      // Verify it was stored
      expect(localStorage.getItem(STORAGE_KEY)).toBe(
        JSON.stringify({ 'item-1': 4, 'item-2': 6 })
      );

      // Unmount and clear the hook to force a fresh instance
      // (In a real app, unmounting destroys the provider)
      // Simulate this by creating a fresh render context

      // Clear and set fresh storage to simulate a new app instance
      // (In this test, we just create a new hook instance)

      // Now mount a fresh provider and verify it rehydrates
      const { result: result2 } = renderHook(() => useCart(), {
        wrapper: CartProvider,
      });

      expect(result2.current.cart).toEqual({ 'item-1': 4, 'item-2': 6 });
      expect(result2.current.count).toBe(10);

      // Verify mutations on the new instance also persist
      act(() => {
        result2.current.inc('item-1');
      });

      expect(result2.current.cart).toEqual({ 'item-1': 5, 'item-2': 6 });
      expect(localStorage.getItem(STORAGE_KEY)).toBe(
        JSON.stringify({ 'item-1': 5, 'item-2': 6 })
      );
    });
  });

  describe('corrupt localStorage', () => {
    it('gracefully handles invalid JSON in localStorage', () => {
      localStorage.setItem(STORAGE_KEY, 'not json at all');

      const { result } = renderHook(() => useCart(), {
        wrapper: CartProvider,
      });

      expect(result.current.cart).toEqual({});
      expect(result.current.count).toBe(0);
    });

    it('gracefully handles null in localStorage', () => {
      localStorage.setItem(STORAGE_KEY, 'null');

      const { result } = renderHook(() => useCart(), {
        wrapper: CartProvider,
      });

      expect(result.current.cart).toEqual({});
      expect(result.current.count).toBe(0);
    });

    it('gracefully handles non-object JSON in localStorage', () => {
      localStorage.setItem(STORAGE_KEY, '"string value"');

      const { result } = renderHook(() => useCart(), {
        wrapper: CartProvider,
      });

      expect(result.current.cart).toEqual({});
      expect(result.current.count).toBe(0);
    });
  });
});
