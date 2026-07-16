import { Link, NavLink, Outlet } from 'react-router-dom';
import { useCart } from '../cart/CartContext';

const NAV = [
  { to: '/menu', label: 'Menu' },
  { to: '/custom', label: 'Custom Orders' },
  { to: '/reviews', label: 'Reviews' },
];

export default function Layout() {
  const { count } = useCart();
  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand">bakedbyPrii</Link>
        <nav className="site-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="nav-item">{n.label}</NavLink>
          ))}
        </nav>
        <Link to="/checkout" className="contact-btn">
          Order Now{count > 0 ? ` (${count})` : ''}
        </Link>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <p>
          bakedbyPrii · Didcot ·{' '}
          <a href="mailto:BakedbyPrii@gmail.com">BakedbyPrii@gmail.com</a> ·{' '}
          <a href="tel:+447732262999">+44 7732 262999</a>
        </p>
        <p className="legal-links">
          <Link to="/legal/allergens">Allergens</Link> ·{' '}
          <Link to="/legal/delivery">Delivery</Link> ·{' '}
          <Link to="/legal/privacy">Privacy</Link> ·{' '}
          <Link to="/legal/terms">Terms</Link>
        </p>
      </footer>
    </>
  );
}
