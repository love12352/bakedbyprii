export const DELIVERY_FEE = 2.5;
export const FREE_DELIVERY_OVER = 20;

export function gbp(n: number): string {
  return '£' + n.toFixed(2);
}

export function deliveryFee(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
}
