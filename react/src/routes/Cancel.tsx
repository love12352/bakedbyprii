import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOrder, cancelOrder } from '../api/client';
import { gbp } from '../money';
import type { PublicOrder } from '../types';

type View =
  | { kind: 'loading' }
  | { kind: 'invalid'; message: string }
  | { kind: 'loaded'; order: PublicOrder }
  | { kind: 'cancelled'; order: PublicOrder };

export default function Cancel() {
  const [params] = useSearchParams();
  const ref = params.get('ref') || '';
  const token = params.get('token') || '';
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const cancellingRef = useRef(false);

  useEffect(() => {
    if (!ref || !token) { setView({ kind: 'invalid', message: 'This cancellation link is invalid or has expired.' }); return; }
    getOrder(ref, token)
      .then((order) => setView({ kind: 'loaded', order }))
      .catch((e) => setView({ kind: 'invalid', message: e.message }));
  }, [ref, token]);

  async function doCancel(order: PublicOrder) {
    if (cancellingRef.current) return;
    cancellingRef.current = true;
    setBusy(true);
    try {
      await cancelOrder(ref, token);
      setView({ kind: 'cancelled', order: { ...order, status: 'cancelled', cancellable: false } });
    } catch (e) {
      setView({ kind: 'invalid', message: (e as Error).message });
      setBusy(false);
      cancellingRef.current = false;
    }
  }

  if (view.kind === 'loading') return <p className="state-msg">Loading your order…</p>;
  if (view.kind === 'invalid') return <div className="sheet-panel"><h2 className="sheet-title">Cancel your order</h2><p>{view.message}</p></div>;

  const order = view.order;
  return (
    <div className="sheet-panel">
      <h2 className="sheet-title">Order {order.ref}</h2>
      {view.kind === 'cancelled' && <p className="cancelled-note">Your order has been cancelled. A confirmation email is on its way.</p>}
      <p className="muted">Hi {order.name} — status: <strong>{order.status}</strong> · required {order.required_date}</p>
      <ul className="cancel-items">
        {order.items.map((it) => <li key={it.item_id}>{it.qty} × {it.name} — {gbp(it.price * it.qty)}</li>)}
      </ul>
      <p className="totals grand"><span>Total</span> <span>{gbp(order.total)}</span></p>
      {view.kind === 'loaded' && order.cancellable && (
        <button className="submit-btn" disabled={busy} onClick={() => doCancel(order)}>
          {busy ? 'Cancelling…' : 'Cancel my order'}
        </button>
      )}
      {view.kind === 'loaded' && !order.cancellable && (
        <p className="muted">This order can no longer be cancelled online. Please contact us at BakedbyPrii@gmail.com or +44 7732 262999.</p>
      )}
    </div>
  );
}
