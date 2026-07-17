import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Custom from './Custom';

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

describe('Custom', () => {
  it('lists bespoke items and shows a thank-you without hitting a server', async () => {
    render(<MemoryRouter future={ROUTER_FUTURE}><Custom /></MemoryRouter>);
    expect(screen.getByText('Wedding Tiers')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/your name/i), 'Sam');
    await userEvent.type(screen.getByLabelText(/email/i), 'sam@example.com');
    await userEvent.type(screen.getByLabelText(/about your cake/i), 'A three-tier lemon cake');
    await userEvent.click(screen.getByRole('button', { name: /send enquiry/i }));
    expect(screen.getByText(/thank you/i)).toBeInTheDocument();
  });
});
