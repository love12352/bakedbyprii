import type { ReactNode } from 'react';

export function Sheet({ eyebrow, title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <section className="sheet-panel">
      {eyebrow && <span className="sheet-eyebrow">{eyebrow}</span>}
      <h2 className="sheet-title">{title}</h2>
      {children}
    </section>
  );
}
