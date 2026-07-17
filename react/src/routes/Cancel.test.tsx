import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '../test/mocks/handlers';
import Cancel from './Cancel';

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

const order = {
  ref: 'BBP-ABCD', name: 'Sam', status: 'new', fulfilment: 'collection',
  address: null, postcode: null, required_date: '2026-08-01', payment: 'cash',
  subtotal: 5.5, delivery_fee: 0, total: 5.5,
  items: [{ item_id: 'ck-chocchip', name: 'Chocolate Chip Cookie', price: 2.75, qty: 2 }],
  created_at: '2026-07-16T10:00:00Z', cancellable: true,
};

const renderAt = (search: string) =>
  render(<MemoryRouter initialEntries={[`/cancel${search}`]} future={ROUTER_FUTURE}><Cancel /></MemoryRouter>);

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

  // Caveat: in jsdom React flushes discrete click events synchronously, so the
  // button's disabled prop already blocks the second click and this passes with
  // or without doCancel()'s cancellingRef guard. The guard covers real browsers,
  // where the commit can lag the second click, and is not isolated by any test.
  it('cancels exactly one order when Cancel my order is double-clicked', async () => {
    let postCount = 0;
    server.use(
      http.get('/api/orders/:ref', () => HttpResponse.json({ ok: true, order })),
      http.post('/api/orders/:ref/cancel', () => {
        postCount++;
        return HttpResponse.json({ ok: true });
      }),
    );
    renderAt('?ref=BBP-ABCD&token=secret');
    const button = await screen.findByRole('button', { name: /cancel my order/i });
    // Fire two clicks in rapid succession without awaiting between them
    userEvent.click(button);
    userEvent.click(button);
    // Wait for cancellation to confirm the order was cancelled
    expect(await screen.findByText(/has been cancelled/i)).toBeInTheDocument();
    // Assert exactly one POST was made
    expect(postCount).toBe(1);
  });
});
