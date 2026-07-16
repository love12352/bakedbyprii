import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('lists cart lines and a total from the menu', async () => {
    renderCheckout();
    expect(await screen.findByText('Chocolate Chip Cookie')).toBeInTheDocument();
    expect(screen.getByText('£5.50')).toBeInTheDocument(); // 2 × 2.75
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
});
