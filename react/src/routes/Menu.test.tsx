import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../cart/CartContext';
import { server } from '../test/mocks/handlers';
import Menu from './Menu';

const wrap = () => render(
  <CartProvider><MemoryRouter><Menu /></MemoryRouter></CartProvider>,
);

describe('Menu page', () => {
  it('renders items grouped by category from the API', async () => {
    wrap();
    expect(await screen.findByText('Chocolate Chip Cookie')).toBeInTheDocument();
    expect(screen.getByText('Vanilla Buttercream Cake')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cookies' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cakes' })).toBeInTheDocument();
  });

  it('shows an error with a retry when the menu fails to load', async () => {
    server.use(http.get('/api/menu', () => HttpResponse.json({ ok: false, error: 'boom' }, { status: 500 })));
    wrap();
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows an unavailable message when the menu is empty', async () => {
    server.use(http.get('/api/menu', () => HttpResponse.json({ ok: true, menu: [] })));
    wrap();
    expect(await screen.findByText(/menu is unavailable/i)).toBeInTheDocument();
  });
});
