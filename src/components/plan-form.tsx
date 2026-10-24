'use client';
import {useState,useEffect,type FormEvent} from 'react';
import type {Circle} from '@/lib/types';
import {overlappingPlans} from '@/lib/usability';
import {HOUR,parseLocalDateTime} from '@/lib/planning';
import {toLocal,icons} from '@/lib/presentation';
import {parsePlanDraft,readStorage,writeStorage,removeStorage,sessionStore} from '@/lib/browser-storage';
export default function PlanForm({ circle, place, pending, onSubmit, draftKey, allCircles, me }: { circle: Circle; allCircles:Circle[]; me:string; place: string; draftKey:string; pending: boolean; onSubmit: (input: Record<string, unknown>) => Promise<void> }) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(18, 0, 0, 0);
  if (place) tomorrow.setTime(Math.ceil((Date.now() + 15 * 60000) / 300000) * 300000);
  const [description,setDescription]=useState('');
  const [title, setTitle] = useState(''), [where, setWhere] = useState(place), [vibe, setVibe] = useState('קפה'), [duration, setDuration] = useState(60), [slots, setSlots] = useState([toLocal(tomorrow.getTime())]), [error, setError] = useState('');
  const key=`havruta-draft:${draftKey}:plan`;
  const [ready,setReady]=useState(false),[dirty,setDirty]=useState(false),[draftStatus,setDraftStatus]=useState('');
  useEffect(()=>{
    const saved=parsePlanDraft(readStorage(sessionStore(),key));
    if(saved){setDescription(saved.description);setTitle(saved.title);setWhere(saved.where);setVibe(saved.vibe);setDuration(saved.duration);setSlots(saved.slots);setDirty(true);setDraftStatus('הטיוטה שלך שוחזרה. כדאי לבדוק שהתאריכים עדיין מתאימים.');}
    setReady(true);
  },[key]);
  useEffect(()=>{
    if(!ready||!dirty)return;
    const saved=writeStorage(sessionStore(),key,JSON.stringify({title,where,description,vibe,duration,slots}));
    setDraftStatus(saved?'טיוטה זמנית נשמרה בלשונית הזו. היא עדיין לא שותפה עם הקבוצה.':'הדפדפן לא מאפשר שמירת טיוטה. השאירו את החלון פתוח עד ליצירת המפגש.');
  },[ready,dirty,title,where,description,vibe,duration,slots,key]);
  function discard(){removeStorage(sessionStore(),key);setDirty(false);setDescription('');setTitle('');setWhere(place);setVibe('קפה');setDuration(60);setSlots([toLocal(tomorrow.getTime())]);setDraftStatus('הטיוטה נמחקה. אפשר להתחיל מחדש.');}
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    const times = slots.map(parseLocalDateTime);
    if(times.some(s=>!Number.isFinite(s))){setError('אחת השעות אינה תקינה. בדקו תאריך ושעה, כולל מעבר שעון קיץ.');return;}
    if (times.some(s => s < Date.now() + 60000 || s > Date.now() + 90 * 24 * HOUR)) { setError('בחרו שעות עתידיות ב־90 הימים הקרובים.'); return; }
    if (new Set(times).size !== times.length) { setError('יש שתי הצעות באותה שעה. בחרו שעות שונות.'); return; }
    try { await onSubmit({ title: title.trim(),description:description.trim(), place: where.trim(), vibe, slots: times.map(start => ({ start, end: start + duration * 60000 })) }); removeStorage(sessionStore(),key); } catch {}
  }
  return <form onSubmit={submit} onChange={()=>setDirty(true)} aria-busy={pending}><div className="draft-status" role="status"><span>{draftStatus||'פרטי הטיוטה נשארים בלשונית עד יצירת המפגש.'}</span>{dirty && <button type="button" className="text-button" onClick={discard}>מחיקת הטיוטה</button>}</div><p className="sub">הצעה חדשה ב״{circle.name}״. צ׳אט זמני נפתח אוטומטית, וכל חבר בוחר מה מתאים לו.</p><label htmlFor="plan-title">מה עושים?</label><input id="plan-title" placeholder="קפה של סוף היום, ערב משחקים…" value={title} onChange={e => setTitle(e.target.value)} maxLength={80} required autoFocus/><div className="vibes" aria-label="סוג המפגש">{Object.entries(icons).map(([key, icon]) => <button type="button" className={vibe === key ? 'selected' : ''} aria-pressed={vibe === key} onClick={() => {setDirty(true);setVibe(key);}} key={key}>{icon} {key}</button>)}</div><label htmlFor="plan-place">איפה נפגשים?</label><input id="plan-place" placeholder="מקום, שכונה או כתובת" value={where} onChange={e => setWhere(e.target.value)} maxLength={80} required/><label htmlFor="plan-notes">מה עוד כדאי לדעת? (לא חובה)</label><textarea id="plan-notes" value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} rows={3} placeholder="מה להביא, איך מזהים אתכם, או כל פרט שעוזר להיפגש"/><div className="line"><label htmlFor="duration">כמה זמן מפנים לזה?</label><select id="duration" value={duration} onChange={e => setDuration(Number(e.target.value))}>{[[30, 'חצי שעה'], [60, 'שעה'], [90, 'שעה וחצי'], [120, 'שעתיים'], [180, 'שלוש שעות']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><h3>מתי נוח? מציעים, ואז מצביעים.</h3><p className="micro">לפי אזור הזמן במכשיר שלך: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>{slots.map((s, i) => <div className="slot-input" key={i}><label className="sr-only" htmlFor={`date-${i}`}>הצעת זמן {i + 1}</label><input id={`date-${i}`} type="datetime-local" value={s} min={toLocal(Date.now() + 120000)} max={toLocal(Date.now() + 90 * 24 * HOUR)} required onChange={e => setSlots(slots.map((value, index) => index === i ? e.target.value : value))}/>{overlappingPlans(allCircles,{start:new Date(s).getTime(),end:new Date(s).getTime()+duration*60000},me).length>0 && <p className="conflict-note">יש חפיפה עם {overlappingPlans(allCircles,{start:new Date(s).getTime(),end:new Date(s).getTime()+duration*60000},me).map(c=>`״${c.plan}״ (${c.circle})`).join(', ')}. זו בדיקה מול מפגשי חברותא בלבד, לא מול כל היומנים.</p>}{slots.length > 1 && <button className="icon-button" type="button" aria-label={`הסרת הצעת זמן ${i + 1}`} onClick={() => {setDirty(true);setSlots(slots.filter((_, index) => index !== i));}}>×</button>}</div>)}{slots.length < 5 && <button className="text-button" type="button" onClick={() => {setDirty(true);const next=new Date(slots.at(-1)!);next.setDate(next.getDate()+1);setSlots([...slots,toLocal(next.getTime())]);}}>＋ עוד אפשרות</button>}{error && <p className="error" role="alert">{error}</p>}<button className="button primary full" disabled={pending || !title.trim() || !where.trim()}>{pending ? 'יוצרים…' : 'פותחים מפגש וצ׳אט ←'}</button></form>;
}
