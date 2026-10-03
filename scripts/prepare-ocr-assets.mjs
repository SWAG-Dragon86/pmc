import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('.');
const target = resolve(root, 'public/ocr');
await mkdir(target, { recursive: true });
const files = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ...['tesseract-core.wasm.js', 'tesseract-core-simd.wasm.js', 'tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'].map(name => [`tesseract.js-core/${name}`, name]),
  ...['chi_sim', 'chi_tra', 'jpn', 'kor', 'eng'].map(name => [`@tesseract.js-data/${name}/4.0.0_best_int/${name}.traineddata.gz`, `${name}.traineddata.gz`]),
  ['tesseract.js-core/LICENSE', 'LICENSE-core.txt'],
];
for (const [source, destination] of files)
  await copyFile(resolve(root, 'node_modules', source), resolve(target, destination));
console.log(`Prepared ${files.length} local OCR assets`);
