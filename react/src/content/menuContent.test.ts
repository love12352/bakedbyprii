import { describe, it, expect, vi } from 'vitest';
import { contentFor, MENU_CONTENT } from './menuContent';
import { themeForCategory, THEMES } from './theme';

// The full set of seeded menu ids (from lib/db.js MENU_SEED).
const SEED_IDS = [
  'ck-chocchip','ck-double','ck-white','ck-redvelvet','ck-oreo','ck-biscoff','ck-nutella','ck-kinder','ck-triple',
  'cup-vanilla','cup-choc','cup-nutella','cup-floral','cup-mini',
  'cake-vanilla','cake-choc','cake-redvelvet','cake-forest',
  'br-classic','br-double','br-ferrero','br-mini',
  'tea-butter','tea-marble','tea-scones',
];

describe('menu content', () => {
  it('has content for every seeded menu id', () => {
    for (const id of SEED_IDS) {
      expect(MENU_CONTENT[id], `missing content for ${id}`).toBeDefined();
    }
  });

  it('contentFor returns a safe empty default for unknown ids, and warns in dev', () => {
    // The warning is the point: a menu item added to the database with no
    // description here renders bare, and this is what surfaces that.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(contentFor('nope')).toEqual({ description: '', tags: [] });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no description for menu id "nope"'));
    warn.mockRestore();
  });

  it('contentFor does not treat prototype members as menu content', () => {
    for (const id of ['constructor', 'toString', '__proto__', 'valueOf']) {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(contentFor(id), id).toEqual({ description: '', tags: [] });
      warn.mockRestore();
    }
  });

  it('maps categories to their theme and falls back to Cakes', () => {
    expect(themeForCategory('Cookies')).toEqual(THEMES.Cookies);
    expect(themeForCategory('Tea Time Bakes')).toEqual(THEMES.Cakes);
  });
});
