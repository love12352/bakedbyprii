import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from '../cart/CartContext';
import { server } from '../test/mocks/handlers';
import Checkout from './Checkout';

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

function renderCheckout() {
  localStorage.setItem('bbp-cart', JSON.stringify({ 'ck-chocchip': 2 }));
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={['/checkout']} future={ROUTER_FUTURE}>
        <Routes>
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:ref" element={<h2>Order placed</h2>} />
        </Routes>
      </MemoryRouter>
    </CartProvider>,
  );
}

describe('Checkout', () => {
  beforeEach(() => localStorage.clear());

  // Without the menu there are no prices, so the form must not render: it would
  // show "Place order · £0.00", post an empty items array, and answer with the
  // server's "add at least one item" while the customer's cart sits untouched.
  it('offers a retry instead of a £0.00 order when the menu fails to load', async () => {
    server.use(http.get('/api/menu', () => HttpResponse.json({ ok: false, error: 'boom' }, { status: 500 })));
    renderCheckout();
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /place order/i })).not.toBeInTheDocument();
    expect(screen.getByText(/basket is safe/i)).toBeInTheDocument();
    // The cart itself must survive — this is a pricing failure, not an empty basket.
    expect(screen.queryByText(/basket is empty/i)).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('bbp-cart')!)).toEqual({ 'ck-chocchip': 2 });
  });

  it('lists cart lines and a total from the menu', async () => {
    renderCheckout();
    expect(await screen.findByText('Chocolate Chip Cookie')).toBeInTheDocument();
    // 2 × £2.75 — subtotal and total (collection, no delivery fee) must both read £5.50.
    expect(within(screen.getByTestId('row-subtotal')).getByText('£5.50')).toBeInTheDocument();
    expect(within(screen.getByTestId('row-total')).getByText('£5.50')).toBeInTheDocument();
  });

  it('shows the server error inline and keeps the cart', async () => {
    server.use(http.post('/api/orders', () => HttpResponse.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 })));
    renderCheckout();
    await screen.findByText('Chocolate Chip Cookie');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sam');
    await userEvent.type(screen.getByLabelText('Email'), 'sam@example.com');
    await userEvent.type(screen.getByLabelText('Phone'), '07700900000');
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid email/i);
    expect(screen.getByText('Chocolate Chip Cookie')).toBeInTheDocument();
  });

  it('navigates to confirmation on success', async () => {
    renderCheckout();
    await screen.findByText('Chocolate Chip Cookie');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sam');
    await userEvent.type(screen.getByLabelText('Email'), 'sam@example.com');
    await userEvent.type(screen.getByLabelText('Phone'), '07700900000');
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByRole('heading', { name: /order placed/i })).toBeInTheDocument();
  });

  // Pins the user-facing property: two clicks must never place two orders.
  // Caveat: in jsdom React flushes discrete click events synchronously, so the
  // button's disabled prop already blocks the second click and this passes with
  // or without submit()'s submittingRef guard. The guard covers real browsers,
  // where the commit can lag the second click, and is not isolated by any test.
  it('places exactly one order when Place order is double-clicked', async () => {
    let postCount = 0;
    server.use(http.post('/api/orders', () => {
      postCount++;
      return HttpResponse.json({ ok: true, ref: 'BBP-TEST', subtotal: 2.75, delivery_fee: 0, total: 2.75, payment: 'cash', fulfilment: 'collection' });
    }));
    renderCheckout();
    await screen.findByText('Chocolate Chip Cookie');
    await userEvent.type(screen.getByLabelText('Your name'), 'Sam');
    await userEvent.type(screen.getByLabelText('Email'), 'sam@example.com');
    await userEvent.type(screen.getByLabelText('Phone'), '07700900000');
    const button = screen.getByRole('button', { name: /place order/i });
    // Fire two clicks in rapid succession without awaiting between them
    userEvent.click(button);
    userEvent.click(button);
    // Wait for navigation to confirm the order was placed
    expect(await screen.findByRole('heading', { name: /order placed/i })).toBeInTheDocument();
    // Assert exactly one POST was made
    expect(postCount).toBe(1);
  });
});
