import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeSerials, normalizeSerials} from '../src/lib/serials.js';
test('TXT and scanner deduplicate within a batch and preserve leading zeros',()=>{
  assert.deepEqual(normalizeSerials([' 000123 ','000123','','abc']),['000123','abc']);
  assert.deepEqual(mergeSerials(['old','000123'],['new','new','000123']),['new','000123','old']);
});
test('rejects invalid serials and too-large batches without mutating the original list',()=>{
  const original=['one'];
  assert.throws(()=>mergeSerials(original,['x'.repeat(129)]));
  assert.throws(()=>mergeSerials(original,['a\x00b']));
  assert.throws(()=>mergeSerials(original,Array.from({length:1000},(_,i)=>String(i))));
  assert.deepEqual(original,['one']);
});
