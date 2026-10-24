import { NextRequest, NextResponse } from 'next/server';
import { AppError, store } from '@/lib/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const cookieName = process.env.NODE_ENV === 'production' ? '__Host-havruta' : 'havruta';
function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } });
}
export async function GET(req: NextRequest) {
  try {
    const s = store(), me = s.identify(req.cookies.get(cookieName)?.value);
    return response(me ? s.snapshot(String(me.id)) : { me: null, circles: [] });
  } catch { return response({ error: 'לא הצלחנו לטעון את הנתונים. נסו שוב.' }, 500); }
}
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get('origin');
    if (!origin || origin !== (process.env.APP_ORIGIN || req.nextUrl.origin)) throw new AppError('מקור הבקשה אינו מורשה.', 403);
    if (!req.headers.get('content-type')?.startsWith('application/json')) throw new AppError('נדרש JSON.', 415);
    if (Number(req.headers.get('content-length')) > 16384) throw new AppError('בקשה גדולה מדי.', 413);
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 16384) throw new AppError('בקשה גדולה מדי.', 413);
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw); } catch { throw new AppError('בקשה לא תקינה.'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('בקשה לא תקינה.');
    const s = store(), me = s.identify(req.cookies.get(cookieName)?.value);
    if (data.action === 'register' && !me) {
      s.limit(`register:${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'}`, 10);
      const registration = s.register(data.name), res = response({ snapshot: s.snapshot(registration.id) });
      res.cookies.set(cookieName, registration.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 2592000 });
      return res;
    }
    if(data.action==='deleteProfile') {
      if(me)s.deleteProfile(String(me.id));
      const res=response({snapshot:null});
      res.cookies.set(cookieName,'',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0});
      return res;
    }
    if (!me) throw new AppError('צריך להיכנס קודם.', 401);
    const result = s.action(String(me.id), data);
    return response({ ...result, snapshot: s.snapshot(String(me.id)) });
  } catch (e) {
    if (e instanceof AppError) return response({ error: e.message }, e.status);
    console.error('Havruta request failed', e instanceof Error ? e.name : 'UnknownError');
    return response({ error: 'משהו השתבש. נסו שוב בעוד רגע.' }, 500);
  }
}
