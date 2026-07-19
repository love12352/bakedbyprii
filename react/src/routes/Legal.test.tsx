import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Legal from './Legal';

const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true };

const renderDoc = (doc: string) => render(
  <MemoryRouter initialEntries={[`/legal/${doc}`]} future={ROUTER_FUTURE}>
    <Routes><Route path="/legal/:doc" element={<Legal />} /></Routes>
  </MemoryRouter>,
);

describe('Legal', () => {
  it('renders a known doc', () => {
    renderDoc('privacy');
    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
  });
  it('shows not-found for an unknown doc', () => {
    renderDoc('banana');
    expect(screen.getByRole('heading', { name: /not found/i })).toBeInTheDocument();
  });

  // `doc` comes from the URL, so a bare LEGAL_DOCS[doc] lookup would return a
  // truthy Object.prototype member and render an empty panel instead of 404ing.
  it.each(['constructor', 'toString', '__proto__', 'valueOf'])(
    'shows not-found for the prototype member %s', (doc) => {
      renderDoc(doc);
      expect(screen.getByRole('heading', { name: /not found/i })).toBeInTheDocument();
    },
  );
});
