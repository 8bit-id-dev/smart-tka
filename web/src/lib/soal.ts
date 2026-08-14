export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export type ItemTipe = 'pg' | 'pg_kompleks' | 'pernyataan_bs' | 'mencocokkan' | 'uraian' | string;

export type DbItem = {
  id: string;
  item_type: ItemTipe;
  mapel: string;
  stem: string;
  stimulus: string | null;
  choices: unknown;
  correct_key: string;
  rationale: string;
  jenjang: string;
};

export type MatchPairs = { kiri: string[]; kanan: string[] };

export function parseMatchPairs(item: DbItem): MatchPairs {
  if (typeof item.choices === 'object' && item.choices !== null && 'kiri' in item.choices && 'kanan' in item.choices) {
    const obj = item.choices as { kiri: unknown; kanan: unknown };
    return {
      kiri: Array.isArray(obj.kiri) ? obj.kiri.map(String) : [],
      kanan: Array.isArray(obj.kanan) ? obj.kanan.map(String) : [],
    };
  }
  if (typeof item.choices === 'string') {
    try {
      const obj = JSON.parse(item.choices);
      if (typeof obj === 'object' && obj !== null && 'kiri' in obj && 'kanan' in obj) {
        return {
          kiri: Array.isArray(obj.kiri) ? obj.kiri.map(String) : [],
          kanan: Array.isArray(obj.kanan) ? obj.kanan.map(String) : [],
        };
      }
    } catch {
      /* ignore */
    }
  }
  return { kiri: [], kanan: [] };
}

export function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p.map(String);
    } catch {
      /* ignore */
    }
  }
  return [];
}

export function parseKey(item: DbItem): string | string[] | Record<string, string> {
  const k = item.correct_key;
  if (item.item_type === 'pg' || item.item_type === 'uraian') return k;
  try {
    const p = JSON.parse(k);
    if (Array.isArray(p)) return p.map(String);
    if (typeof p === 'object' && p !== null) return p as Record<string, string>;
  } catch {
    /* single */
  }
  return k;
}

export function optionsOf(item: DbItem): string[] {
  const list = asStringList(item.choices);
  if (item.item_type === 'pg' || item.item_type === 'pg_kompleks') {
    while (list.length < 5) list.push('');
    return list.slice(0, 5);
  }
  return list;
}

export function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export function acakList<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/** Acak opsi PG; huruf A–E mengikuti urutan baru, kunci ikut pindah. Pernyataan B/S, mencocokkan, dan uraian tidak diacak. */
export function acakOpsi(item: DbItem): DbItem {
  if (item.item_type === 'pernyataan_bs' || item.item_type === 'mencocokkan' || item.item_type === 'uraian') {
    return item;
  }
  const opts = optionsOf(item);
  const idxs = acakList(opts.map((_, i) => i));
  const newOpts = idxs.map((i) => opts[i]);
  const hurufLama = idxs.map((i) => LETTERS[i]);
  const remap = (L: string) => {
    const pos = hurufLama.indexOf(L as (typeof LETTERS)[number]);
    return pos >= 0 ? LETTERS[pos] : L;
  };
  const key = parseKey(item);
  let correct_key = item.correct_key;
  if (item.item_type === 'pg' || item.item_type === 'single') {
    correct_key = remap(String(key));
  } else if (item.item_type === 'pg_kompleks' && Array.isArray(key)) {
    correct_key = JSON.stringify(key.map(remap).sort());
  }
  return { ...item, choices: newOpts, correct_key };
}
