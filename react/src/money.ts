/** Mirrors server.js's DELIVERY_FEE / FREE_DELIVERY_OVER, which are
 *  env-overridable (`process.env.DELIVERY_FEE ?? 2.5`). These two numbers are
 *  the only pricing facts this client asserts on its own authority, and they
 *  are DISPLAY ONLY — the server reprices every order and the confirmation
 *  page renders the server's returned total, so a mismatch would show a
 *  preview that differs from the real charge but could never bill it.
 *  If you ever set DELIVERY_FEE or FREE_DELIVERY_OVER in the deploy
 *  environment, change these to match. */
export const DELIVERY_FEE = 2.5;
export const FREE_DELIVERY_OVER = 20;

export function gbp(n: number): string {
  return '£' + n.toFixed(2);
}

/** Display-only preview of the server's delivery rule: free at or over the
 *  threshold, otherwise the flat fee. Collection never pays it — that check
 *  is the caller's. */
export function deliveryFee(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
}
