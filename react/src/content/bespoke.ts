export interface BespokeItem { name: string; price: string; blurb: string; tag: string; }

export const BESPOKE: BespokeItem[] = [
  { name: 'Celebration Cakes', price: 'from £45', blurb: 'Birthdays, anniversaries and milestones, personalised to your theme.', tag: 'Single & multi-layer' },
  { name: 'Wedding Tiers', price: 'from £180', blurb: 'Elegant tiered cakes with a free consultation and tasting.', tag: '2–5 tiers' },
  { name: 'Number / Letter Cupcakes', price: 'from £35', blurb: 'Pull-apart cupcakes shaped into a number or letter for the big day.', tag: 'Customisable' },
  { name: 'Dietary & Vegan', price: 'on request', blurb: 'Vegan, gluten-free and reduced-sugar options available.', tag: 'Ask us' },
];
