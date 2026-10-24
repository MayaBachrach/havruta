'use client';
import { useCallback, useEffect, useRef, useState, useId, type ReactNode, type FormEvent } from 'react';
import type { Circle, Plan, Slot, Snapshot, Vote } from '@/lib/types';
import { HOUR, nearbyGroups, nearbyAreas, coarseArea } from '@/lib/planning';
import { demoSnapshot } from '@/lib/demo';
import GoogleCalendar from './google-calendar';
import Agenda from './agenda';
import Avatar from './avatar';
import PlanCard from './plan-card';
import PlanForm from './plan-form';
import {clientId} from '@/lib/client-id';
import {timeLabel,icons} from '@/lib/presentation';
import {matchingPlans,nextActions} from '@/lib/usability';
import {readStorage,writeStorage,preferenceStore,clearUserDrafts} from '@/lib/browser-storage';

type Tab = 'home' | 'plans' | 'calendar' | 'people';
type Modal = 'plan' | 'circle' | 'join' | 'profile' | 'place' | 'location' | 'help' | null;
function Dialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);const headingId=useId();
  useEffect(() => {
    const dialog=ref.current,previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    dialog?.showModal();
    return ()=>{if(dialog?.open)dialog.close();if(previous?.isConnected)previous.focus();};
  }, []);
  return <dialog ref={ref} className="dialog" aria-labelledby={headingId} onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}><div className="dialog-head"><h2 id={headingId}>{title}</h2><button className="icon-button" onClick={close} aria-label="סגירה">×</button></div>{children}</dialog>;
}
export default function Havruta() {
  const [data, setData] = useState<Snapshot | null>(null), [loaded, setLoaded] = useState(false), [demo, setDemo] = useState(false);
  const [tab, setTab] = useState<Tab>('home'), [circleId, setCircleId] = useState(''), [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState(''), [error, setError] = useState(''), [pending, setPending] = useState(false), [online, setOnline] = useState(true);
  const [name, setName] = useState(''), [invite, setInvite] = useState(''), [checkin, setCheckin] = useState('קמפוס'), [filter, setFilter] = useState('all');
  const [query,setQuery]=useState('');const [lastSynced,setLastSynced]=useState<number|null>(null);
  const [seedPlace, setSeedPlace] = useState(''), [dark, setDark] = useState(false), [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState<{ title: string; description: string; run: () => Promise<unknown> } | null>(null);
  const [geoPending,setGeoPending]=useState(false);const geoRequest=useRef(0);
  const deepLinkApplied = useRef(false);
  const etag=useRef<string|null>(null);
  const retryOperation=useRef<{fingerprint:string;id:string}|null>(null);
  const readInFlight=useRef(false);
  const lock = useRef(false), latest = useRef(0), noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const circle = data?.circles.find(c => c.id === circleId) || data?.circles[0];
  function revealPlan(id:string){document.getElementById(`plan-${id}`)?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
  function toast(message: string) { setNotice(message); clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 5000); }
  const load = useCallback(async () => {
    if(readInFlight.current||lock.current)return;
    readInFlight.current=true;
    const version = ++latest.current;
    try {
      const res = await fetch('/api/havruta', { cache: 'no-store',headers:etag.current?{'If-None-Match':etag.current}:{}, signal: AbortSignal.timeout(10000) });
      if(res.status===304){if(version===latest.current&&!lock.current){setOnline(true);setLastSynced(Date.now());}return;}
      if (!res.ok) throw new Error('לא הצלחנו לטעון את הקבוצות.');
      const next = await res.json();
      if (version === latest.current && !lock.current) { etag.current=res.headers.get('etag');setData(next.me ? next : null); setOnline(true);setLastSynced(Date.now()); }
    } catch { if(version===latest.current&&!lock.current)setOnline(false); }
    finally { readInFlight.current=false;setLoaded(true); }
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.get('invite')) { setInvite(params.get('invite')!); setModal('join'); }
    const isDark = readStorage(preferenceStore(),'havruta-theme') === 'dark'; setDark(isDark); document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    void load();
  }, [load]);
  useEffect(() => {
    if(!data || deepLinkApplied.current) return;
    const params=new URLSearchParams(location.hash.slice(1));
    const id=params.get('circle'),plan=params.get('plan');
    if(id && plan){
      const group=data.circles.find(c=>c.id===id);
      if(group?.plans.some(p=>p.id===plan)){
        setCircleId(id);setTab('plans');const target=group.plans.find(p=>p.id===plan)!;setFilter(target.cancelled||target.chatExpires<=Date.now()?'archive':'all');
        setTimeout(()=>revealPlan(plan),100);
      }else setError('כדי לפתוח את המפגש צריך להיות חברים בקבוצה. אפשר לבקש ממנהלת הקבוצה הזמנה.');
      deepLinkApplied.current=true;
    }
  },[data]);
  useEffect(()=>{
    window.scrollTo({top:0,behavior:'auto'});
    document.querySelector<HTMLElement>('main h1')?.focus({preventScroll:true});
  },[tab,circleId]);
  useEffect(() => {
    if (demo) return;
    const timer = setInterval(() => { if (!document.hidden && !lock.current) void load(); }, 5000);
    const refresh = () => { if (!document.hidden && !lock.current) void load(); };
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [demo, load]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => { clearInterval(timer); clearTimeout(noticeTimer.current); }; }, []);
  async function act(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (lock.current) throw new Error('בקשה אחרת עדיין נשמרת.');
    lock.current = true; ++latest.current; setPending(true); setError('');
    try {
      if (demo && data) {
        const next = structuredClone(data), c = next.circles.find(x => x.id === (input.circle || circle?.id));
        const p = c?.plans.find(x => x.id === input.plan);
        switch (input.action) {
          case 'addFavorite': next.favorites.unshift({id:clientId(),name:String(input.name),vibe:String(input.vibe)}); break;
          case 'removeFavorite': next.favorites = next.favorites.filter(f=>f.id!==input.id); break;
          case 'removeMember': if(c) c.members=c.members.filter(m=>m.id!==input.user); break;
          case 'profile': next.me.name = String(input.name); for (const group of next.circles) { const me = group.members.find(m => m.id === next.me.id); if (me) me.name = next.me.name; } break;
          case 'createCircle': { const id = clientId(); next.circles.unshift({ id, name: String(input.name), owner: next.me.id, invite: '', members: [{ id: next.me.id, name: next.me.name, owner: true, place: null, until: null }], plans: [] }); setCircleId(id); break; }
          case 'createPlan': if (c) c.plans.unshift({ id: clientId(), title: String(input.title),description:String(input.description||''),revision:0,updated:Date.now(), place: String(input.place), vibe: String(input.vibe), creator: next.me.id, created: Date.now(), confirmed: null, cancelled: false, attendance: {}, chatExpires: Date.now() + 7 * 24 * HOUR, slots: (input.slots as { start: number; end: number }[]).map(s => ({ ...s, id: clientId(), votes: { [next.me.id]: 'yes' } })), messages: [] }); break;
          case 'vote': { const s = p?.slots.find(s => s.id === input.slot); if (s) s.votes[next.me.id] = input.vote as Vote; break; }
          case 'confirm': if (p) { p.confirmed = String(input.slot); p.chatExpires = p.slots.find(s => s.id === input.slot)!.end + 24 * HOUR; } break;
          case 'editPlan': if(p){if(p.confirmed&&p.place!==input.place)p.attendance={};p.title=String(input.title);p.place=String(input.place);p.description=String(input.description||'');p.revision++;p.updated=Date.now();}break;
          case 'attendance': if(p) p.attendance[next.me.id]=input.response as Vote; break;
          case 'cancel': if (p) { p.cancelled = true; p.messages = []; p.chatExpires = 0; } break;
          case 'message': if (p && p.chatExpires > Date.now()) p.messages.push({ id: Date.now(), author: next.me.id, name: next.me.name, text: String(input.text), created: Date.now() }); break;
          case 'presence': { const me = c?.members.find(m => m.id === next.me.id); if (me) { me.area=input.area as {lat:number;lon:number}|null||null;me.place = input.area?null:input.place ? String(input.place) : null; me.until = input.place||input.area ? Date.now() + HOUR : null; } break; }
          case 'deleteCircle': case 'leave': next.circles = next.circles.filter(c => c.id !== input.circle); break;
          default: throw new Error('בהדגמה לא נשלחות הזמנות. צאו מההדגמה כדי ליצור קבוצה אמיתית.');
        }
        setData(next); return {};
      }
      const fingerprint=JSON.stringify(input);
      const requestId=retryOperation.current?.fingerprint===fingerprint?retryOperation.current.id:clientId();
      retryOperation.current={fingerprint,id:requestId};
      const res = await fetch('/api/havruta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({...input,requestId}), signal: AbortSignal.timeout(15000) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'השמירה לא הצליחה.');
      retryOperation.current=null;etag.current=null; setData(result.snapshot); setOnline(true);setLastSynced(Date.now()); if(input.action==='deleteProfile'){if(data)clearUserDrafts(data.me.id);setModal(null);setCircleId('');} if (result.circle) setCircleId(result.circle);
      return result;
    } catch (e) { const message = e instanceof Error && (e.name==='TimeoutError'||e.name==='AbortError') ? 'לא התקבל אישור שמירה מהשרת. אפשר לנסות שוב; נזהה את הבקשה ונמנע כפילות.' : e instanceof TypeError ? (/fetch|network|load failed/i.test(e.message)?'אין כרגע חיבור לשרת. הנתונים שבטופס נשארו כאן לניסיון נוסף.':'לא הצלחנו לבצע את הפעולה. הנתונים שבטופס נשמרו לניסיון נוסף.') : e instanceof Error ? e.message : 'משהו השתבש.'; setError(message); throw e; }
    finally { lock.current = false; setPending(false); }
  }
  // Event handlers intentionally keep failed forms open, with errors visible.
  const run = (input: Record<string, unknown>) => { void act(input).catch(() => {}); };
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); toast('הקישור הועתק. עכשיו רק שולחים לחברים.'); } catch { setInvite(value); setModal('join'); toast('לא הצלחנו להעתיק. אפשר להעתיק את הקישור מהשדה.'); } }
  function newPlan(place = '') { if (!data) { setModal('profile'); return; } if (!circle) { setName('');setModal('circle'); return; } setSeedPlace(place); setModal('plan'); }
  async function shareArea(){
    if(!circle||!navigator.geolocation){setError('המכשיר או הדפדפן אינם מאפשרים שיתוף אזור. אפשר לסמן מקום ידנית.');return;}
    const request=++geoRequest.current;setGeoPending(true);setError('');
    try{
      const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:12000,maximumAge:0}));
      if(request!==geoRequest.current)return;
      const area=coarseArea(position.coords.latitude,position.coords.longitude);
      await act({action:'presence',circle:circle.id,area});
      setModal(null);toast('אזור משוער שותף בקבוצה לשעה אחת. אפשר להפסיק בכל רגע.');
    }catch(e){if(request===geoRequest.current)setError(e && typeof e==='object' && 'code' in e?'לא התקבלה הרשאת מיקום או שהמיקום אינו זמין. לא שותף אזור. אפשר לסמן מקום ידנית.':'שיתוף האזור לא הושלם.');}
    finally{if(request===geoRequest.current)setGeoPending(false);}
  }
  function theme() { const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? 'dark' : 'light'; writeStorage(preferenceStore(),'havruta-theme', next ? 'dark' : 'light'); }
  const groups = circle ? nearbyGroups(circle.members, now) : [];
  const areaGroups=circle?nearbyAreas(circle.members,now):[];
  const activePlans = circle?.plans.filter(p => !p.cancelled && p.chatExpires > now) || [];
  const upcoming = activePlans.filter(p => p.confirmed && p.slots.some(s => s.id === p.confirmed && s.end > now));
  const openPlans = activePlans.filter(p => !p.confirmed && p.slots.some(s => s.start > now));
  const mePresence = circle?.members.find(m => m.id === data?.me.id);
  const filteredPlans = filter === 'confirmed' ? upcoming : filter === 'poll' ? openPlans : filter === 'archive' ? circle?.plans.filter(p => p.cancelled || p.chatExpires <= now) || [] : activePlans;
  const displayedPlans=matchingPlans(filteredPlans,query);
  const tasks=data?nextActions(data.circles,data.me.id,now):[];
  function openPlan(group:string,plan:string){const target=data?.circles.find(c=>c.id===group)?.plans.find(p=>p.id===plan);setCircleId(group);setTab('plans');setFilter(target&&(target.cancelled||target.chatExpires<=Date.now())?'archive':'all');setQuery('');setTimeout(()=>revealPlan(plan),100);}
  const modalTitles = { plan: 'יש רעיון. עכשיו קובעים.', circle: 'האנשים שבשבילם יוצאים מהבית', join: 'מצטרפים לחברותא', profile: 'איך קוראים לך?', place: 'שומרים מקום לפעם הבאה', location:'משתפים רק אזור, רק לשעה', help: 'קצת על חברותא' };
  if (!loaded) return <main className="loading"><div className="brand">חבר<span>ותא</span><i>✳</i></div><p>מכינים מקום לחברים…</p></main>;
  return <>
    <a className="skip" href="#content">דילוג לתוכן</a>
    {demo && <div className="demo-banner">מרחב הדגמה · החברים וההודעות לדוגמה · השינויים נשארים כאן בלבד <button onClick={() => { etag.current=null;setDemo(false); setData(null); setCircleId(''); void load(); }}>יציאה מההדגמה ←</button></div>}
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#" className="brand" aria-label="חברותא — בית" onClick={e => { e.preventDefault(); setTab('home'); }}>חבר<span>ותא</span><i>✳</i></a><p className="brand-tagline">נפגשים יותר. מתאמים פחות.</p>
        <nav aria-label="ניווט ראשי">{([['home', '⌂', 'הבית שלנו'], ['plans', '▦', 'המפגשים'], ['calendar', '◷', 'היומן שלי'], ['people', '♧', 'החברותות שלי']] as [Tab, string, string][]).map(([id, icon, label]) => <button key={id} className={tab === id ? 'nav-item active' : 'nav-item'} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><span>{icon}</span>{label}{id === 'plans' && openPlans.length > 0 && <b>{openPlans.length}</b>}</button>)}</nav>
        <div className="sidebar-note"><span className="tiny-star">✳</span><strong>״חייבים להיפגש״</strong><p>הפעם זה באמת יקרה.</p><button onClick={() => newPlan()} className="text-button">עושים את הצעד הראשון ←</button></div>
        <div className="sidebar-bottom"><button className="nav-item" onClick={theme}><span>{dark ? '☀' : '☾'}</span>{dark ? 'מצב בהיר' : 'מצב כהה'}</button><button className="nav-item" onClick={() => setModal('help')}><span>ⓘ</span>איך זה עובד?</button><div className="mini-profile"><Avatar name={data?.me.name || '?'} /><div><strong>{data?.me.name || 'נעים להכיר'}</strong><small>{demo ? 'רק מנסים, בלי להתחייב' : 'המקום שלך לחברים'}</small></div>{data && <button className="icon-button" aria-label="עריכת שם" onClick={() => { setName(data.me.name); setModal('profile'); }}>✎</button>}</div></div>
      </aside>
      <main className="main" id="content">
        <header className="topbar" aria-busy={pending}><div><span className="breadcrumb">החיים קורים בין התוכניות</span><h1 tabIndex={-1}>{tab === 'home' ? `היי${data ? ', ' + data.me.name : ''}. מה קורה היום?` : tab === 'plans' ? 'פחות ״מתי נוח?״. יותר ״נתראה״.' : tab === 'calendar' ? 'משאירים מקום לדברים הטובים.' : 'כל האנשים שלך, קרוב.'}</h1></div><div className="top-actions">{data && data.circles.length > 0 && <label className="sr-only" htmlFor="circle-select">הקבוצה הפעילה</label>}{data && data.circles.length > 0 && <select id="circle-select" value={circle?.id || ''} onChange={e => setCircleId(e.target.value)}>{data.circles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}<button className="button primary" onClick={() => data ? newPlan() : setModal('profile')}>＋ מפגש חדש</button></div></header>
        <div className={`sync-state ${!online?'offline':''}`} role="status"><span className="live-dot"/>{demo?'מצב הדגמה — השינויים כאן בלבד':pending?'שומרים את השינוי…':!online?'החיבור לשרת אינו זמין':lastSynced?`עודכן ב־${timeLabel(lastSynced)} · מתרענן כשהעמוד פתוח`:'טוענים נתונים…'}</div>{!online && <div className="error" role="alert">אין כרגע חיבור לשרת. הנתונים עשויים להיות לא מעודכנים. <button onClick={() => void load()}>ניסיון נוסף</button></div>}
        {error && <div className="error" role="alert">{error}<button onClick={() => setError('')} aria-label="סגירת הודעת שגיאה">×</button></div>}
        {!data ? <section className="welcome panel"><div className="welcome-art" aria-hidden="true"><span>☕</span><span>✦</span><span>♡</span><span>☕</span></div><span className="eyebrow">החברים כבר שם. חסר רק לקבוע.</span><h2>״בקרוב״ זה לא יום בשבוע.</h2><p>חברותא הופכת את ה״חייבים להיפגש״ לזמן ביומן.<br />פותחים קבוצה, מוצאים שעה, ופשוט מגיעים.</p><form onSubmit={e => { e.preventDefault(); void act({ action: 'register', name }).catch(() => {}); }}><label htmlFor="welcome-name">איך קוראים לך?</label><div className="inline-form"><input id="welcome-name" placeholder="השם שלך" value={name} onChange={e => setName(e.target.value)} required maxLength={30} autoComplete="given-name" /><button className="button primary" disabled={pending || !online}>בואו ניפגש ←</button></div></form><button className="text-button demo-entry" onClick={() => { ++latest.current;etag.current=null; setData(demoSnapshot()); setDemo(true); setCircleId('demo'); setError(''); setOnline(true); }}>רק להציץ? כניסה להדגמה אינטראקטיבית ↗</button><p className="micro">ללא סיסמה · זהות אורח נשמרת בדפדפן זה ל־30 יום · עדיין אין שחזור חשבון</p></section> : <>
          {tab === 'home' && <>
            <section className="hero"><div className="hero-copy"><span className="eyebrow">יותר רגעים ביחד</span><h2>הזמן הכי טוב להיפגש?<br />זה שקובעים<span>.</span></h2><p>הקפה, ההליכה, השיחה שנמשכת קצת יותר.<br />בואו נהפוך את זה לתוכנית.</p><button className="button ink" onClick={() => newPlan()}>קובעים משהו טוב <span>↙</span></button></div><div className="hero-art" aria-hidden="true"><div className="sun">✳</div><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="coffee-cup cup-one">☕</div><div className="coffee-cup cup-two">☕</div><span className="floating-note">זמן איכות &gt; זמן מסך</span><span className="sparkle">✧</span></div></section>
            <div className="stats"><div><span className="stat-icon lavender">▦</span><div><b>{openPlans.length}</b><span>מפגשים שמחכים לתשובה</span></div></div><div><span className="stat-icon mint">✓</span><div><b>{upcoming.length}</b><span>תוכניות שכבר סגרנו</span></div></div><div><span className="stat-icon peach">♧</span><div><b>{circle?.members.length || 0}</b><span>אנשים שכיף לפגוש</span></div></div></div>
            {tasks.length>0 && <section className="next-actions panel"><div><span className="eyebrow">בקטנה, ואז אפשר להיפגש</span><h2>מחכה רק לך</h2></div><div>{tasks.slice(0,3).map(task=><button key={task.plan} onClick={()=>openPlan(task.circle,task.plan)}><span className="task-symbol">{task.kind==='vote'?'◷':'✓'}</span><span><strong>{task.title}</strong><small>{task.label}</small></span><span>←</span></button>)}</div></section>}<div className="dashboard-grid"><div className="main-column"><div className="section-heading"><div><span className="eyebrow">נפגשים, לא רק מדברים על זה</span><h2>מה מתבשל אצלנו</h2></div><button className="text-button" onClick={() => setTab('plans')}>כל המפגשים ←</button></div>{!circle ? <Empty title="הכול מתחיל בחברותא אחת" text="בחרו שם לקבוצה, הזמינו את האנשים שלכם, ומצאו זמן ביחד." action="פותחים קבוצה" onClick={() => {setName('');setModal('circle');}} /> : activePlans.length ? activePlans.slice(0, 3).map(p => <PlanCard key={p.id} plan={p} circle={circle} me={data.me.id} act={act} pending={pending} now={now} ask={setConfirm} />) : <Empty title="התוכנית הבאה עוד לא נכתבה" text="קפה של שעה או ערב שלם — צריך רק רעיון אחד." action="יוצרים מפגש ראשון" onClick={() => newPlan()} />}</div><div className="side-column"><section className="panel spontaneous"><div className="line"><span className="tag green"><span className="live-dot"/> ספונטני זה אנחנו</span><span>✦</span></div><h2>קרובים? קופצים לקפה.</h2><p className="sub">צ׳ק־אין לשעה אחת, רק בקבוצה הזו. מקום ידני או אזור משוער באישור שלך. בלי מעקב ברקע.</p>{circle ? <><label htmlFor="checkin">איפה בא לך להיפגש?</label><div className="inline-form"><input id="checkin" list="places" maxLength={60} value={checkin} onChange={e => setCheckin(e.target.value)} /><datalist id="places"><option value="קמפוס"/><option value="מרכז העיר"/><option value="הטיילת"/></datalist><button className="button secondary" disabled={pending || !checkin.trim()} onClick={() => run({ action: 'presence', circle: circle.id, place: checkin.trim() })}>אני כאן</button></div>{(mePresence?.place || mePresence?.area) && (mePresence?.until || 0) > now && <div className="presence-self">שיתוף פעיל: {mePresence?.place || 'אזור משוער'} · עד {timeLabel(mePresence!.until!)} <button onClick={() => run({ action: 'presence', circle: circle.id, place: null })}>הפסקת שיתוף</button></div>}<button className="text-button share-area" onClick={()=>{setError('');setModal('location');}}>⌖ שיתוף אזור משוער באישור שלי</button>{areaGroups.map((g,i)=><div className="nearby" key={`area-${i}`}><strong>{g.map(m=>m.name).join(' ו־')} שיתפו אזורים סמוכים</strong><p>לפי מיקום מעוגל, לא זיהוי של אותו בית קפה. בוחרים יחד מקום לפני שיוצאים.</p><button className="button primary full" onClick={()=>newPlan('באזור שסימנו')}>מציעים קפה באזור ←</button></div>)}{groups.length ? groups.map(g => <div className="nearby" key={g[0].place}><div className="avatar-stack">{g.map((m, i) => <Avatar key={m.id} name={m.name} index={i} small />)}</div><strong>{g.length === circle.members.length ? 'כולם' : g.map(m => m.name).join(' ו־')} ב{g[0].place}</strong><p>יש כאן הזדמנות למפגש קטן.</p><button className="button primary full" onClick={() => newPlan(g[0].place!)}>מציעים מפגש כאן ←</button></div>) : <p className="micro">כששני חברים לפחות יסמנו אותו מקום, תופיע הצעה. בדיווח עצמי בלבד.</p>}</> : <button className="button secondary" onClick={() => {setName('');setModal('circle');}}>קודם יוצרים קבוצה</button>}</section><section className="panel people-preview"><div className="line"><h3>{circle?.name || 'החברותא שלך'}</h3><span className="tag">{circle?.members.length || 0} חברים</span></div><div className="avatar-stack">{circle?.members.slice(0, 6).map((m, i) => <Avatar key={m.id} name={m.name} index={i} />)}</div><p className="sub">האנשים שעושים את היומיום קצת יותר טוב.</p><button className="button outline full" onClick={() => setTab('people')}>לכל החברים וההזמנות ←</button></section><section className="panel favorites"><div className="line"><h3>מקומות שאהבנו ♡</h3><button className="text-button" onClick={() => {setName('');setModal('place');}}>＋ מקום</button></div>{data.favorites.length ? data.favorites.map(f=><div className="favorite-row" key={f.id}><span className="favorite-icon">{icons[f.vibe]||'⌖'}</span><button className="favorite-name" onClick={()=>newPlan(f.name)}><strong>{f.name}</strong><small>מציעים כאן מפגש ←</small></button><button className="icon-button" disabled={pending} aria-label={`הסרת ${f.name} מהמועדפים`} onClick={()=>run({action:'removeFavorite',id:f.id})}>♡</button></div>) : <p className="sub">בית הקפה הקבוע, פינה בפארק. המקומות שלך נשמרים רק עבורך.</p>}</section><div className="little-note"><span>♡</span><p>לא חייבים אירוע מיוחד.<br /><strong>להיפגש זו סיבה מספיק טובה.</strong></p></div></div></div>
          </>}
          {tab === 'plans' && <><div className="section-heading"><h2>התוכניות של {circle?.name || 'כולנו'}</h2><div className="filters" aria-label="סינון מפגשים">{[['all', 'פעילים'], ['poll', 'מחכים לתשובה'], ['confirmed', 'קבענו!'], ['archive', 'ארכיון']].map(([id, label]) => <button key={id} aria-pressed={filter === id} className={filter === id ? 'selected' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div></div><div className="plan-search"><label htmlFor="plan-search">חיפוש בשם המפגש או במקום</label><div className="inline-form"><input id="plan-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="קפה, שקיעה, הטיילת…"/>{query && <button className="button outline" onClick={()=>setQuery('')}>ניקוי</button>}</div><p className="micro" role="status">{displayedPlans.length} מפגשים מוצגים</p></div><div className="plans-grid">{circle && displayedPlans.length ? displayedPlans.map(p => <PlanCard key={p.id} plan={p} circle={circle} me={data.me.id} act={act} pending={pending} now={now} ask={setConfirm} />) : <Empty title={query?'לא מצאנו התאמה לחיפוש':'עוד אין כאן תוכניות'} text={query?'אפשר לנסות שם אחר או לנקות את החיפוש. הסינון חל על הקבוצה שנבחרה.':'ברגע שיהיה מפגש שמתאים לסינון, הוא יופיע כאן.'} action="יוצרים מפגש" onClick={() => newPlan()} />}</div></>}
          {tab === 'calendar' && <><Agenda data={data} open={openPlan}/><GoogleCalendar circle={circle} demo={demo} onVote={async (plan, slot, vote) => { await act({ action: 'vote', plan, slot, vote }); }} /></>}
          {tab === 'people' && <div className="groups-layout"><section className="panel"><div className="section-heading"><div><span className="eyebrow">יש מקום לכולם</span><h2>החברותות שלי</h2></div><button className="button secondary" onClick={() => {setName('');setModal('circle');}}>＋ קבוצה</button></div>{data.circles.map(c => <button className={`circle-row ${circle?.id === c.id ? 'selected' : ''}`} key={c.id} onClick={() => setCircleId(c.id)}><span className="circle-icon">♧</span><span><strong>{c.name}</strong><small>{c.members.length} חברים · {c.owner === data.me.id ? 'בניהולך' : 'חברוּת בקבוצה'}</small></span><span>←</span></button>)}<button className="button outline full" onClick={() => { setInvite(''); setModal('join'); }}>יש לך הזמנה? מצטרפים לקבוצה</button></section>{circle && <section className="panel"><div className="section-heading"><h2>{circle.name}</h2><span className="tag">קבוצה פרטית בהזמנה</span></div><div className="member-list">{circle.members.map((m, i) => <div className="member" key={m.id}><Avatar name={m.name} index={i}/><div><strong>{m.name}{m.id === data.me.id ? ' (אני)' : ''}</strong><small>{m.owner ? 'מנהלת הקבוצה' : 'חברוּת בקבוצה'}{(m.place||m.area) && (m.until || 0) > now ? ` · ${m.place||'אזור משותף'}` : ''}</small></div>{circle.owner===data.me.id && m.id!==data.me.id && <button className="text-button remove-member" disabled={pending} onClick={()=>setConfirm({title:`להסיר את ${m.name}?`,description:'הגישה וההצבעות יוסרו. כדאי להחליף גם את קישור ההזמנה כדי למנוע הצטרפות חוזרת. הודעות קיימות נשארות עד תפוגת הצ׳אט.',run:()=>act({action:'removeMember',circle:circle.id,user:m.id})})}>הסרה</button>}</div>)}</div>{circle.owner === data.me.id ? <><div className="invite-box"><h3>אנשים טובים מביאים אנשים טובים.</h3><p>מי שמחזיק בקישור יכול להצטרף ולראות את מפגשי הקבוצה והצ׳אטים הפעילים. שתפו רק עם מי שרציתם להזמין.</p><button className="button primary" onClick={() => demo ? toast('בהדגמה אין קישור חי. צאו מההדגמה כדי להזמין חברים.') : void copy(`${location.origin}/#invite=${circle.invite}`)}>העתקת קישור הזמנה ↗</button><button className="text-button" disabled={pending || demo} onClick={() => setConfirm({ title: 'מחליפים קישור הזמנה?', description: 'הקישור הקודם יפסיק לעבוד. חברים קיימים יישארו בקבוצה.', run: () => act({ action: 'rotateInvite', circle: circle.id }) })}>החלפת קישור</button></div><button className="danger-link" onClick={() => setConfirm({ title: 'למחוק את הקבוצה?', description: 'כל המפגשים, ההצבעות והצ׳אטים בקבוצה יימחקו. אי אפשר לבטל את הפעולה.', run: () => act({ action: 'deleteCircle', circle: circle.id }) })}>מחיקת הקבוצה וכל הנתונים שלה</button></> : <button className="danger-link" onClick={() => setConfirm({ title: 'לצאת מהקבוצה?', description: 'הגישה לקבוצה וההצבעות שלך יוסרו. הודעות שכבר שלחת נשארות עד תפוגת הצ׳אט.', run: () => act({ action: 'leave', circle: circle.id }) })}>יציאה מהקבוצה</button>}</section>}</div>}
        </>}
        <footer>חברותא <span>✳</span> פחות תיאומים, יותר זיכרונות. <small>{demo ? 'הדגמה אינטראקטיבית' : 'גרסת ניסיון · זמן מקומי: ' + Intl.DateTimeFormat().resolvedOptions().timeZone}</small></footer>
      </main>
    </div>
    {notice && <div className="toast" role="status">✓ {notice}</div>}
    {modal && <Dialog title={modalTitles[modal]} close={() => { if (!pending) { if(modal==='location'){geoRequest.current++;setGeoPending(false);}setModal(null); setError(''); } }}>{error && <div className="error" role="alert">{error}</div>}
      {modal==='location' && <div><p>בלחיצה נבקש מהדפדפן מיקום פעם אחת, נעגל אותו לאזור של בערך קילומטר, ונשתף רק את האזור המעוגל עם חברי ״{circle?.name}״ לשעה.</p><p className="sub">הקואורדינטות המקוריות לא נשלחות לשרת חברותא. שיתוף האזור אינו מוכיח שכולם באותו מקום. אין איסוף ברקע ואין שמירת היסטוריית מיקום.</p><button className="button primary full" disabled={pending||geoPending||demo} onClick={()=>void shareArea()}>{geoPending?'ממתינים להרשאה ולאזור…':'שיתוף האזור המשוער בקבוצה לשעה'}</button><p className="micro">נדרש אתר מאובטח והרשאת מיקום בדפדפן. בהדגמה שיתוף מיקום כבוי; אפשר לנסות צ׳ק־אין ידני.</p></div>}
      {modal === 'place' && <form onSubmit={e=>{e.preventDefault();void act({action:'addFavorite',name,vibe:'קפה'}).then(()=>{setName('');setModal(null);toast('המקום נשמר.');}).catch(()=>{});}}><p className="sub">רשימת המקומות שלך פרטית. אפשר ליצור מפגש מהמועדפים בלחיצה.</p><label htmlFor="favorite-name">שם המקום</label><input id="favorite-name" value={name} onChange={e=>setName(e.target.value)} required maxLength={80} autoFocus/><button className="button primary full" disabled={pending || !name.trim()}>שמירת מקום ♡</button></form>}
      {modal === 'plan' && circle && <PlanForm allCircles={data?.circles||[]} me={data?.me.id||''} key={`${data?.me.id}:${circle.id}`} draftKey={`${demo?'demo':data?.me.id}:${circle.id}`} circle={circle} place={seedPlace} pending={pending} onSubmit={async input => { await act({ ...input, action: 'createPlan', circle: circle.id }); setModal(null); setTab('plans'); setFilter('all');setQuery(''); toast('יש תוכנית! החברים יכולים להצביע ולדבר בצ׳אט.'); }} />}
      {(modal === 'circle' || modal === 'profile') && <form onSubmit={e => { e.preventDefault(); void act({ action: modal === 'circle' ? 'createCircle' : data ? 'profile' : 'register', name }).then(() => { setModal(null); setName(''); if (modal === 'circle') setTab('people'); }).catch(() => {}); }}><p className="sub">{modal === 'circle' ? 'החברים מהלימודים, החבורה של שישי, או האנשים של הקפה.' : 'השם יופיע לחברים בקבוצות שלך.'}</p><label htmlFor="modal-name">{modal === 'circle' ? 'שם הקבוצה' : 'השם שלך'}</label><input id="modal-name" value={name} onChange={e => setName(e.target.value)} maxLength={modal === 'circle' ? 50 : 30} required autoFocus/><button className="button primary full" disabled={pending || !name.trim()}>{pending ? 'שומרים…' : modal === 'circle' ? 'יוצרים חברותא ←' : 'נעים להכיר ←'}</button>{modal==='profile' && data && !demo && <div className="profile-privacy"><p className="micro">זהות האורח נשמרת בדפדפן הזה. אין כרגע שחזור חשבון.</p><button className="danger-link" type="button" onClick={()=>setConfirm({title:'למחוק את הפרופיל והנתונים?',description:'הקבוצות שבניהולך, המפגשים שיצרת, ההודעות, התשובות והמועדפים שלך יימחקו. זה משפיע גם על החברים בקבוצות שלך. אין אפשרות לשחזר מתוך האפליקציה; עותקי גיבוי כפופים למדיניות האחסון.',run:()=>act({action:'deleteProfile'})})}>מחיקת הפרופיל והנתונים שלי</button></div>}</form>}
      {modal === 'join' && <form onSubmit={e => { e.preventDefault(); let key = invite.trim(); try { key = new URLSearchParams(new URL(key).hash.slice(1)).get('invite') || key; } catch {} void act({ action: 'join', invite: key }).then(() => { setModal(null); setTab('people'); history.replaceState(null, '', location.pathname); }).catch(() => {}); }}><p className="sub">הדביקו את קישור ההזמנה שקיבלתם ממנהלת הקבוצה. שם האורח שלך יהיה גלוי לחברי הקבוצה.</p>{!data ? <><label htmlFor="join-name">השם שלך</label><input id="join-name" maxLength={30} value={name} onChange={e => setName(e.target.value)} required/><button type="button" className="button primary full" disabled={pending || !name.trim()} onClick={() => run({ action: 'register', name })}>שמירת השם, ואז מצטרפים</button></> : <><label htmlFor="invite">קישור או קוד הזמנה</label><input id="invite" dir="ltr" value={invite} onChange={e => setInvite(e.target.value)} required maxLength={500}/><button className="button primary full" disabled={pending || !invite.trim()}>מצטרפים לקבוצה ←</button></>}</form>}
      {modal === 'help' && <div className="help"><p>חברותא נועדה לחברים שכבר מכירים ורוצים להיפגש יותר.</p><ol><li><strong>פותחים קבוצה.</strong> משתפים את קישור ההזמנה רק עם החברים.</li><li><strong>מציעים מפגש.</strong> עד חמש שעות אפשריות, וכל אחד עונה כן, אולי או לא.</li><li><strong>סוגרים שעה.</strong> יוצר המפגש בוחר, וכולם יכולים להוסיף ליומן.</li><li><strong>מדברים בצ׳אט.</strong> הוא נסגר 24 שעות אחרי המפגש; הצעה שלא נקבעה נסגרת אחרי שבוע. הודעות שפג תוקפן מוסרות בפעילות השרת הבאה או בבדיקת הניקוי שרצה כל חמש דקות כשהשרת פעיל.</li></ol><p>צ׳ק־אין הוא דיווח יזום לשעה אחת בקבוצה הנבחרת. אפשר לסמן מקום ידנית או לשתף אזור מעוגל לאחר הרשאת הדפדפן. אין מעקב ברקע, ולא נשלחות הזמנות אוטומטית.</p><p>גרסת ניסיון: זהות האורח תלויה בעוגייה בדפדפן הזה ל־30 יום. אין כרגע שחזור או מעבר מכשיר. צ׳אט מתעדכן כל 5 שניות כשהעמוד פתוח; אין התראות ברקע או הצפנה מקצה לקצה.</p><p>Google דורש הגדרת OAuth על ידי מפעילת האפליקציה. מוסרים רק תשובות שבחרת לשתף; פרטי יומן ואסימוני Google לא נשלחים לשרת חברותא.</p></div>}
    </Dialog>}
    {confirm && <Dialog title={confirm.title} close={() => !pending && setConfirm(null)}><p>{confirm.description}</p><div className="dialog-actions"><button className="button danger" disabled={pending} onClick={() => { void confirm.run().then(() => { setConfirm(null); toast('עודכן.'); }).catch(() => setConfirm(null)); }}>{pending ? 'מעדכנים…' : 'אישור'}</button><button className="button outline" onClick={() => setConfirm(null)} disabled={pending}>חזרה</button></div></Dialog>}
  </>;
}
function Empty({ title, text, action, onClick }: { title: string; text: string; action: string; onClick: () => void }) { return <section className="panel empty"><span>✧</span><h3>{title}</h3><p className="sub">{text}</p><button className="button secondary" onClick={onClick}>{action} ←</button></section>; }
