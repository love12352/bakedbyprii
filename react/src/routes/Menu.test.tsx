import { describe, it, expect } from 'vitest';
import { render, screen, renderHook, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../cart/CartContext';
import { server, menuFixture } from '../test/mocks/handlers';
import { useMenu } from '../useMenu';
import Menu from './Menu';

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
});
