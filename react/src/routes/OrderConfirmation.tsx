import { useEffect, useRef } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useCart } from '../cart/CartContext';
import { gbp } from '../money';
import type { CreateOrderResult } from '../types';

export default function OrderConfirmation() {
  const { ref = '' } = useParams();
  const location = useLocation();
  const result = (location.state as { result?: CreateOrderResult } | null)?.result;
  const { clear } = useCart();
  const cleared = useRef(false);

  useEffect(() => {
    if (result && !cleared.current) { clear(); cleared.current = true; }
  }, [result, clear]);

  return (
    <div className="sheet-panel confirm">
      <span className="sheet-eyebrow">Thank you</span>
      <h2 className="sheet-title">Order placed</h2>
      <p>Your reference is <strong className="ref">{ref}</strong>.</p>
      {result ? (
        <div className="totals" style={{ maxWidth: 320 }}>
          <div><span>Subtotal</span><span>{gbp(result.subtotal)}</span></div>
          {result.fulfilment === 'delivery' && <div><span>Delivery</span><span>{result.delivery_fee === 0 ? 'Free' : gbp(result.delivery_fee)}</span></div>}
          <div className="grand"><span>Total</span><span>{gbp(result.total)}</span></div>
        </div>
      ) : (
        <p className="muted">The full details are in your email. Please check your inbox for confirmation and your cancel link.</p>
      )}
      <p style={{ marginTop: '1.2rem' }}>We'll email you to confirm and arrange payment. <Link to="/menu">Back to the menu →</Link></p>
    </div>
  );
}
