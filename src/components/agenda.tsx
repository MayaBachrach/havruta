'use client';
import { useState } from 'react';
import type { Snapshot } from '@/lib/types';

export default function Agenda({ data, open }: { data: Snapshot; open: (circle: string, plan: string) => void }) {
  const [offset, setOffset] = useState(0), [selected, setSelected] = useState(0);
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() + offset);
  // Calendar days, not fixed 24-hour durations: a DST transition must not shift the displayed day.
  const days = Array.from({ length: 7 }, (_, index) => {
    const from = new Date(start); from.setDate(from.getDate() + index);
    const to = new Date(from); to.setDate(to.getDate() + 1);
    return { from, to };
  });
  const events = data.circles.flatMap(circle => circle.plans.flatMap(plan => {
    const slot = plan.slots.find(s => s.id === plan.confirmed);
    return slot && !plan.cancelled ? [{ circle, plan, slot }] : [];
  })).sort((a, b) => a.slot.start - b.slot.start);
  const day = days[selected];
  const shown = events.filter(e => e.slot.start < day.to.getTime() && e.slot.end > day.from.getTime());
  const format = (date: Date) => date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  return <section className="panel agenda"><div className="section-heading"><div><span className="eyebrow">כבר יש למה לצפות</span><h2>השבוע עם האנשים שלי</h2><p className="micro">המפגשים שנקבעו בכל הקבוצות שלך · לפי אזור הזמן במכשיר</p></div><div className="week-controls"><button className="icon-button" aria-label="שבוע קודם" disabled={offset<=-84} onClick={()=>{setOffset(offset-7);setSelected(0);}}>→</button><span>{format(days[0].from)}–{format(days[6].from)}</span><button className="icon-button" aria-label="שבוע הבא" disabled={offset>=84} onClick={()=>{setOffset(offset+7);setSelected(0);}}>←</button></div></div><div className="week-strip" role="group" aria-label="בחירת יום">{days.map(({from,to},index)=>{const count=events.filter(e=>e.slot.start<to.getTime()&&e.slot.end>from.getTime()).length;return <button key={from.toISOString()} className={index===selected?'selected':''} aria-pressed={index===selected} aria-label={`${from.toLocaleDateString('he-IL',{dateStyle:'full'})}, ${count} מפגשים`} onClick={()=>setSelected(index)}><span>{from.toLocaleDateString('he-IL',{weekday:'short'})}</span><strong>{from.getDate()}</strong><small>{count>0?`${count} מפגשים`:'ללא מפגשים'}</small></button>;})}</div><h3 className="agenda-day">{day.from.toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'})}</h3>{shown.length?shown.map(({circle,plan,slot})=><button className="agenda-event" key={plan.id} onClick={()=>open(circle.id,plan.id)}><span className="agenda-time" dir="ltr">{new Date(slot.start).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</span><span><strong>{plan.title}</strong><small>{circle.name} · {plan.place}</small></span><span className={`tag ${plan.attendance[data.me.id]==='yes'?'green':''}`}>{plan.attendance[data.me.id]==='yes'?'אישרת הגעה':plan.attendance[data.me.id]==='no'?'הפעם לא':plan.attendance[data.me.id]==='maybe'?'אולי מגיעים':'מחכה לאישור שלך'}</span><span>←</span></button>):<div className="agenda-empty"><span>✧</span><p>אין מפגשים שנקבעו ליום הזה.<br/><small>הזדמנות טובה לקבוע משהו קטן.</small></p></div>}</section>;
}
