import test from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import CrcCalculator from 'pngjs/lib/crc.js';
import { pngWithArtworkCredit } from '../src/png-artwork.mjs';

test('PNG attribution preserves image pixels and includes multilingual iTXt credits', () => {
  const input=new PNG({width:2,height:1});
  input.data.set([255,0,0,255,0,255,0,128]);
  const original=PNG.sync.write(input),notice='Emmuffin · 图片署名 · CC BY-NC 4.0';
  const result=Buffer.from(pngWithArtworkCredit(original,notice));
  assert.deepEqual(PNG.sync.read(result).data,input.data);
  const length=result.readUInt32BE(33);
  assert.equal(result.toString('ascii',37,41),'iTXt');
  assert.equal(result.toString('utf8',41,41+length),`Description\0\0\0\0\0${notice}`);
  assert.equal(result.readUInt32BE(41+length),CrcCalculator.crc32(result.subarray(37,41+length))>>>0);
});

test('PNG attribution refuses a non-PNG input', () => {
  assert.throws(()=>pngWithArtworkCredit(new Uint8Array(40),'credit'),/Expected PNG/);
});
