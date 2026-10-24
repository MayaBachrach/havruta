export type Vote = "yes" | "maybe" | "no";
export type Member = { id: string; name: string; owner: boolean; place: string | null; area?: { lat: number; lon: number } | null; until: number | null };
export type Slot = { id: string; start: number; end: number; votes: Record<string, Vote> };
export type Plan = { id: string; title: string; place: string; vibe: string; creator: string; created: number; confirmed: string | null; cancelled: boolean; attendance: Record<string, Vote>; slots: Slot[]; messages: { id: number; author: string; name: string; text: string; created: number }[]; chatExpires: number };
export type Circle = { id: string; name: string; owner: string; invite: string; members: Member[]; plans: Plan[] };
export type Snapshot = { me: { id: string; name: string }; circles: Circle[]; favorites: { id: string; name: string; vibe: string }[] };
