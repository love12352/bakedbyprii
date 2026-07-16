import { describe, it, expect } from 'vitest';
import { gbp, deliveryFee } from './money';

describe('money', () => {
  it('formats GBP to two decimals', () => {
    expect(gbp(2.75)).toBe('£2.75');
    expect(gbp(35)).toBe('£35.00');
  });
  it('charges delivery under £20 and frees it at/over £20', () => {
    expect(deliveryFee(19.99)).toBe(2.5);
    expect(deliveryFee(20)).toBe(0);
    expect(deliveryFee(42)).toBe(0);
  });
});
