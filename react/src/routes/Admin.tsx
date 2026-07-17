import { useCallback, useEffect, useState } from 'react';
import { adminListOrders, adminSetStatus } from '../api/client';
import { gbp } from '../money';
import { ApiError, type AdminOrder, type AdminStats, type Status } from '../types';

const KEY_STORAGE = 'bbp-admin-key';
const STATUSES: Status[] = ['new', 'confirmed', 'completed', 'cancelled'];

export default function Admin() {
  const [key, setKey] = useState<string>(() => sessionStorage.getItem(KEY_STORAGE) || '');
  const [authed, setAuthed] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback((k: string) => {
    adminListOrders(k)
      .then(({ orders, stats }) => { setOrders(orders); setStats(stats); setAuthed(true); setError(null); })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          sessionStorage.removeItem(KEY_STORAGE); setKey(''); setAuthed(false);
          setError('Incorrect admin key.');
        } else setError((e as Error).message);
      });
  }, []);

  useEffect(() => { if (key) load(key); }, [key, attempt, load]);

  function signIn(e: React.FormEvent) {
    e.preventDefault();
    sessionStorage.setItem(KEY_STORAGE, keyInput);
    setError(null);
    setKey(keyInput);
    setAttempt((a) => a + 1);
  }

  async function changeStatus(ref: string, status: Status) {
    try {
      await adminSetStatus(ref, status, key);
      load(key);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { sessionStorage.removeItem(KEY_STORAGE); setKey(''); setAuthed(false); setError('Incorrect admin key.'); }
      else setError((e as Error).message);
    }
  }

  if (!authed) {
    return (
      <form className="sheet-panel admin-login" onSubmit={signIn}>
        <h2 className="sheet-title">Admin</h2>
        <label htmlFor="admin-key">Admin key</label>
        <input id="admin-key" type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="submit-btn" type="submit">Sign in</button>
      </form>
    );
  }

  return (
    <div>
      <h2 className="sheet-title">Orders</h2>
      {stats && (
        <div className="admin-stats">
          <div><span>{stats.total}</span> orders</div>
          <div><span>{stats.new}</span> new</div>
          <div><span>{gbp(stats.revenue)}</span> revenue</div>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="admin-table">
        {orders.map((o) => (
          <div key={o.ref} className="admin-row">
            <div className="admin-cell ref">{o.ref}</div>
            <div className="admin-cell">
              {o.name}
              <span className="muted">{o.fulfilment} · {o.required_date}</span>
              <a className="muted" href={`mailto:${o.email}`}>{o.email}</a>
              <a className="muted" href={`tel:${o.phone}`}>{o.phone}</a>
            </div>
            <div className="admin-cell">
              {o.items.map((it) => `${it.qty}×${it.name}`).join(', ')}
              {/* Customers are told to put allergies here, so it must never be hidden. */}
              {o.notes && <span className="admin-notes">Notes: {o.notes}</span>}
            </div>
            <div className="admin-cell">{gbp(o.total)}</div>
            <div className="admin-cell">
              <label className="visually-hidden" htmlFor={`st-${o.ref}`}>Status for {o.ref}</label>
              <select id={`st-${o.ref}`} value={o.status} onChange={(e) => changeStatus(o.ref, e.target.value as Status)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
