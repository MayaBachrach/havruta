'use client';
import {useState,type FormEvent} from 'react';
import type {Plan} from '@/lib/types';

export default function PlanEditor({plan,onSave,onClose,pending}:{plan:Plan;onSave:(data:Record<string,unknown>)=>Promise<unknown>;onClose:()=>void;pending:boolean}) {
  const [title,setTitle]=useState(plan.title),[place,setPlace]=useState(plan.place),[description,setDescription]=useState(plan.description);
  const [revision]=useState(plan.revision),[acknowledged,setAcknowledged]=useState(false),[error,setError]=useState('');
  async function submit(event:FormEvent){
    event.preventDefault();setError('');
    try{await onSave({action:'editPlan',plan:plan.id,title:title.trim(),place:place.trim(),description:description.trim(),revision,calendarAcknowledged:acknowledged});onClose();}
    catch(e){setError(e instanceof Error?e.message:'לא הצלחנו לשמור. הטקסט נשאר כאן לניסיון נוסף.');}
  }
  return <form className="plan-editor" onSubmit={submit} aria-busy={pending}>
    <h4>מעדכנים את הפרטים</h4>
    <p className="micro">השעות וההצבעות נשארות כפי שהן. רק יוצר המפגש יכול לערוך.</p>
    <label htmlFor={`edit-title-${plan.id}`}>שם המפגש</label>
    <input id={`edit-title-${plan.id}`} value={title} onChange={e=>setTitle(e.target.value)} maxLength={80} required autoFocus/>
    <label htmlFor={`edit-place-${plan.id}`}>מקום</label>
    <input id={`edit-place-${plan.id}`} value={place} onChange={e=>setPlace(e.target.value)} maxLength={80} required/>
    <label htmlFor={`edit-notes-${plan.id}`}>מה עוד כדאי לדעת? (לא חובה)</label>
    <textarea id={`edit-notes-${plan.id}`} value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} rows={3}/>
    {plan.confirmed && <><p className="conflict-note">החלפת מקום תבקש מכולם לאשר הגעה מחדש. אירועים שכבר נוספו ליומנים חיצוניים אינם מתעדכנים אוטומטית.</p><label className="checkbox-field"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} required/>הבנתי שצריך לעדכן גם את היומן החיצוני, אם נוסף אליו האירוע.</label></>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="dialog-actions"><button className="button primary" disabled={pending||!title.trim()||!place.trim()}>{pending?'שומרים…':'שמירת הפרטים'}</button><button type="button" className="button outline" onClick={onClose} disabled={pending}>סגירת העריכה ללא שמירה</button></div>
  </form>;
}
