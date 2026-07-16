import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { useMenu } from '../useMenu';
import { themeForCategory } from '../content/theme';
import { gbp } from '../money';
import type { MenuItem } from '../types';

export function categorySummaries(menu: MenuItem[]): { category: string; min: number }[] {
  const out: { category: string; min: number }[] = [];
  const index = new Map<string, { category: string; min: number }>();
  for (const item of menu) {
    const seen = index.get(item.category);
    if (!seen) {
      const rec = { category: item.category, min: item.price };
      index.set(item.category, rec);
      out.push(rec);
    } else {
      seen.min = Math.min(seen.min, item.price);
    }
  }
  return out;
}

function applyTheme(category: string) {
  const t = themeForCategory(category);
  gsap.to(document.body, {
    '--bg-inner': t.inner, '--bg-mid': t.mid, '--bg-outer': t.outer,
    duration: 1.2, ease: 'power2.inOut', overwrite: 'auto',
  });
}

export default function Home() {
  const { menu } = useMenu();
  const cats = menu ? categorySummaries(menu) : [];
  return (
    <div>
      <section className="hero">
        <h1 className="hero-title">bakedbyPrii</h1>
        <p className="hero-lead">Home-baked cookies, cupcakes, brownies and celebration cakes — freshly made in Didcot.</p>
        <Link to="/menu" className="contact-btn">Browse the menu</Link>
      </section>
      <div className="menu-grid">
        {cats.map((c) => (
          <Link key={c.category} to="/menu" className="menu-card cat-card"
                onMouseEnter={() => applyTheme(c.category)}>
            <div className="row"><h4>{c.category}</h4><span className="price">from {gbp(c.min)}</span></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
