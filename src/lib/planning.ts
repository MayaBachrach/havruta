import type { Member, Slot } from "./types.ts";
export const HOUR = 3600000;
export const CHAT_GRACE = 24 * HOUR;
export const POLL_LIFETIME = 7 * 24 * HOUR;
export function bestSlots(slots: Slot[], memberIds: string[]) {
  const score = (s: Slot) => memberIds.reduce((n, id) => n + (s.votes[id] === "yes" ? 2 : s.votes[id] === "maybe" ? 1 : 0), 0);
  return [...slots].sort((a, b) => score(b) - score(a) || a.start - b.start);
}
export function nearbyGroups(members: Member[], now: number) {
  const groups = new Map<string, Member[]>();
  for (const m of members) {
    if (!m.place || !m.until || m.until <= now) continue;
    const key = m.place.trim().normalize("NFKC").toLocaleLowerCase("he");
    groups.set(key, [...(groups.get(key) || []), m]);
  }
  return [...groups.values()].filter(group => group.length >= 2);
}
export function isFree(start: number, end: number, busy: { start: string; end: string }[]) {
  return !busy.some(b => start < Date.parse(b.end) && end > Date.parse(b.start));
}
const utc = (value: number) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escapeICS = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
export function calendarFile(id: string, title: string, place: string, start: number, end: number) {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Havruta//Meetups//HE", "CALSCALE:GREGORIAN", "BEGIN:VEVENT", `UID:${id}@havruta`, `DTSTAMP:${utc(Date.now())}`, `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`, `SUMMARY:${escapeICS(title)}`, `LOCATION:${escapeICS(place)}`, "END:VEVENT", "END:VCALENDAR"].map(line => {
    let out = "", bytes = 0;
    for (const char of line) { const size = new TextEncoder().encode(char).length; if (bytes + size > 70) { out += "\r\n "; bytes = 1; } out += char; bytes += size; }
    return out;
  }).join("\r\n") + "\r\n";
}
export function googleCalendarUrl(title: string, place: string, start: number, end: number) {
  return "https://calendar.google.com/calendar/render?" + new URLSearchParams({ action: "TEMPLATE", text: title, location: place, dates: `${utc(start)}/${utc(end)}`, details: "נפגשים עם חברותא" });
}

// Only coarse opt-in coordinates are accepted; no location history is kept.
export function coarseArea(lat:number,lon:number){
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw new Error('Invalid coordinates');
  return {lat:Math.round(lat*100)/100,lon:Math.round(lon*100)/100};
}
export function areaDistance(a:{lat:number;lon:number},b:{lat:number;lon:number}){
  const rad=(value:number)=>value*Math.PI/180;
  const h=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lon-a.lon)/2)**2;
  return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function nearbyAreas(members:Member[],now:number){
  const active=members.filter(m=>m.area&&m.until&&m.until>now);
  const groups:Member[][]=[];
  for(const seed of active){
    const group=[seed];
    for(const candidate of active)if(candidate.id!==seed.id&&group.every(m=>areaDistance(m.area!,candidate.area!)<=2000))group.push(candidate);
    if(group.length>1&&!groups.some(g=>g.length===group.length&&g.every(m=>group.some(x=>x.id===m.id))))groups.push(group);
  }
  return groups.filter(g=>!groups.some(other=>other.length>g.length&&g.every(m=>other.some(x=>x.id===m.id))));
}
