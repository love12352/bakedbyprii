export interface LegalDoc { eyebrow: string; title: string; bodyHtml: string; }

const CONTACT = 'BakedbyPrii@gmail.com';

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  allergens: {
    eyebrow: 'Food Information Regulations 2014', title: 'Allergen Information',
    bodyHtml: `<p>We provide full allergen information for everything we bake. If you have a food allergy or intolerance, please tell us <strong>before you order</strong>.</p>
      <h3>Cross-contamination</h3>
      <p>Our bakes are made in a kitchen that handles <strong>gluten, eggs, milk, soya, nuts and peanuts</strong>. We cannot guarantee any product is completely free from any allergen.</p>
      <h3>Ask us</h3>
      <p>Full ingredient breakdowns are available on request — contact <a href="mailto:${CONTACT}">${CONTACT}</a> before ordering.</p>`,
  },
  delivery: {
    eyebrow: 'Collection & Didcot delivery', title: 'Delivery & Returns',
    bodyHtml: `<h3>Collection</h3><p>bakedbyPrii is a home-based bakery in Didcot. Collection is <strong>free</strong>. We share the address and a time when we confirm your order.</p>
      <h3>Delivery</h3><p>We deliver <strong>within Didcot (OX11) only</strong>. Delivery is <strong>free on orders over £20</strong>; otherwise a £2.50 charge applies.</p>
      <h3>Cancelling</h3><p>While your order is still awaiting confirmation you can cancel it instantly and free using the "Cancel my order" link in your confirmation email.</p>`,
  },
  privacy: {
    eyebrow: 'UK GDPR & Data Protection Act 2018', title: 'Privacy Policy',
    bodyHtml: `<p>This policy explains how bakedbyPrii collects and uses your personal data, in line with the UK GDPR.</p>
      <h3>What we collect</h3><ul><li>Your name, email, phone and delivery address</li><li>Order details, including any allergy information you give us</li></ul>
      <h3>Your rights</h3><p>You have the right to access, correct or delete your data. Contact <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>`,
  },
  terms: {
    eyebrow: 'The important bit', title: 'Terms & Conditions',
    bodyHtml: `<h3>Orders</h3><p>An order is a request to buy; a contract is formed only when we confirm acceptance. Standard orders require 48 hours' notice; custom orders at least 5 working days.</p>
      <h3>Prices & payment</h3><p>Prices are in GBP. No payment is taken on this website; we arrange payment once your order is confirmed.</p>
      <h3>Your rights</h3><p>Nothing in these terms affects your statutory rights under the Consumer Rights Act 2015.</p>`,
  },
};
