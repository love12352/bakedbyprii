import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from '../cart/CartContext';
import OrderConfirmation from './OrderConfirmation';

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

const result = { ref: 'BBP-ABCD', subtotal: 5.5, delivery_fee: 0, total: 5.5, payment: 'cash', fulfilment: 'collection' };

function renderAt(state: unknown) {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={[{ pathname: '/order/BBP-ABCD', state }]} future={ROUTER_FUTURE}>
        <Routes><Route path="/order/:ref" element={<OrderConfirmation />} /></Routes>
      </MemoryRouter>
    </CartProvider>,
  );
}

describe('OrderConfirmation', () => {
  it('shows the ref and total from router state', () => {
    renderAt({ result });
    expect(screen.getByText('BBP-ABCD')).toBeInTheDocument();
    expect(screen.getByText('Total').closest('div')).toHaveTextContent('£5.50');
  });

  it('falls back to a ref-only message when state is missing (hard reload)', () => {
    renderAt(null);
    expect(screen.getByText('BBP-ABCD')).toBeInTheDocument();
    expect(screen.getByText(/in your email/i)).toBeInTheDocument();
  });
});
