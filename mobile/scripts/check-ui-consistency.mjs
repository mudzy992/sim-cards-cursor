import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const scanDirs = [path.join(rootDir, 'app'), path.join(rootDir, 'src')];

const LITERAL_HEX_RE = /#[0-9a-fA-F]{3,8}\b/;

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = scanDirs.flatMap((d) => walkFiles(d));
let errors = 0;

for (const file of files) {
  const rel = path.relative(rootDir, file).replace(/\\/g, '/');
  const isSpec = /\.(spec|test)\.(ts|tsx)$/.test(rel);
  const isThemeFile = rel.startsWith('src/theme/');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;

    if (/:\s*any\b|\bas\s+any\b|<any>/.test(line)) {
      console.error(`[mobile:ui-check] Forbidden explicit 'any' in ${rel}:${lineNo}`);
      errors++;
    }

    if (!isThemeFile && !isSpec && LITERAL_HEX_RE.test(line)) {
      console.error(
        `[mobile:ui-check] Forbidden hardcoded hex color in ${rel}:${lineNo} (use useTheme() / tokens)`,
      );
      errors++;
    }
  });
}

if (errors > 0) {
  console.error(`[mobile:ui-check] Failed with ${errors} violation(s).`);
  process.exit(1);
}

console.log(`[mobile:ui-check] OK — zero hardcoded hex colors or 'any' across ${files.length} files.`);
