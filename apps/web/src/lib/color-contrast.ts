/**
 * WCAG 2.1 relative-luminance / contrast-ratio helpers, for verifying the
 * design tokens in `index.css` meet AA (4.5:1 for normal text) without a
 * browser. See https://www.w3.org/TR/WCAG21/#dfn-relative-luminance.
 */

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/** Contrast ratio between two hex colors, from 1 (no contrast) to 21 (max). */
export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA minimum contrast ratio for normal-sized text. */
export const AA_NORMAL_TEXT_MIN_RATIO = 4.5;
