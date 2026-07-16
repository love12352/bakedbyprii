import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from './cart/CartContext';
import { AppRoutes } from './App';

function renderAt(path: string) {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </MemoryRouter>
    </CartProvider>,
  );
}

describe('routing', () => {
  it('renders the home route', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: /bakedbyPrii|Home/i })).toBeInTheDocument();
  });

  it('renders the legal route for a known doc', () => {
    renderAt('/legal/terms');
    expect(screen.getByRole('heading', { name: /terms/i })).toBeInTheDocument();
  });

  it('shows a not-found heading for an unknown route', () => {
    renderAt('/nonsense');
    expect(screen.getByRole('heading', { name: /not found/i })).toBeInTheDocument();
  });
});
