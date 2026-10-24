// Browser storage is optional: privacy mode, denied access or a full quota must never break the app.
export function readStorage(storage: Pick<Storage,'getItem'> | undefined, key:string):string|null {
  try{return storage?.getItem(key)??null;}catch{return null;}
}
export function writeStorage(storage: Pick<Storage,'setItem'> | undefined,key:string,value:string):boolean {
  try{if(!storage)return false;storage.setItem(key,value);return true;}catch{return false;}
}
export function removeStorage(storage: Pick<Storage,'removeItem'> | undefined,key:string):void {
  try{storage?.removeItem(key);}catch{/* Storage is a convenience, not a prerequisite. */}
}
export function sessionStore():Storage|undefined {try{return typeof window==='undefined'?undefined:window.sessionStorage;}catch{return undefined;}}
export function preferenceStore():Storage|undefined {try{return typeof window==='undefined'?undefined:window.localStorage;}catch{return undefined;}}
export type PlanDraft={title:string;where:string;description:string;vibe:string;duration:number;slots:string[]};
export function parsePlanDraft(raw:string|null):PlanDraft|null {
  if(!raw||raw.length>8000)return null;
  try{
    const d=JSON.parse(raw);
    if((d.description!==undefined&&(typeof d.description!=='string'||d.description.length>500))||typeof d.title!=='string'||d.title.length>80||typeof d.where!=='string'||d.where.length>80||!['קפה','אוכל','בחוץ','משחקים','אחר'].includes(d.vibe)||![30,60,90,120,180].includes(d.duration)||!Array.isArray(d.slots)||d.slots.length<1||d.slots.length>5||d.slots.some((s:unknown)=>typeof s!=='string'||s.length>30||!Number.isFinite(Date.parse(s))))return null;
    return {title:d.title,where:d.where,description:d.description||'',vibe:d.vibe,duration:d.duration,slots:d.slots};
  }catch{return null;}
}
export function clearUserDrafts(user:string){
  const storage=sessionStore();if(!storage)return;
  try{for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key?.startsWith(`havruta-draft:${user}:`))storage.removeItem(key);}}catch{/* Account deletion must still complete. */}
}
