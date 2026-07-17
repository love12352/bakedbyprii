import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart/CartContext';
import { useMenu } from '../useMenu';
import { createOrder } from '../api/client';
import { gbp, deliveryFee } from '../money';
import { validateCheckout, type CheckoutForm } from './checkoutValidation';
import { QtyStepper } from '../components/QtyStepper';
import type { Payment } from '../types';

const PAYMENTS: { value: Payment; label: string }[] = [
  { value: 'cash', label: 'Pay in person — cash' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'card', label: 'Pay by card (secure link)' },
  { value: 'paypal', label: 'PayPal' },
];

export default function Checkout() {
  const { cart, inc, dec } = useCart();
  const { menu } = useMenu();
  const navigate = useNavigate();
  const [form, setForm] = useState<CheckoutForm>({
    name: '', email: '', phone: '', notes: '',
    fulfilment: 'collection', date: new Date().toISOString().slice(0, 10),
    payment: 'cash', address: '', postcode: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const lines = useMemo(() => {
    if (!menu) return [];
    return menu.filter((m) => cart[m.id]).map((m) => ({ ...m, qty: cart[m.id], lineTotal: m.price * cart[m.id] }));
  }, [menu, cart]);

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const fee = form.fulfilment === 'delivery' ? deliveryFee(subtotal) : 0;
  const total = subtotal + fee;
  const set = (patch: Partial<CheckoutForm>) => setForm((f) => ({ ...f, ...patch }));

  if (menu && lines.length === 0) {
    return (
      <div className="state-msg">
        <p>Your basket is empty.</p>
        <Link className="submit-btn" to="/menu">Browse the menu</Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    const clientError = validateCheckout(form);
    if (clientError) { setError(clientError); return; }
    submittingRef.current = true;
    setSubmitting(true); setError(null);
    try {
      const result = await createOrder({
        customer: { name: form.name, email: form.email, phone: form.phone, notes: form.notes },
        items: lines.map((l) => ({ id: l.id, qty: l.qty })),
        fulfilment: form.fulfilment, date: form.date, payment: form.payment,
        address: { line: form.address, postcode: form.postcode },
      });
      navigate(`/order/${result.ref}`, { state: { result } });
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  return (
    <form className="checkout" onSubmit={submit}>
      <h2 className="sheet-title">Checkout</h2>

      <section className="glass-block">
        <h3 className="group-heading">Your order</h3>
        {lines.map((l) => (
          <div key={l.id} className="line-item">
            <span className="li-name">{l.name}</span>
            <QtyStepper qty={l.qty} onDec={() => dec(l.id)} onInc={() => inc(l.id)} />
            <span className="li-price">
              {gbp(l.lineTotal)}
              <span className="li-unit">{l.qty} × {gbp(l.price)}</span>
            </span>
          </div>
        ))}
        <div className="totals" data-testid="totals">
          <div data-testid="row-subtotal"><span>Subtotal</span><span>{gbp(subtotal)}</span></div>
          {form.fulfilment === 'delivery' && <div data-testid="row-delivery"><span>Delivery</span><span>{fee === 0 ? 'Free' : gbp(fee)}</span></div>}
          <div className="grand" data-testid="row-total"><span>Total</span><span>{gbp(total)}</span></div>
        </div>
      </section>

      <section className="glass-block form">
        <div><label htmlFor="co-name">Your name</label><input id="co-name" value={form.name} onChange={(e) => set({ name: e.target.value })} required /></div>
        <div><label htmlFor="co-email">Email</label><input id="co-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required /></div>
        <div><label htmlFor="co-phone">Phone</label><input id="co-phone" type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} required /></div>
        <div><label htmlFor="co-date">Required date</label><input id="co-date" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} required /></div>

        <div className="full">
          <label>Fulfilment</label>
          <div className="toggle">
            <label><input type="radio" name="fulfilment" checked={form.fulfilment === 'collection'} onChange={() => set({ fulfilment: 'collection' })} /> Collection (free)</label>
            <label><input type="radio" name="fulfilment" checked={form.fulfilment === 'delivery'} onChange={() => set({ fulfilment: 'delivery' })} /> Delivery (Didcot OX11)</label>
          </div>
        </div>

        {form.fulfilment === 'delivery' && (
          <>
            <div className="full"><label htmlFor="co-address">Delivery address</label><input id="co-address" value={form.address} onChange={(e) => set({ address: e.target.value })} /></div>
            <div><label htmlFor="co-postcode">Postcode</label><input id="co-postcode" value={form.postcode} onChange={(e) => set({ postcode: e.target.value })} placeholder="OX11 …" /></div>
          </>
        )}

        <div className="full"><label htmlFor="co-notes">Notes (optional)</label><textarea id="co-notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Allergies, message on the cake, collection time…" /></div>

        <div className="full">
          <label>Payment</label>
          {PAYMENTS.map((p) => (
            <label key={p.value} className="pay-option">
              <input type="radio" name="payment" checked={form.payment === p.value} onChange={() => set({ payment: p.value })} /> {p.label}
            </label>
          ))}
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? 'Placing your order…' : `Place order · ${gbp(total)}`}
        </button>
        <p className="form-note">No payment is taken on this site. We confirm your order and arrange payment afterwards.</p>
      </section>
    </form>
  );
}
