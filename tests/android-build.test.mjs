import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const prepare = fileURLToPath(new URL('../scripts/prepare-ocr-assets.mjs', import.meta.url));
const build = fileURLToPath(new URL('../scripts/build-android.mjs', import.meta.url));

test('OCR preparation creates all packaged resources from dependencies and rejects a missing model', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'pmc-ocr-build-test-'));
  const resources = [
    ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
    ...['tesseract-core.wasm.js', 'tesseract-core-simd.wasm.js', 'tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'].map(name => [`tesseract.js-core/${name}`, name]),
    ...['chi_sim', 'chi_tra', 'jpn', 'kor', 'eng'].map(name => [`@tesseract.js-data/${name}/4.0.0_best_int/${name}.traineddata.gz`, `${name}.traineddata.gz`]),
    ['tesseract.js-core/LICENSE', 'LICENSE-core.txt'],
  ];
  try {
    assert.equal(existsSync(join(fixture, 'public/ocr')), false);
    for (const [source] of resources.filter(([, target]) => target !== 'eng.traineddata.gz')) {
      const path = join(fixture, 'node_modules', source);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `dependency fixture: ${source}`);
    }
    const missing = spawnSync(process.execPath, [prepare], { cwd: fixture, encoding: 'utf8' });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /eng\.traineddata\.gz/);
    const eng = join(fixture, 'node_modules', resources.find(([, target]) => target === 'eng.traineddata.gz')[0]);
    mkdirSync(dirname(eng), { recursive: true });
    writeFileSync(eng, 'English model fixture');
    const complete = spawnSync(process.execPath, [prepare], { cwd: fixture, encoding: 'utf8' });
    assert.equal(complete.status, 0, complete.stderr);
    for (const [source, target] of resources) {
      assert.deepEqual(readFileSync(join(fixture, 'public/ocr', target)), readFileSync(join(fixture, 'node_modules', source)));
    }
  } finally {
    // mkdtemp creates this test-owned directory under the system temporary directory.
    assert.equal(dirname(fixture), tmpdir());
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('Unsigned Android validation refuses a signed QA probe before accessing tools or keys', () => {
  const result = spawnSync(process.execPath, [build, '--unsigned', '--qa'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--unsigned cannot be combined/);
});
