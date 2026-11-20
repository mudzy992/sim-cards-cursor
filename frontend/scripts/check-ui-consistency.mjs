import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');

function walkFiles(dir, out = []) {
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

const files = walkFiles(srcDir);
let errors = 0;

for (const file of files) {
  const rel = path.relative(srcDir, file).replace(/\\/g, '/');
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

    if (
      !rel.startsWith('styles/') &&
      !rel.startsWith('config/') &&
      !rel.startsWith('utils/theme') &&
      /#[0-9a-fA-F]{6}\b/.test(line)
    ) {
      // Allow known semantic status/brand hexes inside Chart/Tag config maps? Better: flag legacy light-mode colors or check strictly if needed.
      if (/#007acc|#ffffff|#000000/i.test(line)) {
        console.error(
          `[ui-check] Forbidden hardcoded literal color in ${rel}:${lineNo} (use theme tokens)`,
        );
        errors++;
      }
    }
  });
}

if (errors > 0) {
  console.error(`[ui-check] Failed with ${errors} issue(s).`);
  process.exit(1);
}

console.log(`[ui-check] OK — scanned ${files.length} source files.`);
