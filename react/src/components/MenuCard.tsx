import type { MenuItem } from '../types';
import { useCart } from '../cart/CartContext';
import { contentFor } from '../content/menuContent';
import { gbp } from '../money';
import { QtyStepper } from './QtyStepper';

export function MenuCard({ item }: { item: MenuItem }) {
  const { cart, inc, dec } = useCart();
  const { description, tags } = contentFor(item.id);
  const qty = cart[item.id] || 0;
  return (
    <div className="menu-card">
      <div className="row">
        <h4>{item.name}</h4>
        <span className="price">{gbp(item.price)}</span>
      </div>
      {description && <p>{description}</p>}
      <div className="menu-card-foot">
        <span className="tags">{[...tags, item.allergens].filter(Boolean).join(' · ')}</span>
        <QtyStepper qty={qty} onDec={() => dec(item.id)} onInc={() => inc(item.id)} />
      </div>
    </div>
  );
}
