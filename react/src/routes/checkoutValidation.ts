import type { Fulfilment, Payment } from '../types';

export interface CheckoutForm {
  name: string; email: string; phone: string; notes: string;
  fulfilment: Fulfilment; date: string; payment: Payment;
  address: string; postcode: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const OX11 = /^OX11/i;

/** The four methods the server accepts, and the labels the checkout shows for
 *  them. One list: the radio buttons and the validator can't drift apart.
 *  The server re-validates against its own copy in server.js — that one is
 *  authoritative, this mirrors it as a client-side hint. */
export const PAYMENT_OPTIONS: { value: Payment; label: string }[] = [
  { value: 'cash', label: 'Pay in person — cash' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'card', label: 'Pay by card (secure link)' },
  { value: 'paypal', label: 'PayPal' },
];

const PAYMENTS: string[] = PAYMENT_OPTIONS.map((p) => p.value);

export function validateCheckout(f: CheckoutForm): string | null {
  if (!f.name.trim() || !f.email.trim() || !f.phone.trim() || !f.date.trim())
    return 'Please fill in your name, email, phone and required date.';
  if (!EMAIL_RE.test(f.email.trim())) return 'Please enter a valid email address.';
  if (!PAYMENTS.includes(f.payment)) return 'Please choose a payment method.';
  if (f.fulfilment === 'delivery') {
    if (!f.address.trim() || !f.postcode.trim()) return 'Please enter your Didcot delivery address and postcode.';
    if (!OX11.test(f.postcode.replace(/\s/g, '')))
      return "Sorry, we only deliver within Didcot (OX11). You're welcome to collect from home instead.";
  }
  return null;
}
