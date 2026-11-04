// Production build: the site is plain HTML, CSS and JS, so the export is an exact copy of src/.
// Clears dist/ first so a deleted source file cannot linger in the export.
import { cpSync, rmSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(src, dist, { recursive: true });

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const files = walk(dist);
const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
for (const file of files) console.log(relative(root, file));
console.log(`Built ${files.length} files, ${bytes} bytes.`);
