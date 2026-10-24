// Run explicitly with `npm run test:smoke`. Uses an isolated temporary database.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'havruta-smoke-')),base='http://127.0.0.1:3107';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3107'],{env:{...process.env,APP_ORIGIN:base,HAVRUTA_DB_PATH:join(dir,'test.sqlite'),NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',x=>logs+=x);server.stderr.on('data',x=>logs+=x);
const clients=new Map();
async function call(client,body,origin=base){const res=await fetch(base+'/api/havruta',{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:origin,...(clients.get(client)?{Cookie:clients.get(client)}:{})},body:body?JSON.stringify(body):undefined});const cookie=res.headers.get('set-cookie');if(cookie)clients.set(client,cookie.split(';')[0]);return {status:res.status,...await res.json()};}
try{
 let ready=false;for(let i=0;i<100;i++){try{await fetch(base);ready=true;break;}catch{await new Promise(r=>setTimeout(r,200));}}assert.ok(ready,logs);
 assert.equal((await call('a')).me,null);
 assert.equal((await call('a',{action:'register',name:'מאיה בדיקה'})).status,200);
 assert.equal((await call('b',{action:'register',name:'נועה בדיקה'})).status,200);
 const initial=await fetch(base+'/api/havruta',{headers:{Cookie:clients.get('a')}}),etag=initial.headers.get('etag');await initial.json();assert.ok(etag);
 const unchanged=await fetch(base+'/api/havruta',{headers:{Cookie:clients.get('a'),'If-None-Match':etag}});assert.equal(unchanged.status,304);assert.equal(await unchanged.text(),'');assert.equal(unchanged.headers.get('cache-control'),'no-store');
 const isolated=await fetch(base+'/api/havruta',{headers:{Cookie:clients.get('b'),'If-None-Match':etag}});assert.equal(isolated.status,200);assert.notEqual(isolated.headers.get('etag'),etag);await isolated.json();
 let r=await call('a',{action:'createCircle',name:'חברותא לבדיקה'});assert.equal(r.status,200,JSON.stringify(r));const circle=r.circle,invite=r.snapshot.circles[0].invite;
 const changed=await fetch(base+'/api/havruta',{headers:{Cookie:clients.get('a'),'If-None-Match':etag}});assert.equal(changed.status,200);await changed.json();
 assert.equal((await call('b',{action:'join',invite})).status,200);
 const start=Date.now()+3600000;const create={action:'createPlan',circle,title:'קפה בדיקה',description:'מביאים קלפים',place:'קמפוס',vibe:'קפה',requestId:'smoke-idempotency',slots:[{start,end:start+3600000}]};r=await call('a',create);assert.equal(r.status,200,JSON.stringify(r));
 const p=r.snapshot.circles[0].plans[0],plan=p.id,slot=p.slots[0].id;const replay=await call('a',create);assert.equal(replay.snapshot.circles[0].plans.length,1);assert.equal(replay.plan,plan);
 const checklistResult=await call('a',{action:'checklistTemplate',plan,template:'picnic'});assert.equal(checklistResult.added,4);
 const item=checklistResult.snapshot.circles[0].plans[0].checklist[0].id;
 assert.equal((await call('b',{action:'claimItem',plan,item})).status,200);
 assert.equal((await call('a',{action:'claimItem',plan,item})).status,409);
 assert.equal((await call('b',{action:'completeItem',plan,item,done:true})).status,200);
 assert.equal((await call('a',{action:'checklistTemplate',plan,template:'picnic'})).added,0);
 assert.equal((await call('a')).circles[0].plans[0].checklist[0].done,true);
 assert.equal((await call('x',{action:'message',plan,text:'unauthorized'})).status,401);
 assert.equal((await call('b',{action:'message',plan,text:'שלום מהדפדפן השני'})).status,200);
 assert.equal((await call('a')).circles[0].plans[0].messages[0].text,'שלום מהדפדפן השני');
 assert.equal((await call('a',{action:'vote',plan,slot,vote:'yes'},'https://evil.invalid')).status,403);
 assert.equal((await call('b',{action:'confirm',plan,slot})).status,403);
 assert.equal((await call('b',{action:'editPlan',plan,revision:0,title:'לא מורשה',place:'קמפוס'})).status,403);
 assert.equal((await call('a',{action:'editPlan',plan,revision:0,title:'קפה מעודכן',place:'קמפוס',description:'מביאים קלפים'})).status,200);
 assert.equal((await call('a',{action:'editPlan',plan,revision:0,title:'ישן',place:'קמפוס'})).status,409);
 assert.equal((await call('a',{action:'confirm',plan,slot})).status,200);
 assert.equal((await call('b',{action:'attendance',plan,response:'yes'})).status,200);assert.equal((await call('a',{action:'presence',circle,area:{lat:32.081234,lon:34.791234}})).status,200);assert.equal((await call('b')).circles[0].members.find(m=>m.id===r.snapshot.me.id).area.lat,32.08);assert.equal(Object.values((await call('a')).circles[0].plans[0].attendance)[0],'yes');
 const current=(await call('a')).circles[0].plans[0];
 assert.equal((await call('a',{action:'editPlan',plan,revision:current.revision,title:current.title,place:'קפה אחר',description:'',calendarAcknowledged:true})).status,200);
 assert.deepEqual((await call('b')).circles[0].plans[0].attendance,{});
 assert.equal((await call('a',{action:'deleteProfile'})).status,200);assert.equal((await call('a')).me,null);assert.equal((await call('b')).circles.length,0);
 console.log('HTTP smoke passed: two sessions, shared checklist templates, exclusive responsibility, completion, join, shared chat, auth, CSRF, private conditional refresh, creator controls, attendance reset, revision-safe editing, coarse location, retry deduplication and profile deletion.');
}finally{server.kill('SIGTERM');await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,3000)});rmSync(dir,{recursive:true,force:true});}
