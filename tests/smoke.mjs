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
 let r=await call('a',{action:'createCircle',name:'חברותא לבדיקה'});assert.equal(r.status,200,JSON.stringify(r));const circle=r.circle,invite=r.snapshot.circles[0].invite;
 assert.equal((await call('b',{action:'join',invite})).status,200);
 const start=Date.now()+3600000;r=await call('a',{action:'createPlan',circle,title:'קפה בדיקה',place:'קמפוס',vibe:'קפה',slots:[{start,end:start+3600000}]});assert.equal(r.status,200,JSON.stringify(r));
 const p=r.snapshot.circles[0].plans[0],plan=p.id,slot=p.slots[0].id;
 assert.equal((await call('x',{action:'message',plan,text:'unauthorized'})).status,401);
 assert.equal((await call('b',{action:'message',plan,text:'שלום מהדפדפן השני'})).status,200);
 assert.equal((await call('a')).circles[0].plans[0].messages[0].text,'שלום מהדפדפן השני');
 assert.equal((await call('a',{action:'vote',plan,slot,vote:'yes'},'https://evil.invalid')).status,403);
 assert.equal((await call('b',{action:'confirm',plan,slot})).status,403);
 assert.equal((await call('a',{action:'confirm',plan,slot})).status,200);
 assert.equal((await call('a',{action:'deleteCircle',circle})).status,200);
 console.log('HTTP smoke passed: two sessions, join, shared chat, auth, CSRF, creator controls, cascade deletion.');
}finally{server.kill('SIGTERM');await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,3000)});rmSync(dir,{recursive:true,force:true});}
