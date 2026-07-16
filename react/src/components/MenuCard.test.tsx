import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartProvider } from '../cart/CartContext';
import { MenuCard } from './MenuCard';
import type { MenuItem } from '../types';

const item: MenuItem = { id: 'ck-chocchip', category: 'Cookies', name: 'Chocolate Chip Cookie', price: 2.75, allergens: 'Gluten, Egg, Milk, Soya' };

describe('MenuCard', () => {
  it('shows name, price and allergens', () => {
    render(<CartProvider><MenuCard item={item} /></CartProvider>);
    expect(screen.getByText('Chocolate Chip Cookie')).toBeInTheDocument();
    expect(screen.getByText('£2.75')).toBeInTheDocument();
    expect(screen.getByText(/Gluten, Egg, Milk, Soya/)).toBeInTheDocument();
  });

  it('increments quantity when + is clicked', async () => {
    render(<CartProvider><MenuCard item={item} /></CartProvider>);
    expect(screen.getByLabelText('Quantity')).toHaveTextContent('0');
    await userEvent.click(screen.getByLabelText('Add one'));
    expect(screen.getByLabelText('Quantity')).toHaveTextContent('1');
  });
});
