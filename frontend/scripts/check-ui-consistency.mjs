import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');

const COLOR_EXEMPT_FILES = new Set([
  'pages/shipments/import/import-report.utils.ts',
  'pages/shipments/print/print-labels.css',
]);

const LEGACY_TW_PALETTE_RE =
  /\b(?:bg|text|border|ring|from|to|via)-(?:slate|gray|zinc|neutral|stone|white|black|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|brand)(?:-\d{2,3})?(?:\/\d+)?\b/;

const LITERAL_COLOR_RE = /#[0-9a-fA-F]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/;

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = walkFiles(srcDir);
let errors = 0;

for (const file of files) {
  const rel = path.relative(srcDir, file).replace(/\\/g, '/');
  const isSpec = /\.(spec|test)\.(ts|tsx)$/.test(rel);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;

    if (/\bdangerouslySetInnerHTML\b/.test(line)) {
      console.error(`[ui-check] Forbidden dangerouslySetInnerHTML in ${rel}:${lineNo}`);
      errors++;
    }

    if (/\bwindow\.(alert|confirm|prompt)\s*\(/.test(line)) {
      console.error(`[ui-check] Forbidden native dialog window.${RegExp.$1} in ${rel}:${lineNo}`);
      errors++;
    }

    if (/:\s*any\b|\bas\s+any\b|<any>/.test(line)) {
      console.error(`[ui-check] Forbidden explicit 'any' in ${rel}:${lineNo}`);
      errors++;
    }

    if (/<Button\b[^>]*\bhref=/.test(line)) {
      console.error(
        `[ui-check] Forbidden <Button href=...> in ${rel}:${lineNo} (use Link or navigate())`,
      );
      errors++;
    }

    if (/<Tag[\s>]/.test(line) && !isSpec) {
      console.error(
        `[ui-check] Forbidden ad-hoc <Tag> in ${rel}:${lineNo} (use <StatusBadge> from @/components/ui)`,
      );
      errors++;
    }

    if (!rel.startsWith('styles/') && !isSpec && LEGACY_TW_PALETTE_RE.test(line)) {
      console.error(
        `[ui-check] Forbidden legacy Tailwind color utility in ${rel}:${lineNo} (use semantic design tokens)`,
      );
      errors++;
    }

    if (
      !rel.startsWith('styles/') &&
      !COLOR_EXEMPT_FILES.has(rel) &&
      !isSpec &&
      LITERAL_COLOR_RE.test(line)
    ) {
      console.error(
        `[ui-check] Forbidden hardcoded literal color in ${rel}:${lineNo} (use CSS variables / design tokens)`,
      );
      errors++;
    }
  });
}

if (errors > 0) {
  console.error(`[ui-check] Failed with ${errors} issue(s).`);
  process.exit(1);
}

console.log(`[ui-check] OK — zero hardcodes verified across ${files.length} source files.`);
