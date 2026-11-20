import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHARED_THEME_COLORS } from '@sim-tracker/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokensPath = path.resolve(__dirname, '../src/styles/tokens.json');
const tokensCssPath = path.resolve(__dirname, '../src/styles/tokens.css');

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
const tokensCss = fs.readFileSync(tokensCssPath, 'utf8');

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
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const checks = [];

for (const mode of ['light', 'dark']) {
  const t = tokens[mode];
  // Normal text (>= 7.0:1 WCAG AAA)
  checks.push([mode, 'textPrimary on canvas', t.textPrimary, t.canvas, 7.0]);
  checks.push([mode, 'textPrimary on surface', t.textPrimary, t.surface, 7.0]);
  checks.push([mode, 'textPrimary on surfaceRaised', t.textPrimary, t.surfaceRaised, 7.0]);
  checks.push([mode, 'textPrimary on surfaceSunken', t.textPrimary, t.surfaceSunken, 7.0]);
  checks.push([mode, 'textPrimary on surfaceHover', t.textPrimary, t.surfaceHover, 7.0]);

  checks.push([mode, 'textSecondary on canvas', t.textSecondary, t.canvas, 7.0]);
  checks.push([mode, 'textSecondary on surface', t.textSecondary, t.surface, 7.0]);
  checks.push([mode, 'textSecondary on surfaceSunken', t.textSecondary, t.surfaceSunken, 7.0]);

  checks.push([mode, 'textMuted on canvas', t.textMuted, t.canvas, 7.0]);
  checks.push([mode, 'textMuted on surface', t.textMuted, t.surface, 7.0]);
  checks.push([mode, 'textMuted on surfaceRaised', t.textMuted, t.surfaceRaised, 7.0]);
  checks.push([mode, 'textMuted on surfaceSunken', t.textMuted, t.surfaceSunken, 7.0]);
  checks.push([mode, 'textMuted on surfaceHover', t.textMuted, t.surfaceHover, 7.0]);

  checks.push([mode, 'accentOnPrimary on accentPrimary', t.accentOnPrimary, t.accentPrimary, 7.0]);
  checks.push([mode, 'accentOnPrimary on accentHover', t.accentOnPrimary, t.accentHover, 7.0]);
  checks.push([mode, 'accentLink on canvas', t.accentLink, t.canvas, 7.0]);
  checks.push([mode, 'accentLink on surface', t.accentLink, t.surface, 7.0]);
  checks.push([mode, 'accentLinkHover on surface', t.accentLinkHover, t.surface, 7.0]);
  checks.push([mode, 'accentSoftFg on accentSoftBg', t.accentSoftFg, t.accentSoftBg, 7.0]);

  // UI controls, borders & focus rings (>= 4.5:1)
  checks.push([mode, 'borderDefault on surface', t.borderDefault, t.surface, 4.5]);
  checks.push([mode, 'borderDefault on surfaceSunken', t.borderDefault, t.surfaceSunken, 4.5]);
  checks.push([mode, 'borderStrong on surface', t.borderStrong, t.surface, 7.0]);
  checks.push([mode, 'focusRing on canvas', t.focusRing, t.canvas, 4.5]);
  checks.push([mode, 'focusRing on surface', t.focusRing, t.surface, 4.5]);

  for (const [statusName, statusSet] of Object.entries(t.status)) {
    checks.push([mode, `status.${statusName}.fg on status.${statusName}.bg`, statusSet.fg, statusSet.bg, 7.0]);
    checks.push([mode, `status.${statusName}.border on surface`, statusSet.border, t.surface, 4.5]);
  }
}

// Print paper AAA checks
const pp = tokens.printPaper;
checks.push(['printPaper', 'textPrimary on paper', pp.textPrimary, pp.paper, 7.0]);
checks.push(['printPaper', 'textSecondary on paper', pp.textSecondary, pp.paper, 7.0]);
checks.push(['printPaper', 'textMuted on paper', pp.textMuted, pp.paper, 7.0]);
checks.push(['printPaper', 'dangerText on paper', pp.dangerText, pp.paper, 7.0]);

let failures = 0;
let minRatio = Infinity;

for (const [mode, label, fg, bg, required] of checks) {
  const ratio = contrastRatio(fg, bg);
  if (ratio < minRatio) minRatio = ratio;
  if (ratio < required) {
    console.error(
      `[wcag-aaa] FAIL [${mode}] ${label}: ${ratio.toFixed(2)}:1 < ${required.toFixed(1)}:1 (${fg} on ${bg})`,
    );
    failures++;
  }
}

// Verify tokens.css contains key hex definitions from tokens.json so CSS & TS never drift
const expectedCssPairs = [
  ['--bg-canvas', tokens.light.canvas],
  ['--bg-surface', tokens.light.surface],
  ['--text-primary', tokens.light.textPrimary],
  ['--accent-primary', tokens.light.accentPrimary],
  ['--bg-canvas', tokens.dark.canvas],
  ['--bg-surface', tokens.dark.surface],
  ['--text-primary', tokens.dark.textPrimary],
  ['--accent-primary', tokens.dark.accentPrimary],
];

for (const [cssVar, hex] of expectedCssPairs) {
  if (!tokensCss.includes(`${cssVar}: ${hex}`)) {
    console.error(`[wcag-aaa] tokens.css out of sync with tokens.json for ${cssVar}: ${hex}`);
    failures++;
  }
}

// Verify tokens.json stays in sync with @sim-tracker/shared SHARED_THEME_COLORS
for (const mode of ['light', 'dark']) {
  const shared = SHARED_THEME_COLORS[mode];
  const local = tokens[mode];
  const scalarKeys = [
    'canvas',
    'surface',
    'surfaceRaised',
    'surfaceSunken',
    'textPrimary',
    'textSecondary',
    'textMuted',
    'borderSubtle',
    'borderDefault',
    'borderStrong',
    'accentPrimary',
    'accentHover',
    'accentOnPrimary',
    'accentLink',
  ];
  for (const key of scalarKeys) {
    if (shared[key] !== local[key]) {
      console.error(
        `[wcag-aaa] tokens.json (${mode}.${key}=${local[key]}) out of sync with @sim-tracker/shared (${shared[key]})`,
      );
      failures++;
    }
  }
  for (const statusName of Object.keys(shared.status)) {
    for (const part of ['bg', 'fg', 'border']) {
      if (shared.status[statusName][part] !== local.status[statusName][part]) {
        console.error(
          `[wcag-aaa] tokens.json (${mode}.status.${statusName}.${part}) out of sync with @sim-tracker/shared`,
        );
        failures++;
      }
    }
  }
}

if (failures > 0) {
  console.error(`[wcag-aaa] Failed with ${failures} contrast/sync violation(s).`);
  process.exit(1);
}

console.log(
  `[wcag-aaa] OK — verified ${checks.length} WCAG AAA contrast pairs (light, dark, printPaper); lowest ratio: ${minRatio.toFixed(2)}:1.`,
);
