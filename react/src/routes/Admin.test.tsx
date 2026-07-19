import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
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

  it('retries the load when signing in again with the same key after a non-401 failure', async () => {
    let calls = 0;
    server.use(
      http.get('/api/admin/orders', () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ ok: false, error: 'Server exploded' }, { status: 500 });
        }
        return HttpResponse.json({ ok: true, orders: [adminOrder], stats });
      }),
    );
    render(<Admin />);
    await userEvent.type(screen.getByLabelText(/admin key/i), 'bakedbyprii-admin');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/server exploded/i)).toBeInTheDocument();

    // Retry without changing the input — must actually fire a second request.
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText('BBP-ABCD')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  // The baker rings and emails customers from this table, and the checkout tells
  // customers to put allergies in the notes — so all three must reach the screen.
  it('shows the customer email, phone and order notes', async () => {
    // A realistic phone, not the shared fixture's '1', which also matches the stats row.
    const withNotes = { ...adminOrder, phone: '07700900123', notes: 'Severe nut allergy — please keep separate' };
    server.use(http.get('/api/admin/orders', () => HttpResponse.json({ ok: true, orders: [withNotes], stats })));
    render(<Admin />);
    await userEvent.type(screen.getByLabelText(/admin key/i), 'bakedbyprii-admin');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('s@e.co')).toBeInTheDocument();
    expect(screen.getByText('07700900123')).toBeInTheDocument();
    expect(screen.getByText(/severe nut allergy/i)).toBeInTheDocument();
  });

  // load() fires from the effect and from every status change, so a slow early
  // response can land after a newer one and repaint the table with stale rows.
  it('ignores a slow response that a newer load has superseded', async () => {
    let call = 0;
    server.use(http.get('/api/admin/orders', async () => {
      const i = call++;
      if (i === 0) {
        // The first load is slow and carries the OLD name.
        await new Promise((r) => setTimeout(r, 80));
        return HttpResponse.json({ ok: true, orders: [{ ...adminOrder, name: 'Stale Sam' }], stats });
      }
      return HttpResponse.json({ ok: true, orders: [{ ...adminOrder, name: 'Fresh Sam' }], stats });
    }));

    render(<Admin />);
    await userEvent.type(screen.getByLabelText(/admin key/i), 'bakedbyprii-admin');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    // Sign in again: a second, faster load supersedes the in-flight first one.
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Fresh Sam')).toBeInTheDocument();
    // Wait past the slow response's delay so it has settled.
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    expect(screen.getByText('Fresh Sam')).toBeInTheDocument();
    expect(screen.queryByText('Stale Sam')).not.toBeInTheDocument();
  });
});
