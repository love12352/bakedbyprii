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
