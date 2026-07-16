import { useParams } from 'react-router-dom';

const TITLES: Record<string, string> = {
  allergens: 'Allergen Information',
  delivery: 'Delivery & Returns',
  privacy: 'Privacy Policy',
  terms: 'Terms & Conditions',
};

export default function Legal() {
  const { doc = '' } = useParams();
  const title = TITLES[doc];
  if (!title) return <h2>Not found</h2>;
  return <h2 style={{ fontFamily: 'var(--font-heading)' }}>{title}</h2>;
}
