import test from 'node:test';
import assert from 'node:assert/strict';
import { readStorage,writeStorage,removeStorage,parsePlanDraft } from '../src/lib/browser-storage.ts';
import { matchingPlans,nextActions,overlappingPlans } from '../src/lib/usability.ts';
import type { Circle,Plan } from '../src/lib/types.ts';
const plan:Plan={id:'p',title:'קָפֶה ביחד',description:'',revision:0,updated:0,place:'הטיילת',vibe:'קפה',creator:'a',created:0,confirmed:'s',cancelled:false,attendance:{},chatExpires:1000,slots:[{id:'s',start:100,end:200,votes:{a:'yes'}}],messages:[]};
const circle:Circle={id:'c',name:'חברים',owner:'a',invite:'',members:[],plans:[plan]};
test('denied or full browser storage cannot crash theme or draft flows',()=>{
 assert.equal(readStorage({getItem(){throw new Error('denied')}},'x'),null);
 assert.equal(writeStorage({setItem(){throw new Error('full')}},'x','y'),false);
 assert.doesNotThrow(()=>removeStorage({removeItem(){throw new Error('denied')}},'x'));
});
test('draft decoder accepts valid data and rejects malformed, oversized or invalid values',()=>{
 const draft={title:'קפה',description:'',where:'קמפוס',vibe:'קפה',duration:60,slots:['2026-10-25T18:00']};
 assert.deepEqual(parsePlanDraft(JSON.stringify(draft)),draft);
 for(const input of ['bad',JSON.stringify({...draft,duration:-1}),JSON.stringify({...draft,slots:['bad']}),'x'.repeat(8001)])assert.equal(parsePlanDraft(input),null);
});
test('Hebrew search ignores diacritics, normalizes spaces and requires every term',()=>{
 assert.equal(matchingPlans([plan],'קפה  טיילת').length,1);
 assert.equal(matchingPlans([plan],'קפה חסר').length,0);assert.equal(matchingPlans([plan],'').length,1);
});
test('overlap warning respects end-exclusive boundaries, cancellations and declined attendance',()=>{
 assert.equal(overlappingPlans([circle],{start:200,end:300},'a').length,0);
 assert.equal(overlappingPlans([circle],{start:150,end:250},'a').length,1);
 assert.equal(overlappingPlans([circle],{start:150,end:250},'a','p').length,0);
 assert.equal(overlappingPlans([{...circle,plans:[{...plan,attendance:{a:'no'}}]}],{start:150,end:250},'a').length,0);
 assert.equal(overlappingPlans([{...circle,plans:[{...plan,cancelled:true}]}],{start:150,end:250},'a').length,0);
});
test('personal next actions distinguish unanswered polls from attendance and exclude closed plans',()=>{
 assert.equal(nextActions([circle],'a',50)[0].kind,'attendance');
 assert.equal(nextActions([{...circle,plans:[{...plan,attendance:{a:'yes'}}]}],'a',50).length,0);
 const poll={...plan,confirmed:null,slots:[{...plan.slots[0],votes:{}}]};
 assert.equal(nextActions([{...circle,plans:[poll]}],'a',50)[0].kind,'vote');
 assert.equal(nextActions([{...circle,plans:[{...poll,cancelled:true}]}],'a',50).length,0);
});
