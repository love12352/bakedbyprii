import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../cart/CartContext';
import Home, { categorySummaries } from './Home';

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

describe('categorySummaries', () => {
  it('computes minimum price per category, not first-seen price', () => {
    const menu = [
      { id: 'ck-1', category: 'Cookies', name: 'Expensive Cookie', price: 3.75, allergens: '' },
      { id: 'ck-2', category: 'Cookies', name: 'Cheap Cookie', price: 2.75, allergens: '' },
      { id: 'cake-1', category: 'Cakes', name: 'Expensive Cake', price: 40.0, allergens: '' },
      { id: 'cake-2', category: 'Cakes', name: 'Cheap Cake', price: 35.0, allergens: '' },
    ];
    const result = categorySummaries(menu);
    // Should have two categories in order of first-seen (Cookies, Cakes)
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ category: 'Cookies', min: 2.75 });
    expect(result[1]).toEqual({ category: 'Cakes', min: 35.0 });
  });
});

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
