export interface Theme { inner: string; mid: string; outer: string; }

export const THEMES: Record<'Cakes' | 'Cookies' | 'Cupcakes', Theme> = {
  Cakes: { inner: '#b03a5b', mid: '#5e1f33', outer: '#1a0a10' },
  Cookies: { inner: '#a86b32', mid: '#5a3417', outer: '#170d05' },
  Cupcakes: { inner: '#7b4fa8', mid: '#3d2459', outer: '#100817' },
};

export const DEFAULT_THEME: Theme = THEMES.Cakes;

export function themeForCategory(category: string): Theme {
  if (category === 'Cookies') return THEMES.Cookies;
  if (category === 'Cupcakes') return THEMES.Cupcakes;
  return DEFAULT_THEME;
}
