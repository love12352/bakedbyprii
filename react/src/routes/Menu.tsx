import { useMenu, groupByCategory } from '../useMenu';
import { MenuCard } from '../components/MenuCard';

export default function Menu() {
  const { menu, error, loading, reload } = useMenu();

  if (loading) return <p className="state-msg">Loading the menu…</p>;
  if (error) {
    return (
      <div className="state-msg">
        <p>Sorry — we couldn't load the menu.</p>
        <button className="submit-btn" onClick={reload}>Try again</button>
      </div>
    );
  }
  if (!menu || menu.length === 0) return <p className="state-msg">Our menu is unavailable right now. Please check back soon.</p>;

  return (
    <div>
      <h2 className="sheet-title">Our Menu</h2>
      {groupByCategory(menu).map((group) => (
        <section key={group.category} style={{ marginBottom: '2rem' }}>
          <h3 className="group-heading">{group.category}</h3>
          <div className="menu-grid">
            {group.items.map((item) => <MenuCard key={item.id} item={item} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
