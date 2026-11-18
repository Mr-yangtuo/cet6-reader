import { cp, mkdir } from 'node:fs/promises';
const source = new URL('../node_modules/pdfjs-dist/', import.meta.url);
const target = new URL('../docs/vendor/pdfjs/', import.meta.url);
await mkdir(target, { recursive: true });
for (const name of ['legacy/build/pdf.min.mjs', 'legacy/build/pdf.worker.min.mjs']) {
  await cp(new URL(name, source), new URL(name.split('/').pop().replace(/\.mjs$/, '.js'), target));
}
for (const name of ['cmaps', 'standard_fonts', 'wasm', 'LICENSE']) {
  await cp(new URL(name, source), new URL(name, target), { recursive: true });
}
console.log('PDF.js copied locally; no external CDN required.');
