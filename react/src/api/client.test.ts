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

  it('treats HTTP 200 with {ok:false} as an error', async () => {
    server.use(http.get('/api/menu', () =>
      HttpResponse.json({ ok: false, error: 'Menu unavailable.' }, { status: 200 })));
    await expect(getMenu()).rejects.toMatchObject({
      message: 'Menu unavailable.',
      status: 200
    } satisfies Partial<ApiError>);
  });

  it('handles network failures with status 0 and network error message', async () => {
    server.use(http.get('/api/menu', () => HttpResponse.error()));
    await expect(getMenu()).rejects.toMatchObject({
      message: 'Could not reach the bakery. Check your connection and try again.',
      status: 0
    } satisfies Partial<ApiError>);
  });

  it('handles non-JSON response body on success without throwing', async () => {
    server.use(http.get('/api/menu', () => new Response('plain text', { status: 200 })));
    const result = await getMenu();
    expect(result).toBe(undefined);
  });
});
