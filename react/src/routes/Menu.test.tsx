import { StrictMode } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, renderHook, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../cart/CartContext';
import { server, menuFixture } from '../test/mocks/handlers';
import { useMenu } from '../useMenu';
import Menu from './Menu';

const reloadFixture = [
  { id: 'muffin-blueberry', category: 'Muffins', name: 'Blueberry Muffin', price: 3.25, allergens: 'Gluten, Egg' },
];

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

const wrap = () => render(
  <CartProvider>
    <MemoryRouter future={ROUTER_FUTURE}><Menu /></MemoryRouter>
  </CartProvider>,
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

  it('renders the menu after clicking "Try again" following a failed load', async () => {
    server.use(http.get('/api/menu', () => HttpResponse.json({ ok: false, error: 'boom' }, { status: 500 })));
    wrap();

    const retryButton = await screen.findByRole('button', { name: /try again/i });

    server.use(http.get('/api/menu', () => HttpResponse.json({ ok: true, menu: menuFixture })));
    await userEvent.click(retryButton);

    expect(await screen.findByText('Chocolate Chip Cookie')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('does not let a slow first request that later rejects clobber a faster successful reload', async () => {
    // Request #1 (the initial load) is slow and eventually fails.
    // Request #2 (fired by reload() before #1 settles) is fast and succeeds.
    // The final state must reflect the successful reload, not the stale failure.
    let call = 0;
    server.use(http.get('/api/menu', async () => {
      const idx = call++;
      if (idx === 0) {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return HttpResponse.json({ ok: false, error: 'boom' }, { status: 500 });
      }
      return HttpResponse.json({ ok: true, menu: menuFixture });
    }));

    const { result } = renderHook(() => useMenu());
    expect(result.current.loading).toBe(true);

    // Fire the reload well before the first (slow) request has had a chance to settle.
    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.menu).toEqual(menuFixture));
    expect(result.current.error).toBeNull();

    // Wait past the slow first request's rejection so its (stale) settle has run.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    expect(result.current.error).toBeNull();
    expect(result.current.menu).toEqual(menuFixture);
    expect(result.current.loading).toBe(false);
  });

  it('does not let a StrictMode-orphaned mount request reuse a generation number and clobber a later reload', async () => {
    // React 18 StrictMode (see src/main.tsx) mounts, cleans up, and remounts
    // every effect once in development, reusing the same ref instances across
    // the simulated remount. That means three /api/menu requests fire here:
    //   #1 - the first (StrictMode-simulated) mount's request: slow, rejects.
    //   #2 - the second (real) mount's request: fast, succeeds.
    //   #3 - a user-triggered reload() fired after #2 settles: fast, succeeds
    //        with different data, and must be the request that "wins".
    // The ordering of which request fires when is guaranteed by StrictMode's
    // synchronous mount/cleanup/remount (not timing), and the ordering of
    // which settles first is guaranteed by #1's explicit delay vs. #2/#3
    // resolving immediately — so this is deterministic, not timing luck.
    let call = 0;
    server.use(http.get('/api/menu', async () => {
      const idx = call++;
      if (idx === 0) {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return HttpResponse.json({ ok: false, error: 'boom' }, { status: 500 });
      }
      if (idx === 1) {
        return HttpResponse.json({ ok: true, menu: menuFixture });
      }
      return HttpResponse.json({ ok: true, menu: reloadFixture });
    }));

    const { result } = renderHook(() => useMenu(), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });

    // Wait for the second (real) StrictMode mount's request to resolve.
    await waitFor(() => expect(result.current.menu).toEqual(menuFixture));
    expect(result.current.error).toBeNull();

    // Fire a user reload well before request #1's 80ms delay elapses.
    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.menu).toEqual(reloadFixture));
    expect(result.current.error).toBeNull();

    // Wait past request #1's delay so its stale (StrictMode-orphaned)
    // rejection has had a chance to settle and, if the guard is broken,
    // clobber the reload's result.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.error).toBeNull();
    expect(result.current.menu).toEqual(reloadFixture);
    expect(result.current.loading).toBe(false);
  });
});
