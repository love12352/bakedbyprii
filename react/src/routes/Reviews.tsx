const REVIEWS = [
  { name: 'Hannah', text: 'The Biscoff stuffed cookies were unreal — gone in minutes at the party.' },
  { name: 'Priya', text: 'Ordered a red velvet cake for my mum\'s birthday. Beautiful and delicious.' },
  { name: 'Tom', text: 'Reliable, local and the brownies are the fudgiest I\'ve had.' },
];

export default function Reviews() {
  return (
    <div>
      <span className="sheet-eyebrow">Kind words</span>
      <h2 className="sheet-title">Reviews</h2>
      <div className="menu-grid">
        {REVIEWS.map((r) => (
          <blockquote key={r.name} className="menu-card">
            <p>"{r.text}"</p>
            <span className="tags">— {r.name}</span>
          </blockquote>
        ))}
      </div>
    </div>
  );
}
