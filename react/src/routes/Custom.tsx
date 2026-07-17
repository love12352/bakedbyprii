import { useState } from 'react';
import { BESPOKE } from '../content/bespoke';

export default function Custom() {
  const [sent, setSent] = useState(false);
  return (
    <div>
      <span className="sheet-eyebrow">Made just for you</span>
      <h2 className="sheet-title">Custom Orders</h2>
      <p className="muted" style={{ maxWidth: '60ch' }}>
        Celebration cakes, dessert tables and bespoke bakes for any occasion. We ask for at least
        <strong> 5 working days'</strong> notice (more for tiered/wedding cakes).
      </p>
      <div className="menu-grid" style={{ margin: '1.5rem 0' }}>
        {BESPOKE.map((b) => (
          <div key={b.name} className="menu-card">
            <div className="row"><h4>{b.name}</h4><span className="price">{b.price}</span></div>
            <p>{b.blurb}</p>
            <span className="tags">{b.tag}</span>
          </div>
        ))}
      </div>
      <h3 className="group-heading">Start your enquiry</h3>
      {sent ? (
        <p className="cancelled-note">Thank you! Your enquiry is noted. We aim to reply within 1 working day. (This demo form does not send email — please also contact BakedbyPrii@gmail.com.)</p>
      ) : (
        <form className="form glass-block" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
          <div><label htmlFor="c-name">Your name</label><input id="c-name" required /></div>
          <div><label htmlFor="c-email">Email</label><input id="c-email" type="email" required /></div>
          <div><label htmlFor="c-phone">Phone (optional)</label><input id="c-phone" type="tel" /></div>
          <div><label htmlFor="c-date">Event date</label><input id="c-date" type="date" /></div>
          <div className="full"><label htmlFor="c-details">Tell us about your cake</label><textarea id="c-details" required placeholder="Occasion, servings, flavours, theme, any allergies…" /></div>
          <button type="submit" className="submit-btn">Send enquiry</button>
        </form>
      )}
    </div>
  );
}
