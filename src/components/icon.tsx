import type {CSSProperties} from 'react';
const paths:Record<string,string[]>={
 home:['M3 10.5 12 3l9 7.5','M5 9v12h5v-7h4v7h5V9'],
 calendar:['M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2Z','M7 2v6M17 2v6M3 11h18','M7 15h2M12 15h2M7 18h2'],
 clock:['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18','M12 7v5l3 2'],
 people:['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M2 21v-3a7 7 0 0 1 14 0v3','M17 4a4 4 0 0 1 0 8M18 14a5 5 0 0 1 4 5v2'],
 chat:['M21 12a8 8 0 0 1-8 8H7l-5 3 1.5-6A8 8 0 1 1 21 12Z','M7 10h10M7 14h6'],
 coffee:['M4 8h12v7a6 6 0 0 1-12 0V8Z','M16 9h2a3 3 0 0 1 0 6h-2M3 22h15M7 2v3M12 2v3'],
 food:['M5 2v7a3 3 0 0 0 6 0V2M8 2v20','M19 22V2c-5 3-5 10 0 10'],
 sun:['M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10','M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2'],
 games:['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z','M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01'],
 place:['M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 1 1 14 0Z','M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
 check:['m5 12 4 4L19 6'],plus:['M12 4v16M4 12h16'],arrow:['M19 12H5m6-6-6 6 6 6'],
 settings:['M4 7h16M4 17h16','M9 4v6M16 14v6'],moon:['M21 14A9 9 0 0 1 10 3a9 9 0 1 0 11 11Z'],
 heart:['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z'],
 list:['M9 5h12M9 12h12M9 19h12','m2 5 1 1 2-3m-3 9 1 1 2-3m-3 9 1 1 2-3'],link:['M9 15 15 9','M7 14l-2 2a4 4 0 0 0 6 6l3-3M17 10l2-2a4 4 0 0 0-6-6l-3 3'],
};
export default function Icon({name,size=22,style}:{name:string;size?:number;style?:CSSProperties}){
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={style}>{(paths[name]||paths.calendar).map((d,i)=><path d={d} key={i}/>)}</svg>;
}
export function VibeIcon({vibe,size=24}:{vibe:string;size?:number}){return <Icon name={({קפה:'coffee',אוכל:'food',בחוץ:'sun',משחקים:'games'} as Record<string,string>)[vibe]||'calendar'} size={size}/>;}
export function BrandMark(){return <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><rect x="2" y="4" width="20" height="24" rx="7" fill="currentColor"/><rect x="12" y="4" width="18" height="24" rx="7" fill="#ee765c"/><path d="M12 12h8M12 17h8M12 22h5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>;}
