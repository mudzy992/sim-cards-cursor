#!/bin/bash
# Scans frontend/src for every literal t('a.b.c') / t("a.b.c") usage and verifies
# the key exists in BOTH bs.ts and en.ts. This is the check that would have
# caught the shipments.list.* bug (structural parity alone doesn't catch it,
# since a key can be missing from both files identically).
cd /home/claude/work/sim-cards-cursor-main/frontend/src
grep -rhoE "\bt\(\s*['\"][a-zA-Z0-9_.]+['\"]" --include="*.tsx" --include="*.ts" . \
  | sed -E "s/^t\(\s*['\"]//; s/['\"]$//" \
  | sort -u > /tmp/used_keys.txt

node -e "
const fs = require('fs');
function load(path, varName) {
  let s = fs.readFileSync(path, 'utf8');
  s = s.replace(\"import type { TranslationDictionary } from '../types';\", '');
  s = s.replace(': TranslationDictionary', '');
  s = s.replace('export default ' + varName + ';', 'module.exports = ' + varName + ';');
  const tmp = '/tmp/_xcheck_' + varName + '.js';
  fs.writeFileSync(tmp, s);
  delete require.cache[require.resolve(tmp)];
  return require(tmp);
}
const bs = load('i18n/locales/bs.ts', 'bs');
const en = load('i18n/locales/en.ts', 'en');
function has(obj, path) {
  const parts = path.split('.');
  let node = obj;
  for (const p of parts) {
    if (node == null || typeof node !== 'object' || !(p in node)) return false;
    node = node[p];
  }
  return typeof node === 'string';
}
const keys = fs.readFileSync('/tmp/used_keys.txt', 'utf8').split('\n').filter(Boolean);
let missing = [];
for (const k of keys) {
  const inBs = has(bs, k);
  const inEn = has(en, k);
  if (!inBs || !inEn) missing.push(k + '  (bs:' + inBs + ' en:' + inEn + ')');
}
console.log('Checked', keys.length, 'distinct t() key literals.');
if (missing.length) {
  console.log('MISSING (' + missing.length + '):');
  missing.forEach(m => console.log(' -', m));
  process.exit(1);
} else {
  console.log('All used keys resolve in both bs and en. OK.');
}
"
