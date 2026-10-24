import type { Circle, Plan, Slot } from './types.ts';
export function normalizeSearch(value:string){return value.normalize('NFKD').replace(/[\u0591-\u05C7]/g,'').toLocaleLowerCase('he').replace(/\s+/g,' ').trim();}
export function matchingPlans(plans:Plan[],query:string){const terms=normalizeSearch(query).split(' ').filter(Boolean);return plans.filter(p=>{const text=normalizeSearch(`${p.title} ${p.place} ${p.vibe}`);return terms.every(term=>text.includes(term));});}
export function overlappingPlans(circles:Circle[],slot:Pick<Slot,'start'|'end'>,me:string,exclude=''){
  if(!Number.isFinite(slot.start)||!Number.isFinite(slot.end)||slot.end<=slot.start)return [];
  return circles.flatMap(circle=>circle.plans.flatMap(plan=>{
    const confirmed=plan.slots.find(s=>s.id===plan.confirmed);
    if(!confirmed||plan.cancelled||plan.id===exclude||plan.attendance[me]==='no'||slot.start>=confirmed.end||slot.end<=confirmed.start)return [];
    return [{circle:circle.name,plan:plan.title,id:plan.id,confirmedAttendance:plan.attendance[me]==='yes'}];
  }));
}
export function nextActions(circles:Circle[],me:string,now:number){
  return circles.flatMap(circle=>circle.plans.flatMap(plan=>{
    if(plan.cancelled||plan.chatExpires<=now)return [];
    const confirmed=plan.slots.find(s=>s.id===plan.confirmed);
    if(confirmed&&confirmed.end>now&&!plan.attendance[me])return [{circle:circle.id,plan:plan.id,title:plan.title,label:'רק לאשר אם מגיעים',kind:'attendance',time:confirmed.start}];
    const future=plan.slots.filter(s=>s.start>now);
    if(!plan.confirmed&&future.length&&!future.some(s=>s.votes[me]))return [{circle:circle.id,plan:plan.id,title:plan.title,label:'לבחור שעה שמתאימה לך',kind:'vote',time:Math.min(...future.map(s=>s.start))}];
    return [];
  })).sort((a,b)=>a.time-b.time);
}
