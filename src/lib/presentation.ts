export const dateLabel = (date: number) => new Date(date).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });
export const timeLabel = (date: number) => new Date(date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
export const icons: Record<string, string> = { 'קפה': '☕', 'אוכל': '🍝', 'בחוץ': '☀', 'משחקים': '♟', 'אחר': '✦' };
export function toLocal(value: number) { const d = new Date(value); return new Date(value - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
