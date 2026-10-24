import test from 'node:test';
import assert from 'node:assert/strict';
import {clientId} from '../src/lib/client-id.ts';
test('uses native secure UUID when available',()=>{
 assert.equal(clientId({randomUUID:()=> 'native-id',getRandomValues:()=>{throw new Error('not needed')}}),'native-id');
});
test('preview-compatible fallback uses cryptographic bytes and correct UUID v4 bits',()=>{
 const id=clientId({getRandomValues:bytes=>{bytes.fill(7);return bytes;}});
 assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 assert.equal(id,'07070707-0707-4707-8707-070707070707');
});
