/**
 * Theme: glyph and color mapping for all renderable kinds.
 *
 * Two variants:
 * - UNICODE_THEME: uses box/suit/emoji characters for Unicode-capable terminals
 * - ASCII_THEME: plain ASCII fallback selectable via config flag
 *
 * See docs/superpowers/specs/2026-04-10-bioforge-design.md §13.3.
 */

export interface GlyphColor {
  readonly glyph: string
  readonly color: string
}

export interface Theme {
  readonly plant: GlyphColor
  readonly herbivore: GlyphColor
  readonly carnivore: GlyphColor
  readonly decomposer: GlyphColor
  readonly corpse: GlyphColor
  readonly poop: GlyphColor
  readonly compost: GlyphColor
  readonly soil: GlyphColor
  readonly empty: GlyphColor
}

/**
 * Unicode theme — requires a Unicode-capable terminal.
 * Glyphs per spec §13.3: ♣ plant, h herbivore, C carnivore, d decomposer,
 * ■ corpse, ♦ compost, . poop.
 */
export const UNICODE_THEME: Theme = {
  plant: { glyph: '♣', color: 'green' },
  herbivore: { glyph: 'h', color: 'yellow' },
  carnivore: { glyph: 'C', color: 'red' },
  decomposer: { glyph: 'd', color: 'magenta' },
  corpse: { glyph: '■', color: '#888888' },
  poop: { glyph: '.', color: '#8B4513' },
  compost: { glyph: '♦', color: '#4B7A3A' },
  soil: { glyph: '·', color: '#333333' },
  empty: { glyph: ' ', color: 'black' },
}

/**
 * ASCII fallback theme — works on any terminal.
 * Glyphs per spec §13.3: * plant, h herbivore, C carnivore, d decomposer,
 * x corpse, + compost, . poop.
 */
export const ASCII_THEME: Theme = {
  plant: { glyph: '*', color: 'green' },
  herbivore: { glyph: 'h', color: 'yellow' },
  carnivore: { glyph: 'C', color: 'red' },
  decomposer: { glyph: 'd', color: 'magenta' },
  corpse: { glyph: 'x', color: '#888888' },
  poop: { glyph: '.', color: '#8B4513' },
  compost: { glyph: '+', color: '#4B7A3A' },
  soil: { glyph: '.', color: '#333333' },
  empty: { glyph: ' ', color: 'black' },
}
