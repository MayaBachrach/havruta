export const CHECKLIST_TEMPLATES = {
 picnic: {label:'פיקניק',items:['מחצלת','מים לשתייה','משהו לנשנש','שקית לאיסוף אשפה']},
 dinner: {label:'ארוחה יחד',items:['מנה עיקרית','סלט','שתייה','משהו מתוק']},
 games: {label:'ערב משחקים',items:['משחק קופסה או קלפים','משהו לנשנש','שתייה']},
} as const;
export function checklistTemplate(key:unknown):readonly string[]|null {
 return typeof key==='string'&&Object.hasOwn(CHECKLIST_TEMPLATES,key)?CHECKLIST_TEMPLATES[key as keyof typeof CHECKLIST_TEMPLATES].items:null;
}
