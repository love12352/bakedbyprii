import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../cart/CartContext';
import Home from './Home';

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

describe('Home page', () => {
  it('renders the brand hero and category cards with from-prices', async () => {
    render(
      <CartProvider>
        <MemoryRouter future={ROUTER_FUTURE}>
          <Home />
        </MemoryRouter>
      </CartProvider>
    );
    expect(screen.getByRole('heading', { name: /bakedbyPrii/i })).toBeInTheDocument();
    expect(await screen.findByText('Cookies')).toBeInTheDocument();
    // Chocolate Chip Cookie 2.75 is the cheapest in the fixture's Cookies group.
    expect(screen.getByText(/from £2\.75/)).toBeInTheDocument();
  });
});
