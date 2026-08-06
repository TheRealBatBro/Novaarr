// Accent color presets — each overrides --primary/--ring (the two CSS vars that actually drive
// the app's accent color, per styles.css) with a light/dark pair tuned to the same
// lightness/chroma curve the default violet already uses, just a different oklch hue. Kept as a
// small fixed set rather than a full color picker — "pick one of these" covers the real want
// (a personal touch) without turning into a contrast-accessibility support burden.
export type AccentId = 'violet' | 'blue' | 'green' | 'rose' | 'orange' | 'teal';

export const ACCENT_PRESETS: { id: AccentId; label: string; swatch: string; light: { primary: string; ring: string }; dark: { primary: string; ring: string } }[] = [
  { id: 'violet', label: 'Violet', swatch: 'oklch(0.6 0.19 280)', light: { primary: 'oklch(0.6 0.19 280)', ring: 'oklch(0.6 0.19 280)' }, dark: { primary: 'oklch(0.7 0.19 280)', ring: 'oklch(0.7 0.19 280)' } },
  { id: 'blue', label: 'Blue', swatch: 'oklch(0.58 0.19 240)', light: { primary: 'oklch(0.58 0.19 240)', ring: 'oklch(0.58 0.19 240)' }, dark: { primary: 'oklch(0.68 0.17 240)', ring: 'oklch(0.68 0.17 240)' } },
  { id: 'green', label: 'Green', swatch: 'oklch(0.6 0.17 150)', light: { primary: 'oklch(0.55 0.17 150)', ring: 'oklch(0.55 0.17 150)' }, dark: { primary: 'oklch(0.68 0.16 150)', ring: 'oklch(0.68 0.16 150)' } },
  { id: 'rose', label: 'Rose', swatch: 'oklch(0.6 0.2 10)', light: { primary: 'oklch(0.6 0.2 10)', ring: 'oklch(0.6 0.2 10)' }, dark: { primary: 'oklch(0.68 0.19 10)', ring: 'oklch(0.68 0.19 10)' } },
  { id: 'orange', label: 'Orange', swatch: 'oklch(0.68 0.18 50)', light: { primary: 'oklch(0.62 0.18 50)', ring: 'oklch(0.62 0.18 50)' }, dark: { primary: 'oklch(0.72 0.17 50)', ring: 'oklch(0.72 0.17 50)' } },
  { id: 'teal', label: 'Teal', swatch: 'oklch(0.62 0.13 195)', light: { primary: 'oklch(0.56 0.13 195)', ring: 'oklch(0.56 0.13 195)' }, dark: { primary: 'oklch(0.68 0.13 195)', ring: 'oklch(0.68 0.13 195)' } },
];

const DEFAULT_ACCENT: AccentId = 'violet';

// `primary-foreground` stays a fixed near-white/near-black pair regardless of accent (every
// preset's primary is mid-lightness, so the existing default foreground pair keeps working) —
// only the hue-bearing vars need swapping per accent.
export function applyAccent(accent: AccentId, mode: 'dark' | 'light') {
  const preset = ACCENT_PRESETS.find((p) => p.id === accent) ?? ACCENT_PRESETS.find((p) => p.id === DEFAULT_ACCENT)!;
  const vars = mode === 'dark' ? preset.dark : preset.light;
  document.documentElement.style.setProperty('--primary', vars.primary);
  document.documentElement.style.setProperty('--ring', vars.ring);
}

// True AMOLED black for the dark theme — pure #000 background/card instead of the default dark
// navy-gray, for OLED screens where black pixels draw zero power and for people who just prefer
// the higher contrast. Only meaningful in dark mode; toggling it while on light mode is a no-op
// until the user switches back to dark.
export function applyAmoled(on: boolean) {
  document.documentElement.classList.toggle('amoled', on);
}
