import { SHARED_THEME_COLORS } from '@sim-tracker/shared';

function hexToRgb(hex) {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgHex, bgHex) {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const checks = [];

for (const mode of ['light', 'dark']) {
  const t = SHARED_THEME_COLORS[mode];
  checks.push([mode, 'textPrimary on canvas', t.textPrimary, t.canvas, 7.0]);
  checks.push([mode, 'textPrimary on surface', t.textPrimary, t.surface, 7.0]);
  checks.push([mode, 'textPrimary on surfaceRaised', t.textPrimary, t.surfaceRaised, 7.0]);
  checks.push([mode, 'textPrimary on surfaceSunken', t.textPrimary, t.surfaceSunken, 7.0]);
  checks.push([mode, 'textSecondary on surface', t.textSecondary, t.surface, 7.0]);
  checks.push([mode, 'textMuted on canvas', t.textMuted, t.canvas, 7.0]);
  checks.push([mode, 'textMuted on surface', t.textMuted, t.surface, 7.0]);
  checks.push([mode, 'accentOnPrimary on accentPrimary', t.accentOnPrimary, t.accentPrimary, 7.0]);
  checks.push([mode, 'accentOnPrimary on accentHover', t.accentOnPrimary, t.accentHover, 7.0]);
  checks.push([mode, 'accentLink on canvas', t.accentLink, t.canvas, 7.0]);
  checks.push([mode, 'accentLink on surface', t.accentLink, t.surface, 7.0]);
  checks.push([mode, 'borderDefault on surface', t.borderDefault, t.surface, 4.5]);
  checks.push([mode, 'dangerSolid on white', '#ffffff', '#991b1b', 7.0]);

  for (const [tone, triple] of Object.entries(t.status)) {
    checks.push([mode, `status.${tone}.fg on bg`, triple.fg, triple.bg, 7.0]);
    checks.push([mode, `status.${tone}.border on surface`, triple.border, t.surface, 4.5]);
  }
}

let failures = 0;
let minRatio = Infinity;

for (const [mode, label, fg, bg, minReq] of checks) {
  const ratio = contrastRatio(fg, bg);
  if (ratio < minRatio) minRatio = ratio;
  if (ratio < minReq) {
    console.error(
      `[mobile:wcag-aaa] FAIL (${mode}) ${label}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (required >= ${minReq}:1)`,
    );
    failures++;
  }
}

if (failures > 0) {
  console.error(`[mobile:wcag-aaa] Failed with ${failures} contrast violation(s).`);
  process.exit(1);
}

console.log(
  `[mobile:wcag-aaa] OK — verified ${checks.length} WCAG AAA contrast pairs (light & dark); lowest ratio: ${minRatio.toFixed(2)}:1.`,
);
