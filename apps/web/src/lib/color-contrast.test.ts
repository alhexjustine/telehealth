import { describe, expect, it } from 'vitest';
import { AA_NORMAL_TEXT_MIN_RATIO, contrastRatio } from './color-contrast';

// These hex values must match the light-theme `@theme` tokens in `index.css`
// exactly — that file's comment points back here.
const tokens = {
  background: '#ffffff',
  foreground: '#10192b',
  muted: '#f1f5f4',
  mutedForeground: '#4b5a63',
  primary: '#0f6e63',
  primaryForeground: '#ffffff',
  secondary: '#eaf4f2',
  secondaryForeground: '#0b4a42',
  destructive: '#b3261e',
  destructiveForeground: '#ffffff',
};

describe('primary token contrast (AA, ≥ 4.5:1)', () => {
  it.each([
    ['foreground on background', tokens.foreground, tokens.background],
    ['primary text on background', tokens.primary, tokens.background],
    ['primary-foreground on primary', tokens.primaryForeground, tokens.primary],
    ['muted-foreground on background', tokens.mutedForeground, tokens.background],
    ['muted-foreground on muted', tokens.mutedForeground, tokens.muted],
    ['secondary-foreground on secondary', tokens.secondaryForeground, tokens.secondary],
    ['destructive text on background', tokens.destructive, tokens.background],
    ['destructive-foreground on destructive', tokens.destructiveForeground, tokens.destructive],
  ])('%s meets AA', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN_RATIO);
  });
});

// Must match the `prefers-color-scheme: dark` overrides in `index.css`.
const dark = {
  background: '#0b1220',
  foreground: '#f1f5f9',
  muted: '#1e293b',
  mutedForeground: '#94a3b8',
  primary: '#2dd4bf',
  primaryForeground: '#062a26',
  card: '#111a2c',
  secondary: '#134e4a',
  secondaryForeground: '#99f1e5',
  destructive: '#f87171',
  destructiveForeground: '#1a0606',
};

describe('dark theme token contrast (AA, ≥ 4.5:1)', () => {
  it.each([
    ['foreground on background', dark.foreground, dark.background],
    ['primary text on background', dark.primary, dark.background],
    ['primary-foreground on primary', dark.primaryForeground, dark.primary],
    ['muted-foreground on background', dark.mutedForeground, dark.background],
    ['muted-foreground on card', dark.mutedForeground, dark.card],
    ['secondary-foreground on secondary', dark.secondaryForeground, dark.secondary],
    ['destructive text on card', dark.destructive, dark.card],
    ['destructive-foreground on destructive', dark.destructiveForeground, dark.destructive],
  ])('%s meets AA', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_MIN_RATIO);
  });
});
