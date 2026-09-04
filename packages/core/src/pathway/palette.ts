import { formatHex } from 'culori'

/**
 * ProteinLounge-style vivid per-entity coloring for the realistic style.
 *
 * Each entity name deterministically maps to one curated vivid hue family, so
 * the same protein always renders with the same gradient while different
 * proteins spread across the palette like professional pathway illustrations.
 * Glyph type semantics remain encoded in the glyph shape; color provides the
 * per-entity identity.
 */

const VIVID_HUES = [145, 122, 95, 62, 30, 14, 350, 332, 305, 272, 244, 218, 196, 176] as const

export interface EntityColorSpec {
  /** Radial gradient stops, light highlight → saturated rim. */
  stops: [string, string, string, string]
  border: string
}

function oklchHex(l: number, c: number, h: number): string {
  return formatHex({ mode: 'oklch', l, c, h })
}

function buildEntityColors(hue: number): EntityColorSpec {
  return {
    stops: [
      oklchHex(0.88, 0.075, hue),
      oklchHex(0.79, 0.12, hue),
      oklchHex(0.69, 0.145, hue),
      oklchHex(0.57, 0.15, hue)
    ],
    border: oklchHex(0.47, 0.135, hue)
  }
}

function hashString(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function pickEntityColors(name: string | undefined): EntityColorSpec | null {
  const trimmed = name?.trim()
  if (!trimmed) return null
  const hash = hashString(trimmed.toLowerCase())
  const baseHue = VIVID_HUES[hash % VIVID_HUES.length]
  const jitter = ((hash >> 8) % 17) - 8
  return buildEntityColors((baseHue + jitter + 360) % 360)
}
