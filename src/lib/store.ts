import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { CHAT_GRACE, HOUR, POLL_LIFETIME, coarseArea } from './planning.ts';
import type { Circle, Plan, Snapshot, Vote } from './types.ts';

export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
type Row = Record<string, string | number | null>;
const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');
const secret = () => randomBytes(24).toString('base64url');
function text(input: unknown, max = 80): string {
  if (typeof input !== 'string' || !input.trim() || input.trim().length > max) throw new AppError('יש למלא ערך תקין וקצר יותר.');
  return input.trim();
}
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if(path!==':memory:') chmodSync(path,0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, name TEXT NOT NULL, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS circles(id TEXT PRIMARY KEY, name TEXT NOT NULL, owner TEXT NOT NULL REFERENCES users(id), invite TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS members(circle TEXT REFERENCES circles(id) ON DELETE CASCADE, user TEXT REFERENCES users(id), place TEXT, until INTEGER, PRIMARY KEY(circle,user));
      CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY, circle TEXT REFERENCES circles(id) ON DELETE CASCADE, title TEXT, place TEXT, vibe TEXT, creator TEXT REFERENCES users(id), created INTEGER, confirmed TEXT, cancelled INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS slots(id TEXT PRIMARY KEY, plan TEXT REFERENCES plans(id) ON DELETE CASCADE, start INTEGER, end INTEGER);
      CREATE TABLE IF NOT EXISTS votes(slot TEXT REFERENCES slots(id) ON DELETE CASCADE, user TEXT REFERENCES users(id), vote TEXT CHECK(vote IN ('yes','maybe','no')), PRIMARY KEY(slot,user));
      CREATE TABLE IF NOT EXISTS attendance(plan TEXT REFERENCES plans(id) ON DELETE CASCADE, user TEXT REFERENCES users(id), response TEXT CHECK(response IN ('yes','maybe','no')), PRIMARY KEY(plan,user));
      CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT, plan TEXT REFERENCES plans(id) ON DELETE CASCADE, author TEXT REFERENCES users(id), text TEXT, created INTEGER);
      CREATE TABLE IF NOT EXISTS favorites(id TEXT PRIMARY KEY, user TEXT REFERENCES users(id), name TEXT NOT NULL, vibe TEXT NOT NULL, UNIQUE(user,name));
      CREATE TABLE IF NOT EXISTS operations(user TEXT REFERENCES users(id), key TEXT, fingerprint TEXT, result TEXT, created INTEGER, PRIMARY KEY(user,key));
      CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY, window INTEGER, count INTEGER);
      CREATE INDEX IF NOT EXISTS plans_circle ON plans(circle);
      CREATE INDEX IF NOT EXISTS messages_plan ON messages(plan,id);
    `);
    // Additive migration: existing installations retain their groups and votes.
    if(!this.rows('PRAGMA table_info(members)').some(column=>column.name==='area'))this.db.exec('ALTER TABLE members ADD COLUMN area TEXT');
  }
  rows(sql: string, ...args: (string | number | null)[]) { return this.db.prepare(sql).all(...args) as Row[]; }
  row(sql: string, ...args: (string | number | null)[]) { return this.db.prepare(sql).get(...args) as Row | undefined; }
  run(sql: string, ...args: (string | number | null)[]) { return this.db.prepare(sql).run(...args); }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); this.db.exec('COMMIT'); return value; } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  limit(key: string, max: number) {
    const window = Math.floor(Date.now() / 60000);
    this.run('INSERT INTO limits VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window', key, window);
    if (Number(this.row('SELECT count FROM limits WHERE key=?', key)?.count) > max) throw new AppError('נשלחו יותר מדי בקשות. נסו שוב בעוד דקה.', 429);
  }
  identify(token: string | undefined) { return token ? this.row('SELECT id,name FROM users WHERE token=? AND created>?', hash(token), Date.now() - 30 * 24 * HOUR) : undefined; }
  register(name: unknown) {
    const token = secret(), id = randomUUID();
    this.run('INSERT INTO users VALUES(?,?,?,?)', id, hash(token), text(name, 30), Date.now());
    return { token, id };
  }
  membership(user: string, circle: unknown) {
    const id = text(circle);
    if (!this.row('SELECT user FROM members WHERE user=? AND circle=?', user, id)) throw new AppError('אין לך גישה לקבוצה הזו.', 403);
    return id;
  }
  plan(user: string, id: unknown) {
    const p = this.row('SELECT * FROM plans WHERE id=?', text(id));
    if (!p) throw new AppError('המפגש לא נמצא.', 404);
    this.membership(user, p.circle); return p;
  }
  expires(p: Row) {
    if (p.cancelled) return 0;
    const slot = p.confirmed ? this.row('SELECT end FROM slots WHERE id=? AND plan=?', p.confirmed, p.id) : undefined;
    return slot ? Number(slot.end) + CHAT_GRACE : Number(p.created) + POLL_LIFETIME;
  }
  cleanup() {
    const now = Date.now();
    this.run('UPDATE members SET place=NULL,area=NULL,until=NULL WHERE until<=?', now);
    this.run('DELETE FROM operations WHERE created<?',now-24*HOUR);
    this.run('DELETE FROM limits WHERE window<?', Math.floor(now / 60000) - 2);
    for (const p of this.rows('SELECT * FROM plans')) if (this.expires(p) <= now) this.run('DELETE FROM messages WHERE plan=?', p.id);
  }
  snapshot(user: string): Snapshot {
    this.cleanup();
    const me = this.row('SELECT id,name FROM users WHERE id=?', user)!;
    const circles: Circle[] = this.rows('SELECT c.* FROM circles c JOIN members m ON m.circle=c.id WHERE m.user=? ORDER BY c.rowid DESC', user).map(c => {
      const members = this.rows('SELECT u.id,u.name,m.place,m.until,m.area FROM members m JOIN users u ON u.id=m.user WHERE m.circle=? ORDER BY u.created', c.id).map(m => ({ id: String(m.id), name: String(m.name), owner: m.id === c.owner, place: m.place as string | null, area: m.area?JSON.parse(String(m.area)):null, until: m.until as number | null }));
      const plans: Plan[] = this.rows('SELECT * FROM plans WHERE circle=? ORDER BY created DESC LIMIT 50', c.id).map(p => ({ id: String(p.id), title: String(p.title), place: String(p.place), vibe: String(p.vibe), creator: String(p.creator), created: Number(p.created), confirmed: p.confirmed as string | null, cancelled: !!p.cancelled, attendance: Object.fromEntries(this.rows('SELECT a.user,a.response FROM attendance a JOIN members m ON m.user=a.user AND m.circle=? WHERE plan=?',c.id,p.id).map(a=>[a.user,a.response])) as Record<string, Vote>, chatExpires: this.expires(p), slots: this.rows('SELECT * FROM slots WHERE plan=? ORDER BY start', p.id).map(s => ({ id: String(s.id), start: Number(s.start), end: Number(s.end), votes: Object.fromEntries(this.rows('SELECT v.user,v.vote FROM votes v JOIN members m ON m.user=v.user AND m.circle=? WHERE slot=?', c.id, s.id).map(v => [v.user, v.vote])) as Record<string, Vote> })), messages: this.rows('SELECT * FROM (SELECT m.id,m.author,u.name,m.text,m.created FROM messages m JOIN users u ON u.id=m.author WHERE m.plan=? ORDER BY m.id DESC LIMIT 100) ORDER BY id', p.id).map(m => ({ id: Number(m.id), author: String(m.author), name: String(m.name), text: String(m.text), created: Number(m.created) })) }));
      return { id: String(c.id), name: String(c.name), owner: String(c.owner), invite: c.owner === user ? String(c.invite) : '', members, plans };
    });
    return { me: { id: String(me.id), name: String(me.name) }, circles, favorites: this.rows("SELECT id,name,vibe FROM favorites WHERE user=? ORDER BY rowid DESC", user).map(f => ({id: String(f.id), name: String(f.name), vibe: String(f.vibe)})) };
  }
  deleteProfile(user: string) {
    this.transaction(()=>{
      this.run('DELETE FROM circles WHERE owner=?',user);
      this.run('DELETE FROM plans WHERE creator=?',user);
      this.run('DELETE FROM messages WHERE author=?',user);
      this.run('DELETE FROM votes WHERE user=?',user);
      this.run('DELETE FROM attendance WHERE user=?',user);
      this.run('DELETE FROM members WHERE user=?',user);
      this.run('DELETE FROM favorites WHERE user=?',user);
      this.run('DELETE FROM operations WHERE user=?',user);
      this.run('DELETE FROM limits WHERE key IN (?,?)',`user:${user}`,`chat:${user}`);
      this.run('DELETE FROM users WHERE id=?',user);
    });
  }
  action(user: string, data: Record<string, unknown>): Record<string, unknown> {
    this.limit(`user:${user}`,60);
    return this.transaction(()=>{
      const key=data.requestId?text(data.requestId,80):null;
      const fingerprint=hash(JSON.stringify(data));
      if(key){
        const prior=this.row('SELECT fingerprint,result FROM operations WHERE user=? AND key=?',user,key);
        if(prior){if(prior.fingerprint!==fingerprint)throw new AppError('מזהה הבקשה כבר שימש לפעולה אחרת.',409);return JSON.parse(String(prior.result));}
      }
      const result=this.perform(user,data);
      if(key)this.run('INSERT INTO operations VALUES(?,?,?,?,?)',user,key,fingerprint,JSON.stringify(result),Date.now());
      return result;
    });
  }
  perform(user: string, data: Record<string, unknown>): Record<string, unknown> {
    return (() => {
      switch (data.action) {
        case 'addFavorite': {
          if (Number(this.row('SELECT count(*) n FROM favorites WHERE user=?', user)?.n) >= 30) throw new AppError('אפשר לשמור עד 30 מקומות.');
          this.run('INSERT OR IGNORE INTO favorites VALUES(?,?,?,?)', randomUUID(), user, text(data.name), text(data.vibe,30)); break;
        }
        case 'removeFavorite': this.run('DELETE FROM favorites WHERE id=? AND user=?', text(data.id), user); break;
        case 'removeMember': {
          const c = this.membership(user, data.circle), target = text(data.user);
          if (this.row('SELECT owner FROM circles WHERE id=?', c)?.owner !== user || target === user) throw new AppError('רק מנהלת הקבוצה יכולה להסיר חברים אחרים.',403);
          this.run('DELETE FROM votes WHERE user=? AND slot IN (SELECT s.id FROM slots s JOIN plans p ON p.id=s.plan WHERE p.circle=?)',target,c);
          this.run('DELETE FROM attendance WHERE user=? AND plan IN (SELECT id FROM plans WHERE circle=?)',target,c);
          this.run('DELETE FROM members WHERE circle=? AND user=?',c,target); break;
        }
        case 'profile': this.run('UPDATE users SET name=? WHERE id=?', text(data.name, 30), user); break;
        case 'createCircle': {
          if (Number(this.row('SELECT count(*) n FROM members WHERE user=?', user)?.n) >= 20) throw new AppError('אפשר להצטרף לעד 20 קבוצות.');
          const id = randomUUID(); this.run('INSERT INTO circles VALUES(?,?,?,?)', id, text(data.name, 50), user, secret());
          this.run('INSERT INTO members(circle,user) VALUES(?,?)', id, user); return { circle: id };
        }
        case 'join': {
          const c = this.row('SELECT id FROM circles WHERE invite=?', text(data.invite, 100));
          if (!c) throw new AppError('קישור ההזמנה לא תקין או הוחלף.', 404);
          if (!this.row('SELECT user FROM members WHERE circle=? AND user=?', c.id, user)) {
            if (Number(this.row('SELECT count(*) n FROM members WHERE circle=?', c.id)?.n) >= 30) throw new AppError('הקבוצה מלאה (עד 30 חברים).');
            if (Number(this.row('SELECT count(*) n FROM members WHERE user=?', user)?.n) >= 20) throw new AppError('אפשר להצטרף לעד 20 קבוצות.');
            this.run('INSERT INTO members(circle,user) VALUES(?,?)', c.id, user);
          }
          return { circle: c.id };
        }
        case 'rotateInvite': {
          const c = this.membership(user, data.circle);
          if (this.row('SELECT owner FROM circles WHERE id=?', c)?.owner !== user) throw new AppError('רק מנהלת הקבוצה יכולה להחליף הזמנה.', 403);
          this.run('UPDATE circles SET invite=? WHERE id=?', secret(), c); break;
        }
        case 'leave': {
          const c = this.membership(user, data.circle);
          if (this.row('SELECT owner FROM circles WHERE id=?', c)?.owner === user) throw new AppError('מנהלת הקבוצה יכולה למחוק את הקבוצה בהגדרות.');
          this.run('DELETE FROM votes WHERE user=? AND slot IN (SELECT s.id FROM slots s JOIN plans p ON p.id=s.plan WHERE p.circle=?)', user, c);
          this.run('DELETE FROM attendance WHERE user=? AND plan IN (SELECT id FROM plans WHERE circle=?)',user,c);
          this.run('DELETE FROM members WHERE circle=? AND user=?', c, user); break;
        }
        case 'deleteCircle': {
          const c = this.membership(user, data.circle);
          if (this.row('SELECT owner FROM circles WHERE id=?', c)?.owner !== user) throw new AppError('רק מנהלת הקבוצה יכולה למחוק אותה.', 403);
          this.run('DELETE FROM circles WHERE id=?', c); break;
        }
        case 'presence': {
          const c = this.membership(user, data.circle);
          let area=null;
          if(data.area){
            if(typeof data.area!=='object'||typeof (data.area as Record<string,unknown>).lat!=='number'||typeof (data.area as Record<string,unknown>).lon!=='number')throw new AppError('אזור לא תקין.');
            const input=data.area as {lat:number;lon:number};
            try{area=coarseArea(input.lat,input.lon);}catch{throw new AppError('אזור לא תקין.');}
          }
          this.run('UPDATE members SET place=?,area=?,until=? WHERE circle=? AND user=?', area?null:data.place?text(data.place,60):null,area?JSON.stringify(area):null,data.place||area?Date.now()+HOUR:null,c,user);break;
        }
        case 'createPlan': {
          const c = this.membership(user, data.circle);
          if (Number(this.row('SELECT count(*) n FROM plans WHERE circle=? AND created>?', c, Date.now() - 24 * HOUR)?.n) >= 20) throw new AppError('עד 20 מפגשים ביום לכל קבוצה.');
          if (!Array.isArray(data.slots) || data.slots.length < 1 || data.slots.length > 5) throw new AppError('בחרו בין שעה אחת לחמש הצעות.');
          const slots = data.slots.map((s: unknown) => {
            if (!s || typeof s !== 'object') throw new AppError('זמן לא תקין.');
            const input = s as Record<string, unknown>, start = Number(input.start), end = Number(input.end);
            if (!Number.isFinite(start) || !Number.isFinite(end) || start < Date.now() + 60000 || start > Date.now() + 90 * 24 * HOUR || end <= start || end - start > 12 * HOUR) throw new AppError('בחרו זמן עתידי ב־90 הימים הקרובים, למשך עד 12 שעות.');
            return { start, end };
          });
          if (new Set(slots.map(s => s.start)).size !== slots.length) throw new AppError('יש הצעות זמן כפולות.');
          const id = randomUUID(); this.run('INSERT INTO plans(id,circle,title,place,vibe,creator,created) VALUES(?,?,?,?,?,?,?)', id, c, text(data.title), text(data.place), text(data.vibe, 30), user, Date.now());
          for (const s of slots) { const sid = randomUUID(); this.run('INSERT INTO slots VALUES(?,?,?,?)', sid, id, s.start, s.end); this.run('INSERT INTO votes VALUES(?,?,?)', sid, user, 'yes'); }
          return { plan: id };
        }
        case 'attendance': {
          const p=this.plan(user,data.plan);
          if (!p.confirmed || p.cancelled || this.expires(p)<=Date.now()) throw new AppError('אין מפגש פעיל לאישור הגעה.',409);
          const slot=this.row('SELECT end FROM slots WHERE id=?',p.confirmed);
          if (!slot || Number(slot.end)<=Date.now()) throw new AppError('המפגש כבר הסתיים.',409);
          if (!['yes','maybe','no'].includes(String(data.response))) throw new AppError('תגובה לא תקינה.');
          this.run('INSERT INTO attendance VALUES(?,?,?) ON CONFLICT(plan,user) DO UPDATE SET response=excluded.response',p.id,user,String(data.response));break;
        }
        case 'vote': {
          const p = this.plan(user, data.plan);
          if (p.cancelled || p.confirmed || this.expires(p) <= Date.now()) throw new AppError('ההצבעה נסגרה.', 409);
          if (!this.row('SELECT id FROM slots WHERE id=? AND plan=? AND start>?', text(data.slot), p.id, Date.now())) throw new AppError('הצעת הזמן כבר חלפה או לא קיימת.');
          if (!['yes', 'maybe', 'no'].includes(String(data.vote))) throw new AppError('תגובה לא תקינה.');
          this.run('INSERT INTO votes VALUES(?,?,?) ON CONFLICT(slot,user) DO UPDATE SET vote=excluded.vote', text(data.slot), user, String(data.vote)); break;
        }
        case 'confirm': {
          const p = this.plan(user, data.plan);
          if (p.creator !== user) throw new AppError('רק יוצר המפגש יכול לסגור שעה.', 403);
          if (p.cancelled || p.confirmed || this.expires(p) <= Date.now()) throw new AppError('המפגש כבר נסגר.', 409);
          if (!this.row('SELECT id FROM slots WHERE id=? AND plan=? AND start>?', text(data.slot), p.id, Date.now())) throw new AppError('הזמן שנבחר כבר חלף.');
          this.run('UPDATE plans SET confirmed=? WHERE id=?', text(data.slot), p.id); break;
        }
        case 'cancel': {
          const p = this.plan(user, data.plan);
          if (p.creator !== user) throw new AppError('רק יוצר המפגש יכול לבטל.', 403);
          this.run('UPDATE plans SET cancelled=1 WHERE id=?', p.id); this.run('DELETE FROM messages WHERE plan=?', p.id); break;
        }
        case 'message': {
          const p = this.plan(user, data.plan);
          if (this.expires(p) <= Date.now()) throw new AppError('הצ׳אט הזה הסתיים.', 410);
          this.limit(`chat:${user}`, 20);
          if (Number(this.row('SELECT count(*) n FROM messages WHERE plan=?', p.id)?.n) >= 1000) throw new AppError('הצ׳אט הגיע למגבלת ההודעות.');
          this.run('INSERT INTO messages(plan,author,text,created) VALUES(?,?,?,?)', p.id, user, text(data.text, 1000), Date.now()); break;
        }
        default: throw new AppError('פעולה לא מוכרת.');
      }
      return {};
    })();
  }
}
const globalStore = globalThis as unknown as { havrutaStore?: Store; havrutaCleanup?: ReturnType<typeof setInterval> };
export function store() {
  const instance=globalStore.havrutaStore ??= new Store(process.env.HAVRUTA_DB_PATH || './data/havruta.sqlite');
  if(!globalStore.havrutaCleanup){
    globalStore.havrutaCleanup=setInterval(()=>{try{instance.cleanup();}catch{console.error('Havruta retention cleanup failed');}},5*60000);
    globalStore.havrutaCleanup.unref();
  }
  return instance;
}
