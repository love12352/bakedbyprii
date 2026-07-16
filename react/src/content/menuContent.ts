export interface ItemContent { description: string; tags: string[]; }

export const MENU_CONTENT: Record<string, ItemContent> = {
  'ck-chocchip': { description: 'The classic — soft centre, crisp edge, loaded with chocolate chips.', tags: ['Classic'] },
  'ck-double': { description: 'Cocoa dough with chocolate chips for double the depth.', tags: ['Classic'] },
  'ck-white': { description: 'Buttery cookie studded with creamy white chocolate.', tags: ['Classic'] },
  'ck-redvelvet': { description: 'Red velvet cookie with a subtle cocoa tang.', tags: ['Classic'] },
  'ck-oreo': { description: 'Cookies-and-cream throughout with crushed Oreo.', tags: ['Classic'] },
  'ck-biscoff': { description: 'Stuffed with molten Biscoff spread.', tags: ['Stuffed'] },
  'ck-nutella': { description: 'Oozing Nutella centre in a chocolate cookie.', tags: ['Stuffed'] },
  'ck-kinder': { description: 'Kinder chocolate baked into a gooey middle.', tags: ['Stuffed'] },
  'ck-triple': { description: 'Three chocolates in one indulgent cookie.', tags: ['Premium'] },
  'cup-vanilla': { description: 'Light vanilla sponge with smooth buttercream.', tags: ['Classic'] },
  'cup-choc': { description: 'Rich chocolate sponge and chocolate buttercream.', tags: ['Classic'] },
  'cup-nutella': { description: 'Vanilla cupcake with a hidden Nutella core.', tags: ['Stuffed'] },
  'cup-floral': { description: 'Hand-piped floral buttercream — almost too pretty to eat.', tags: ['Signature'] },
  'cup-mini': { description: 'Bite-sized cupcakes, perfect for dessert tables.', tags: ['Mini'] },
  'cake-vanilla': { description: '6-inch vanilla sponge layered with buttercream. Serves 8–10.', tags: ['Serves 8–10'] },
  'cake-choc': { description: 'Deep chocolate layers with chocolate buttercream. Serves 8–10.', tags: ['Serves 8–10'] },
  'cake-redvelvet': { description: 'Red velvet with cream-cheese frosting. Serves 8–10.', tags: ['Serves 8–10'] },
  'cake-forest': { description: 'Black Forest — chocolate, cherries and cream. Serves 8–10.', tags: ['Serves 8–10'] },
  'br-classic': { description: 'Fudgy, dense and generously chocolatey.', tags: ['Classic'] },
  'br-double': { description: 'Extra chocolate chunks folded through the batter.', tags: ['Classic'] },
  'br-ferrero': { description: 'Topped with Ferrero Rocher and hazelnut.', tags: ['Premium'] },
  'br-mini': { description: 'Little squares of fudgy brownie.', tags: ['Mini'] },
  'tea-butter': { description: 'Traditional buttery loaf cake for afternoon tea.', tags: ['Loaf'] },
  'tea-marble': { description: 'Swirled vanilla and chocolate loaf.', tags: ['Loaf'] },
  'tea-scones': { description: 'Four fresh scones — jam and cream optional.', tags: ['4-pack'] },
};

export function contentFor(id: string): ItemContent {
  return MENU_CONTENT[id] ?? { description: '', tags: [] };
}
