import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import { AppError, Store } from '../src/lib/store.ts';
import { HOUR } from '../src/lib/planning.ts';
function setup() {
 const s=new Store(':memory:'), a=s.register('מאיה'), b=s.register('נועה'), stranger=s.register('זר');
 const {circle}=s.action(a.id,{action:'createCircle',name:'חברים'}) as {circle:string};
 const invite=s.snapshot(a.id).circles[0].invite;
 s.action(b.id,{action:'join',invite});
 const {plan}=s.action(a.id,{action:'createPlan',circle,title:'קפה',place:'קמפוס',vibe:'קפה',slots:[{start:Date.now()+HOUR,end:Date.now()+2*HOUR}]}) as {plan:string};
 return {s,a,b,stranger,circle,plan,slot:s.snapshot(a.id).circles[0].plans[0].slots[0].id,invite};
}
test('tokens are hashed and unguessable; snapshots are membership scoped',()=>{
 const {s,a,b,stranger,plan}=setup();
 assert.notEqual(s.row('SELECT token FROM users WHERE id=?',a.id)!.token,a.token);
 assert.equal(s.identify(a.token)!.id,a.id); assert.equal(s.identify('wrong'),undefined);
 assert.equal(s.snapshot(stranger.id).circles.length,0);
 assert.equal(s.snapshot(b.id).circles[0].invite,'');
 assert.throws(()=>s.action(stranger.id,{action:'message',plan,text:'bad'}),(e:unknown)=>e instanceof AppError && e.status===403); s.db.close();
});
test('one vote per member, only creator can confirm, closed polls reject updates',()=>{
 const {s,a,b,plan,slot}=setup();
 s.action(b.id,{action:'vote',plan,slot,vote:'maybe'});s.action(b.id,{action:'vote',plan,slot,vote:'yes'});
 assert.equal(s.row('SELECT count(*) n FROM votes WHERE slot=? AND user=?',slot,b.id)!.n,1);
 assert.throws(()=>s.action(b.id,{action:'confirm',plan,slot}),AppError);
 s.action(a.id,{action:'confirm',plan,slot});
 assert.throws(()=>s.action(b.id,{action:'vote',plan,slot,vote:'no'}),AppError);
 assert.equal(s.snapshot(b.id).circles[0].plans[0].confirmed,slot);s.db.close();
});
test('expired and cancelled chats reject writes and purge stored messages',()=>{
 const {s,a,b,plan,slot}=setup();s.action(b.id,{action:'message',plan,text:'היי'});
 s.action(a.id,{action:'confirm',plan,slot});
 s.run('UPDATE slots SET end=? WHERE id=?',Date.now()-25*HOUR,slot);
 assert.throws(()=>s.action(b.id,{action:'message',plan,text:'too late'}),(e:unknown)=>e instanceof AppError&&e.status===410);
 assert.equal(s.snapshot(a.id).circles[0].plans[0].messages.length,0);
 assert.equal(s.row('SELECT count(*) n FROM messages')!.n,0);s.db.close();
});
test('invite rotation revokes old links and leaving removes access and votes',()=>{
 const {s,a,b,stranger,circle,plan,slot,invite}=setup();
 s.action(a.id,{action:'rotateInvite',circle});assert.throws(()=>s.action(stranger.id,{action:'join',invite}),AppError);
 s.action(b.id,{action:'vote',plan,slot,vote:'yes'});s.action(b.id,{action:'leave',circle});
 assert.equal(s.snapshot(b.id).circles.length,0);assert.equal(s.row('SELECT count(*) n FROM votes WHERE user=?',b.id)!.n,0);
 assert.throws(()=>s.action(b.id,{action:'message',plan,text:'bad'}),AppError);s.db.close();
});
test('plan validation is transactional and rejects invalid or duplicate times',()=>{
 const {s,a,circle}=setup(), before=s.row('SELECT count(*) n FROM plans')!.n;
 const input={action:'createPlan',circle,title:'test',place:'campus',vibe:'coffee'};
 assert.throws(()=>s.action(a.id,{...input,slots:[{start:0,end:1}]}),AppError);
 const start=Date.now()+HOUR;assert.throws(()=>s.action(a.id,{...input,slots:[{start,end:start+HOUR},{start,end:start+HOUR}]}),AppError);
 assert.equal(s.row('SELECT count(*) n FROM plans')!.n,before);s.db.close();
});
test('check-in expires and deletion cascades without affecting other groups',()=>{
 const {s,a,b,circle,plan}=setup();
 s.action(a.id,{action:'presence',circle,place:'קמפוס'});s.run('UPDATE members SET until=? WHERE circle=? AND user=?',Date.now()-1,circle,a.id);
 assert.equal(s.snapshot(a.id).circles[0].members.find(m=>m.id===a.id)!.place,null);
 s.action(b.id,{action:'message',plan,text:'bye'});assert.throws(()=>s.action(b.id,{action:'deleteCircle',circle}),AppError);
 s.action(a.id,{action:'deleteCircle',circle});assert.equal(s.row('SELECT count(*) n FROM messages')!.n,0);assert.equal(s.row('SELECT count(*) n FROM slots')!.n,0);s.db.close();
});
test('saved places are private and removal cannot delete another user favorite',()=>{
 const {s,a,b}=setup();s.action(a.id,{action:'addFavorite',name:'הטיילת',vibe:'בחוץ'});
 const favorite=s.snapshot(a.id).favorites[0];assert.equal(s.snapshot(b.id).favorites.length,0);
 s.action(b.id,{action:'removeFavorite',id:favorite.id});assert.equal(s.snapshot(a.id).favorites.length,1);
 s.action(a.id,{action:'removeFavorite',id:favorite.id});assert.equal(s.snapshot(a.id).favorites.length,0);s.db.close();
});
test('only owner can remove another member and access is revoked immediately',()=>{
 const {s,a,b,circle,plan,slot}=setup();s.action(b.id,{action:'vote',plan,slot,vote:'yes'});
 assert.throws(()=>s.action(b.id,{action:'removeMember',circle,user:a.id}),AppError);
 assert.throws(()=>s.action(a.id,{action:'removeMember',circle,user:a.id}),AppError);
 s.action(a.id,{action:'removeMember',circle,user:b.id});assert.equal(s.snapshot(b.id).circles.length,0);
 assert.equal(s.row('SELECT count(*) n FROM votes WHERE user=?',b.id)!.n,0);
 assert.throws(()=>s.action(b.id,{action:'message',plan,text:'bad'}),AppError);s.db.close();
});
test('expired guest sessions no longer authenticate',()=>{
 const s=new Store(':memory:'),a=s.register('test');s.run('UPDATE users SET created=? WHERE id=?',Date.now()-31*24*HOUR,a.id);
 assert.equal(s.identify(a.token),undefined);s.db.close();
});
test('attendance is explicit, membership scoped and distinct from availability votes',()=>{
 const {s,a,b,stranger,plan,slot,circle}=setup();
 assert.throws(()=>s.action(b.id,{action:'attendance',plan,response:'yes'}),AppError);
 s.action(a.id,{action:'confirm',plan,slot});
 assert.deepEqual(s.snapshot(a.id).circles[0].plans[0].attendance,{});
 s.action(b.id,{action:'attendance',plan,response:'no'});
 assert.equal(s.snapshot(a.id).circles[0].plans[0].attendance[b.id],'no');
 assert.throws(()=>s.action(stranger.id,{action:'attendance',plan,response:'yes'}),AppError);
 s.action(a.id,{action:'removeMember',circle,user:b.id});
 assert.equal(s.row('SELECT count(*) n FROM attendance')!.n,0);s.db.close();
});
test('idempotent retries create only one record and reject reuse for different actions',()=>{
 const s=new Store(':memory:'),a=s.register('מאיה');
 const request={action:'createCircle',name:'פעם אחת',requestId:'unique-operation-1'};
 const first=s.action(a.id,request),second=s.action(a.id,request);
 assert.deepEqual(second,first);assert.equal(s.snapshot(a.id).circles.length,1);
 assert.throws(()=>s.action(a.id,{...request,name:'changed'}),(e:unknown)=>e instanceof AppError&&e.status===409);
 s.db.close();
});
test('profile deletion removes authored content and owned groups, preserving other accounts',()=>{
 const {s,a,b,circle,plan,slot}=setup();
 const other=s.action(b.id,{action:'createCircle',name:'קבוצה שנייה'}) as {circle:string};
 const invite=s.snapshot(b.id).circles.find(c=>c.id===other.circle)!.invite;
 s.action(a.id,{action:'join',invite});
 s.action(a.id,{action:'message',plan,text:'מידע אישי'});
 s.action(b.id,{action:'vote',plan,slot,vote:'yes'});
 s.deleteProfile(a.id);
 assert.equal(s.identify(a.token),undefined);assert.equal(s.identify(b.token)!.id,b.id);
 assert.equal(s.row('SELECT count(*) n FROM messages')!.n,0);
 assert.equal(s.row('SELECT id FROM circles WHERE id=?',circle),undefined);
 assert.equal(s.snapshot(b.id).circles[0].id,other.circle);
 assert.equal(s.snapshot(b.id).circles[0].members.length,1);s.db.close();
});

test('persistent storage survives reopening and database permissions are private',()=>{
 const dir=mkdtempSync(join(tmpdir(),'havruta-persistence-')),path=join(dir,'app.sqlite');
 try{
   const first=new Store(path),a=first.register('מאיה');first.action(a.id,{action:'createCircle',name:'נשמר גם מחר'});first.db.close();
   const second=new Store(path);assert.equal(second.identify(a.token)!.id,a.id);assert.equal(second.snapshot(a.id).circles[0].name,'נשמר גם מחר');
   assert.equal(statSync(path).mode&0o777,0o600);second.db.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('server rounds coordinates, expires the area and rejects invalid values',()=>{
 const {s,a,circle}=setup();s.action(a.id,{action:'presence',circle,area:{lat:32.081234,lon:34.791234}});
 const m=s.snapshot(a.id).circles[0].members.find(m=>m.id===a.id)!;
 assert.deepEqual(m.area,{lat:32.08,lon:34.79});assert.equal(m.place,null);
 assert.throws(()=>s.action(a.id,{action:'presence',circle,area:{lat:200,lon:1}}),AppError);
 s.run('UPDATE members SET until=? WHERE user=?',Date.now()-1,a.id);
 assert.equal(s.snapshot(a.id).circles[0].members.find(m=>m.id===a.id)!.area,null);s.db.close();
});
test('editing is creator-only, revision guarded and preserves notes safely',()=>{
 const {s,a,b,plan}=setup();
 const edit={action:'editPlan',plan,title:'קפה מעודכן',place:'אותו מקום',description:'מביאים קלפים\nבלי לחץ',revision:0};
 assert.throws(()=>s.action(b.id,edit),(e:unknown)=>e instanceof AppError&&e.status===403);
 s.action(a.id,edit);const changed=s.snapshot(a.id).circles[0].plans[0];
 assert.equal(changed.description,edit.description);assert.equal(changed.revision,1);
 assert.throws(()=>s.action(a.id,{...edit,title:'stale'}),(e:unknown)=>e instanceof AppError&&e.status===409);
 assert.equal(s.snapshot(a.id).circles[0].plans[0].title,'קפה מעודכן');s.db.close();
});
test('confirmed venue changes require acknowledgment and reset attendance, title-only changes do not',()=>{
 const {s,a,b,plan,slot}=setup();s.action(a.id,{action:'confirm',plan,slot});s.action(b.id,{action:'attendance',plan,response:'yes'});
 const p=s.snapshot(a.id).circles[0].plans[0];
 const edit={action:'editPlan',plan,title:p.title,place:p.place,description:'',revision:p.revision};
 assert.throws(()=>s.action(a.id,edit),AppError);
 s.action(a.id,{...edit,title:'שם חדש',calendarAcknowledged:true});
 assert.equal(s.snapshot(a.id).circles[0].plans[0].attendance[b.id],'yes');
 s.action(a.id,{...edit,place:'מקום אחר',revision:p.revision+1,calendarAcknowledged:true});
 assert.deepEqual(s.snapshot(a.id).circles[0].plans[0].attendance,{});s.db.close();
});
test('overlong descriptions fail atomically without changing the revision',()=>{
 const {s,a,plan}=setup();assert.throws(()=>s.action(a.id,{action:'editPlan',plan,title:'title',place:'place',description:'x'.repeat(501),revision:0}),AppError);
 assert.equal(s.snapshot(a.id).circles[0].plans[0].revision,0);s.db.close();
});
test('checklist claims are exclusive and other members cannot overwrite completion',()=>{
 const {s,a,b,stranger,plan}=setup();
 const {item}=s.action(a.id,{action:'addItem',plan,text:'מחצלת'}) as {item:string};
 s.action(b.id,{action:'claimItem',plan,item});
 assert.throws(()=>s.action(a.id,{action:'claimItem',plan,item}),(e:unknown)=>e instanceof AppError&&e.status===409);
 assert.throws(()=>s.action(a.id,{action:'completeItem',plan,item,done:true}),AppError);
 assert.throws(()=>s.action(stranger.id,{action:'claimItem',plan,item}),AppError);
 s.action(b.id,{action:'completeItem',plan,item,done:true});assert.equal(s.snapshot(a.id).circles[0].plans[0].checklist[0].done,true);
 s.action(b.id,{action:'claimItem',plan,item,release:true});const released=s.snapshot(a.id).circles[0].plans[0].checklist[0];assert.equal(released.claimed,null);assert.equal(released.done,false);s.db.close();
});
test('member removal releases checklist responsibility and closed meetups reject changes',()=>{
 const {s,a,b,circle,plan}=setup();
 const {item}=s.action(b.id,{action:'addItem',plan,text:'מים'}) as {item:string};s.action(b.id,{action:'claimItem',plan,item});
 s.action(a.id,{action:'removeMember',circle,user:b.id});assert.equal(s.snapshot(a.id).circles[0].plans[0].checklist[0].claimed,null);
 s.action(a.id,{action:'cancel',plan});assert.throws(()=>s.action(a.id,{action:'addItem',plan,text:'מאוחר'}),AppError);s.db.close();
});
test('profile deletion removes authored checklist items and releases claims in other meetups',()=>{
 const {s,a,b,plan}=setup();const other=s.action(b.id,{action:'createCircle',name:'אחרת'}) as {circle:string};
 s.action(a.id,{action:'join',invite:s.snapshot(b.id).circles.find(c=>c.id===other.circle)!.invite});
 const start=Date.now()+HOUR;const {plan:otherPlan}=s.action(b.id,{action:'createPlan',circle:other.circle,title:'ערב',place:'קמפוס',vibe:'אחר',slots:[{start,end:start+HOUR}]}) as {plan:string};
 const {item}=s.action(b.id,{action:'addItem',plan:otherPlan,text:'משחק'}) as {item:string};s.action(a.id,{action:'claimItem',plan:otherPlan,item});
 s.action(a.id,{action:'addItem',plan:otherPlan,text:'פריט שלי'});s.deleteProfile(a.id);
 const items=s.snapshot(b.id).circles[0].plans[0].checklist;assert.equal(items.length,1);assert.equal(items[0].claimed,null);s.db.close();
});

test('checklist templates preserve claims, deduplicate and require membership',()=>{
 const {s,a,b,stranger,plan}=setup();
 const first=s.action(a.id,{action:'checklistTemplate',plan,template:'picnic',requestId:'template-1'});
 assert.equal(first.added,4);
 const item=s.snapshot(a.id).circles[0].plans[0].checklist[0];
 s.action(b.id,{action:'claimItem',plan,item:item.id});
 assert.equal(s.action(a.id,{action:'checklistTemplate',plan,template:'picnic'}).added,0);
 assert.deepEqual(s.action(a.id,{action:'checklistTemplate',plan,template:'picnic',requestId:'template-1'}),first);
 assert.equal(s.snapshot(a.id).circles[0].plans[0].checklist[0].claimed,b.id);
 assert.throws(()=>s.action(stranger.id,{action:'checklistTemplate',plan,template:'games'}),AppError);
 assert.throws(()=>s.action(a.id,{action:'checklistTemplate',plan,template:'toString'}),AppError);
 s.action(a.id,{action:'cancel',plan});
 assert.throws(()=>s.action(a.id,{action:'checklistTemplate',plan,template:'dinner'}),AppError);s.db.close();
});
test('a template exceeding checklist capacity leaves the entire list unchanged',()=>{
 const {s,a,plan}=setup();
 for(let i=0;i<28;i++)s.action(a.id,{action:'addItem',plan,text:`item ${i}`});
 assert.throws(()=>s.action(a.id,{action:'checklistTemplate',plan,template:'picnic'}),AppError);
 assert.equal(s.snapshot(a.id).circles[0].plans[0].checklist.length,28);s.db.close();
});
