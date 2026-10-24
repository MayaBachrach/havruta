import type { Snapshot } from './types';
import { HOUR } from './planning';
export function demoSnapshot(): Snapshot {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(18, 0, 0, 0);
  const start = tomorrow.getTime();
  return { me: { id: 'maya', name: 'מאיה' }, favorites: [{id:'campus',name:'בית הקפה ליד הקמפוס',vibe:'קפה'},{id:'beach',name:'הטיילת',vibe:'בחוץ'}], circles: [{ id: 'demo', name: 'האנשים שלי', owner: 'maya', invite: '', members: [
    { id: 'maya', name: 'מאיה', owner: true, place: null, until: null },
    { id: 'ofir', name: 'אופיר', owner: false, place: 'קמפוס', until: Date.now() + HOUR },
    { id: 'noa', name: 'נועה', owner: false, place: 'קמפוס', until: Date.now() + HOUR },
    { id: 'daniel', name: 'דניאל', owner: false, place: null, until: null },
    { id: 'shani', name: 'שני', owner: false, place: null, until: null },
  ], plans: [{ id: 'coffee', title: 'קפה, ופשוט להיות יחד', place: 'בית הקפה ליד הקמפוס', vibe: 'קפה', creator: 'maya', created: Date.now(), confirmed: null, cancelled: false, attendance: {}, chatExpires: Date.now() + 7 * 24 * HOUR,
    slots: [{ id: 'one', start, end: start + HOUR, votes: { maya: 'yes', ofir: 'yes', noa: 'yes', daniel: 'maybe' } }, { id: 'two', start: start + 24 * HOUR, end: start + 25 * HOUR, votes: { maya: 'yes', ofir: 'no', noa: 'yes', shani: 'yes' } }],
    messages: [{ id: 1, author: 'noa', name: 'נועה', text: 'כל כך צריכה את הקפה הזה ☕', created: Date.now() - 600000 }, { id: 2, author: 'ofir', name: 'אופיר', text: 'אני מביא קלפים. שלא תגידו שלא הזהרתי.', created: Date.now() - 300000 }] },
    { id: 'sunset', title: 'תופסים שקיעה', place: 'הטיילת', vibe: 'בחוץ', creator: 'noa', created: Date.now(), confirmed: 'sun', cancelled: false, attendance: {}, chatExpires: start + 3 * 24 * HOUR,
      slots: [{ id: 'sun', start: start + 48 * HOUR, end: start + 49 * HOUR, votes: { maya: 'yes', noa: 'yes', shani: 'yes' } }], messages: [] }]
  }] };
}
