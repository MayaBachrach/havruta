'use client';
import Script from 'next/script';
import { useRef, useState } from 'react';
import type { Circle } from '@/lib/types';
import { isFree } from '@/lib/planning';

type TokenResponse = { access_token?: string; expires_in?: number; error?: string; scope?: string };
type OAuth = { initTokenClient: (config: { client_id: string; scope: string; include_granted_scopes: boolean; callback: (r: TokenResponse) => void; error_callback: () => void }) => { requestAccessToken: (options: { prompt: string }) => void }; revoke: (token: string, callback: () => void) => void; hasGrantedAllScopes: (r: TokenResponse, scope: string) => boolean };
declare global { interface Window { google?: { accounts: { oauth2: OAuth } } } }
const SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy';
export default function GoogleCalendar({ circle, onVote, demo }: { circle?: Circle; onVote: (plan: string, slot: string, vote: 'yes' | 'no') => Promise<void>; demo: boolean }) {
  const [ready, setReady] = useState(false), [loading, setLoading] = useState(false), [status, setStatus] = useState(''), [busy, setBusy] = useState<{ start: string; end: string }[] | null>(null);
  const token = useRef<string | null>(null), expiry = useRef(0);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const slots = circle?.plans.filter(p => !p.confirmed && !p.cancelled && p.chatExpires > Date.now()).flatMap(p => p.slots.filter(s => s.start > Date.now()).map(s => ({ ...s, plan: p.id, title: p.title }))) || [];
  async function load(accessToken: string) {
    setLoading(true); setStatus('בודקים זמינות, בלי לקרוא את תוכן האירועים…'); setBusy(null);
    try {
      const start = new Date(), end = new Date(start.getTime() + 90 * 86400000);
      const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ timeMin: start.toISOString(), timeMax: end.toISOString(), items: [{ id: 'primary' }] }) });
      if (res.status === 401) { token.current = null; throw new Error('ההרשאה פגה. יש להתחבר מחדש.'); }
      if (!res.ok) throw new Error('לא הצלחנו לקרוא זמינות. בדקו שה־Calendar API מופעל ושההרשאה אושרה.');
      const result = await res.json(), calendar = result.calendars?.primary;
      if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) throw new Error('היומן לא זמין. לא שינינו את ההצבעות שלך.');
      setBusy(calendar.busy); setStatus('הזמינות נקראה מהיומן הראשי שלך. אפשר לבחור אילו תשובות לשתף.');
    } catch (e) { setStatus(e instanceof Error && (e.name==='TimeoutError'||e.name==='AbortError') ? 'Google לא הגיב בזמן. לא שינינו את ההצבעות שלך. אפשר לנסות שוב.' : e instanceof Error ? e.message : 'החיבור לא הושלם.'); }
    finally { setLoading(false); }
  }
  function connect() {
    if (!clientId || !window.google || !ready) { setStatus('חיבור היומן עדיין לא מוכן.'); return; }
    if (token.current && Date.now() < expiry.current) { void load(token.current); return; }
    setStatus('ממתינים לאישור שלך ב־Google…');
    const client = window.google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, include_granted_scopes: false,
      callback: r => {
        if (r.error || !r.access_token || !window.google?.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) { setStatus('ההרשאה לא אושרה. לא נקרא מידע מהיומן.'); return; }
        token.current = r.access_token; expiry.current = Date.now() + (r.expires_in || 3600) * 1000 - 60000; void load(r.access_token);
      }, error_callback: () => setStatus('חלון ההתחברות נסגר או נחסם. אפשר לנסות שוב.') });
    client.requestAccessToken({ prompt: '' });
  }
  function disconnect() {
    if (token.current) window.google?.accounts.oauth2.revoke(token.current, () => {});
    token.current = null; expiry.current = 0; setBusy(null); setStatus('החיבור נותק. תשובות שכבר בחרת לשתף נשארות בסקר וניתן לשנות אותן.');
  }
  return <section className="panel calendar-panel">
    {clientId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setReady(true)} onReady={() => setReady(true)} onError={() => setStatus('לא ניתן לטעון את Google. בדקו את החיבור לאינטרנט.')} />}
    <div className="calendar-logo"><span className="g-blue">G</span><span>היומן נשאר שלך.</span></div>
    <h2>מפנים זמן לאנשים.</h2><p className="sub">השוו את הצעות המפגש לזמינות ביומן Google הראשי שלכם. שמות ותוכן האירועים נשארים פרטיים.</p>
    {!clientId ? <div className="notice">חיבור Google יופעל לאחר הגדרת האפליקציה ב־Google Cloud. בינתיים אפשר להצביע ידנית ולהוסיף כל מפגש שנקבע ליומן.</div> : <button className="button primary" onClick={connect} disabled={!ready || loading || demo}>{loading ? 'בודקים…' : busy ? 'רענון זמינות' : 'חיבור Google Calendar'}</button>}
    {demo && clientId && <p className="sub">חיבור יומן אישי זמין לאחר יציאה מההדגמה.</p>}
    <p className="status" role="status">{status}</p>
    {busy !== null && <><button className="text-button" onClick={disconnect}>ניתוק וביטול הרשאת Google</button><h3>הצעות הזמן של הקבוצה</h3><p className="sub">כל כפתור משתף רק תשובה אחת. ״פנוי ביומן״ אינו מבטיח שמתאים לך להיפגש.</p>{slots.length ? slots.map(s => { const free = isFree(s.start, s.end, busy); return <div className="calendar-slot" key={s.id}><div><strong>{s.title}</strong><small>{new Date(s.start).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</small></div><span className={free ? 'tag green' : 'tag peach'}>{free ? 'פנוי ביומן' : 'יש התנגשות'}</span><button className="button secondary" disabled={loading} onClick={async () => { setLoading(true); try { await onVote(s.plan, s.id, free ? 'yes' : 'no'); setStatus('התשובה עודכנה בקבוצה.'); } catch { setStatus('התשובה לא נשמרה. נסו שוב.'); } finally { setLoading(false); } }}>שיתוף התשובה</button></div>; }) : <p className="sub">אין כרגע הצעות זמן פתוחות בקבוצה הזו.</p>}</>}
    <div className="privacy-note">♧ הרשאת זמינות בלבד · ללא כתיבה ליומן · האסימון נשאר בזיכרון הדפדפן</div>
  </section>;
}
