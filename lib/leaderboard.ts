type Entry = {
  clientId: string;
  nickname: string;
  country: string;
  count: number;
};

type DailyStore = {
  date: string;
  entries: Map<string, Entry>;
};

const SEED: Omit<Entry, "clientId">[] = [
  { nickname: "kaito_42", country: "jp", count: 14 },
  { nickname: "mira", country: "br", count: 12 },
  { nickname: "leoT", country: "de", count: 11 },
  { nickname: "nightowl", country: "us", count: 9 },
  { nickname: "salt", country: "kr", count: 9 },
  { nickname: "rin", country: "jp", count: 8 },
  { nickname: "benji", country: "gb", count: 7 },
  { nickname: "anouk", country: "fr", count: 7 },
  { nickname: "pavlo", country: "pl", count: 6 },
];

const g = globalThis as unknown as { __potatoStore?: DailyStore };

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function getStore(): DailyStore {
  const today = todayUtc();
  if (!g.__potatoStore || g.__potatoStore.date !== today) {
    const entries = new Map<string, Entry>();
    SEED.forEach((s, i) =>
      entries.set(`seed-${i}`, { clientId: `seed-${i}`, ...s }),
    );
    g.__potatoStore = { date: today, entries };
  }
  return g.__potatoStore;
}

export function bumpCount(
  clientId: string,
  nickname: string,
  country: string,
): { count: number; rank: number } {
  const store = getStore();
  const existing = store.entries.get(clientId);
  const next: Entry = existing
    ? { ...existing, nickname, country, count: existing.count + 1 }
    : { clientId, nickname, country, count: 1 };
  store.entries.set(clientId, next);

  const sorted = [...store.entries.values()].sort((a, b) => b.count - a.count);
  const rank = sorted.findIndex((e) => e.clientId === clientId) + 1;
  return { count: next.count, rank };
}

export function leaderboardToday(limit = 20): { online: number; rows: Array<{ rank: number; nickname: string; country: string; count: number }>; } {
  const store = getStore();
  const sorted = [...store.entries.values()].sort((a, b) => b.count - a.count);
  const rows = sorted.slice(0, limit).map((e, i) => ({
    rank: i + 1,
    nickname: e.nickname,
    country: e.country,
    count: e.count,
  }));
  return {
    online: 1200 + (sorted.length % 200),
    rows,
  };
}
