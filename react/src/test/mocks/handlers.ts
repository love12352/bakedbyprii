import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const menuFixture = [
  { id: 'ck-chocchip', category: 'Cookies', name: 'Chocolate Chip Cookie', price: 2.75, allergens: 'Gluten, Egg, Milk, Soya' },
  { id: 'cake-vanilla', category: 'Cakes', name: 'Vanilla Buttercream Cake', price: 35.0, allergens: 'Gluten, Egg, Milk' },
];

export const handlers = [
  http.get('/api/menu', () => HttpResponse.json({ ok: true, menu: menuFixture })),
  http.post('/api/orders', () =>
    HttpResponse.json({ ok: true, ref: 'BBP-TEST', subtotal: 2.75, delivery_fee: 0, total: 2.75, payment: 'cash', fulfilment: 'collection' })),
];

export const server = setupServer(...handlers);
