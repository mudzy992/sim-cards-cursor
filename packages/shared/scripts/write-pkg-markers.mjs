import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.mkdirSync(path.join(root, 'dist', 'cjs'), { recursive: true });
fs.mkdirSync(path.join(root, 'dist', 'esm'), { recursive: true });

fs.writeFileSync(
  path.join(root, 'dist', 'cjs', 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
);
fs.writeFileSync(
  path.join(root, 'dist', 'esm', 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
);
