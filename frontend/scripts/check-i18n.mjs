import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');

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

function extractTranslationKeys(filePath, usedKeys) {
  const content = fs.readFileSync(filePath, 'utf8');
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.ES2020, true, scriptKind);

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 't' &&
      node.arguments.length >= 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      usedKeys.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

const bs = loadLocale(path.join(srcDir, 'i18n/locales/bs.ts'));
const en = loadLocale(path.join(srcDir, 'i18n/locales/en.ts'));

const bsLeaves = collectLeaves(bs);
const enLeaves = collectLeaves(en);

let errors = 0;

for (const [key, val] of bsLeaves) {
  if (!enLeaves.has(key)) {
    console.error(`[i18n] Missing in en.ts: ${key}`);
    errors++;
  } else if (typeof val !== 'string' || val.trim().length === 0) {
    console.error(`[i18n] Empty/invalid value in bs.ts: ${key}`);
    errors++;
  }
}

for (const [key, val] of enLeaves) {
  if (!bsLeaves.has(key)) {
    console.error(`[i18n] Missing in bs.ts: ${key}`);
    errors++;
  } else if (typeof val !== 'string' || val.trim().length === 0) {
    console.error(`[i18n] Empty/invalid value in en.ts: ${key}`);
    errors++;
  }
}

const files = walkTsFiles(srcDir);
const usedKeys = new Set();

for (const file of files) {
  extractTranslationKeys(file, usedKeys);
}

for (const key of [...usedKeys].sort()) {
  if (!bsLeaves.has(key) || !enLeaves.has(key)) {
    console.error(
      `[i18n] Used literal key missing in locales: ${key} (bs=${bsLeaves.has(key)}, en=${enLeaves.has(key)})`,
    );
    errors++;
  }
}

if (errors > 0) {
  console.error(`[i18n] Failed with ${errors} error(s).`);
  process.exit(1);
}

console.log(
  `[i18n] OK — ${bsLeaves.size} keys in parity between bs.ts & en.ts; ${usedKeys.size} literal t() keys verified.`,
);
