export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export type ItemTipe = 'pg' | 'pg_kompleks' | 'pernyataan_bs' | string;

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

export function parseKey(item: DbItem): string | string[] {
  const k = item.correct_key;
  if (item.item_type === 'pg') return k;
  try {
    const p = JSON.parse(k);
    if (Array.isArray(p)) return p.map(String);
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

/** Acak opsi PG; huruf A–E mengikuti urutan baru, kunci ikut pindah. Pernyataan B/S tidak diacak. */
export function acakOpsi(item: DbItem): DbItem {
  if (item.item_type === 'pernyataan_bs') return item;
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
