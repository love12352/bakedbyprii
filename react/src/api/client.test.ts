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
