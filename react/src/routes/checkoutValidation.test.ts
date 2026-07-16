import { describe, it, expect } from 'vitest';
import { validateCheckout } from './checkoutValidation';

const base = {
  name: 'Sam', email: 'sam@example.com', phone: '07700900000', notes: '',
  fulfilment: 'collection' as const, date: '2026-08-01', payment: 'cash' as const,
  address: '', postcode: '',
};

describe('validateCheckout', () => {
  it('accepts a valid collection order', () => {
    expect(validateCheckout(base)).toBeNull();
  });
  it('requires name, email, phone and date', () => {
    expect(validateCheckout({ ...base, name: '' })).toMatch(/name/i);
  });
  it('rejects a malformed email', () => {
    expect(validateCheckout({ ...base, email: 'nope' })).toMatch(/valid email/i);
  });
  it('rejects an unlisted payment method', () => {
    expect(validateCheckout({ ...base, payment: 'crypto' as never })).toMatch(/payment/i);
  });
  it('requires a Didcot address for delivery', () => {
    expect(validateCheckout({ ...base, fulfilment: 'delivery', address: '', postcode: '' })).toMatch(/address/i);
  });
  it('rejects a non-OX11 delivery postcode', () => {
    expect(validateCheckout({ ...base, fulfilment: 'delivery', address: '1 High St', postcode: 'RG1 1AA' })).toMatch(/OX11|Didcot/i);
  });
  it('accepts an OX11 delivery order', () => {
    expect(validateCheckout({ ...base, fulfilment: 'delivery', address: '1 High St', postcode: 'OX11 7AA' })).toBeNull();
  });
});
