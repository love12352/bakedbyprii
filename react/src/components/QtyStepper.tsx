export function QtyStepper({ qty, onDec, onInc }: { qty: number; onDec: () => void; onInc: () => void }) {
  return (
    <span className="qty">
      <button type="button" aria-label="Remove one" onClick={onDec} disabled={qty === 0}>−</button>
      <span aria-label="Quantity">{qty}</span>
      <button type="button" aria-label="Add one" onClick={onInc}>+</button>
    </span>
  );
}
