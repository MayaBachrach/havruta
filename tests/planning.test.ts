import test from 'node:test';
import assert from 'node:assert/strict';
import { bestSlots, calendarFile, isFree, nearbyGroups, coarseArea, nearbyAreas, parseLocalDateTime } from '../src/lib/planning.ts';
import type { Member, Slot } from '../src/lib/types.ts';
test('ranking counts only current members and breaks ties by time', () => {
 const slots: Slot[] = [{ id:'late',start:20,end:30,votes:{a:'yes' as const,outsider:'yes' as const} },{id:'early',start:10,end:15,votes:{a:'yes' as const}}];
 assert.equal(bestSlots(slots,['a'])[0].id,'early'); assert.equal(slots[0].id,'late');
});
test('co-location requires matching explicit unexpired check-ins', () => {
 const members: Member[] = [' קמפוס ', 'קמפוס', 'מרכז', 'קמפוס'].map((place,i)=>({id:String(i),name:String(i),owner:false,place,until:i===3?90:110}));
 assert.deepEqual(nearbyGroups(members,100).map(g=>g.map(m=>m.id)),[['0','1']]);
});
test('busy boundaries are end exclusive', () => {
 const busy=[{start:'2026-10-25T10:00:00Z',end:'2026-10-25T11:00:00Z'}];
 assert.equal(isFree(Date.parse(busy[0].end),Date.parse('2026-10-25T12:00:00Z'),busy),true);
 assert.equal(isFree(Date.parse('2026-10-25T10:30:00Z'),Date.parse('2026-10-25T11:30:00Z'),busy),false);
});
test('calendar export escapes injection and folds Hebrew at byte boundaries', () => {
 const result=calendarFile('safe','שלום'.repeat(60)+'\nEND:VEVENT','a,b;c',0,3600000);
 assert.ok(result.includes('LOCATION:a\\,b\\;c'));
 assert.equal(result.split('\r\n').filter(l=>l==='END:VEVENT').length,1);
 for(const line of result.split('\r\n')) assert.ok(Buffer.byteLength(line)<=75);
});

test('coarse locations are rounded before sharing and invalid coordinates rejected',()=>{
 assert.deepEqual(coarseArea(32.081234,34.791234),{lat:32.08,lon:34.79});
 assert.throws(()=>coarseArea(91,0));assert.throws(()=>coarseArea(0,Infinity));
});
test('nearby area suggestions exclude expired check-ins and never bridge a distant chain',()=>{
 const members:Member[]=[0,0.015,0.03].map((lon,i)=>({id:String(i),name:String(i),owner:false,place:null,area:{lat:0,lon},until:110}));
 const groups=nearbyAreas(members,100);assert.ok(groups.length>=1);assert.ok(groups.every(g=>g.length===2));
 assert.equal(nearbyAreas(members,111).length,0);
 const distant=[members[0],{...members[1],area:{lat:40,lon:40}}];assert.equal(nearbyAreas(distant,100).length,0);
});

test('local datetime validation rejects invalid dates and nonexistent DST times',()=>{
 const previous=process.env.TZ;process.env.TZ='America/New_York';
 try{
  assert.ok(Number.isNaN(parseLocalDateTime('2026-03-08T02:30')));
  assert.ok(Number.isFinite(parseLocalDateTime('2026-03-08T03:30')));
  assert.ok(Number.isNaN(parseLocalDateTime('2026-02-30T18:00')));
  assert.ok(Number.isNaN(parseLocalDateTime('not a date')));
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
