import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'app');
const srcDir = path.join(rootDir, 'src');

function loadLocale(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  const fn = new Function('exports', 'module', transpiled.outputText);
  fn(mod.exports, mod);
  return mod.exports.default ?? mod.exports;
}

function collectLeaves(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      collectLeaves(v, key, out);
    } else {
      out.set(key, v);
    }
  }
  return out;
}

function walkTsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function inspectFile(filePath, usedKeys) {
  const content = fs.readFileSync(filePath, 'utf8');
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.ES2020, true, scriptKind);

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 't' &&
      node.arguments.length >= 1
    ) {
      const firstArg = node.arguments[0];
      if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
        usedKeys.add(firstArg.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

const bsDict = loadLocale(path.join(srcDir, 'i18n/locales/bs.ts'));
const enDict = loadLocale(path.join(srcDir, 'i18n/locales/en.ts'));

const bsLeaves = collectLeaves(bsDict);
const enLeaves = collectLeaves(enDict);

let errors = 0;

for (const key of bsLeaves.keys()) {
  if (!enLeaves.has(key)) {
    console.error(`[mobile:i18n] Missing in en.ts: "${key}"`);
    errors++;
  }
}
for (const key of enLeaves.keys()) {
  if (!bsLeaves.has(key)) {
    console.error(`[mobile:i18n] Extra in en.ts (missing in bs.ts): "${key}"`);
    errors++;
  }
}

for (const [key, val] of bsLeaves.entries()) {
  if (typeof val !== 'string' || val.trim().length === 0) {
    console.error(`[mobile:i18n] Empty string in bs.ts for "${key}"`);
    errors++;
  }
}
for (const [key, val] of enLeaves.entries()) {
  if (typeof val !== 'string' || val.trim().length === 0) {
    console.error(`[mobile:i18n] Empty string in en.ts for "${key}"`);
    errors++;
  }
}

const usedKeys = new Set();
for (const file of [...walkTsFiles(appDir), ...walkTsFiles(srcDir)]) {
  inspectFile(file, usedKeys);
}

for (const key of usedKeys) {
  if (!bsLeaves.has(key)) {
    console.error(`[mobile:i18n] Unknown i18n key used in code: "${key}"`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`[mobile:i18n] Failed with ${errors} error(s).`);
  process.exit(1);
}

console.log(
  `[mobile:i18n] OK — ${bsLeaves.size} keys in parity between bs.ts & en.ts; ${usedKeys.size} literal t() keys verified.`,
);
