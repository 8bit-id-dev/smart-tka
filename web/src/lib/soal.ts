export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export type ItemTipe = 'pg' | 'pg_kompleks' | 'pernyataan_bs' | 'mencocokkan' | 'uraian' | string;

export type DbItem = {
  id: string;
  item_type: ItemTipe;
  mapel: string;
  materi?: string | null;
  stem: string;
  stimulus: string | null;
  choices: unknown;
  correct_key: string;
  rationale: string;
  jenjang: string;
  difficulty?: number | null;
  irt_a?: number | null;  // IRT discrimination
  irt_b?: number | null;  // IRT difficulty
  irt_c?: number | null;  // IRT guessing (3PL)
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

function shufflePernyataan(item: DbItem, orderedIdx: number[]): DbItem {
  const list = asStringList(item.choices);
  const key = parseKey(item);
  if (!Array.isArray(key) || list.length !== key.length) {
    return item;
  }
  return {
    ...item,
    choices: orderedIdx.map((i) => list[i]),
    correct_key: JSON.stringify(orderedIdx.map((i) => key[i])),
  };
}

/** Acak opsi PG; huruf A–E mengikuti urutan baru, kunci ikut pindah. Pernyataan B/S diacak (pernyataan + kunci ikut pindah). Mencocokkan dan uraian tidak diacak. */
export function acakOpsi(item: DbItem): DbItem {
  if (item.item_type === 'pernyataan_bs') {
    const list = asStringList(item.choices);
    if (list.length < 1) return item;
    return shufflePernyataan(item, acakList(list.map((_, i) => i)));
  }
  if (item.item_type === 'mencocokkan' || item.item_type === 'uraian') {
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

/** Deterministic PRNG (mulberry32) so a student's exam layout is identical on resume. */
export function mulberry32(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  let a = h >>> 0;
  if (a === 0) a = 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t, 9)) | 0;
    return ((t ^ (t >>> 7)) >>> 0) / 4294967296;
  };
}

export function acakListSeeded<T>(arr: T[], seed: string): T[] {
  const rng = mulberry32(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** Acak opsi PG secara deterministik (seed); huruf A–E mengikuti urutan baru, kunci ikut pindah. Pernyataan B/S diacak (pernyataan + kunci ikut pindah). Mencocokkan dan uraian tidak diacak. */
export function acakOpsiSeeded(item: DbItem, seed: string): DbItem {
  if (item.item_type === 'pernyataan_bs') {
    const list = asStringList(item.choices);
    if (list.length < 1) return item;
    return shufflePernyataan(item, acakListSeeded(list.map((_, i) => i), seed));
  }
  if (item.item_type === 'mencocokkan' || item.item_type === 'uraian') {
    return item;
  }
  const opts = optionsOf(item);
  const idxs = acakListSeeded(opts.map((_, i) => i), seed);
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

/* ==================== IRT 2PL (TKA Standard) ==================== */

export interface IRTParams {
  a: number;  // discrimination
  b: number;  // difficulty
  c?: number; // guessing (3PL)
}

export interface IRTResponse {
  itemId: string;      // unique ID per dichotomous item (e.g., "item123_A", "item123_stmt1")
  correct: boolean;    // 0 or 1
  a: number;
  b: number;
  c?: number;
}

/** 2PL probability: P(θ) = c + (1-c) / (1 + exp(-a * (θ - b))) */
export function irtProbability(theta: number, params: IRTParams): number {
  const { a, b, c = 0 } = params;
  const p = 1 / (1 + Math.exp(-a * (theta - b)));
  return c + (1 - c) * p;
}

/** Log-likelihood for a single response */
export function irtLogLikelihood(theta: number, response: IRTResponse): number {
  const p = irtProbability(theta, { a: response.a, b: response.b, c: response.c });
  return response.correct ? Math.log(p) : Math.log(1 - p);
}

/** Fisher information for a single item at theta */
export function irtInformation(theta: number, params: IRTParams): number {
  const { a, b, c = 0 } = params;
  const p = 1 / (1 + Math.exp(-a * (theta - b)));
  const q = 1 - p;
  return (a * a * p * q) / ((1 - c) * (1 - c));
}

/** MLE estimation of theta given responses (Newton-Raphson) */
export function estimateTheta(responses: IRTResponse[], initialTheta = 0): { theta: number; se: number } {
  let theta = initialTheta;
  
  for (let iter = 0; iter < 20; iter++) {
    let num = 0;
    let den = 0;
    
    for (const r of responses) {
      const p = irtProbability(theta, { a: r.a, b: r.b, c: r.c });
      const q = 1 - p;
      num += r.a * (r.correct ? q : -p);
      den += r.a * r.a * p * q;
    }
    
    if (den === 0) break;
    const delta = num / den;
    theta += delta;
    if (Math.abs(delta) < 1e-4) break;
  }
  
  let totalInfo = 0;
  for (const r of responses) {
    totalInfo += irtInformation(theta, { a: r.a, b: r.b, c: r.c });
  }
  const se = totalInfo > 0 ? 1 / Math.sqrt(totalInfo) : 999;
  
  return { theta, se };
}

/** Transform theta to 0-100 scale (mean=50, SD=10) */
export function thetaToScale(theta: number): number {
  const scaled = 50 + 10 * theta;
  return Math.max(0, Math.min(100, Math.round(scaled * 100) / 100));
}

/** IRT category from 0-100 scale (TKA standard) */
export function irtCategory(score: number): 'Istimewa' | 'Baik' | 'Memadai' | 'Kurang' {
  if (score >= 85) return 'Istimewa';
  if (score >= 70) return 'Baik';
  if (score >= 55) return 'Memadai';
  return 'Kurang';
}

/** 
 * TKA Standard Partial Scoring:
 * - PGK: 1 point per correct option, NO penalty for wrong options, MIN 0 per item
 * - PBS: 1 point per correct statement
 * Returns fraction (0-1) for classical partial credit
 */

/** PGK: correct options / total selected options (precision) — penalize wrong selections */
export function partialScorePGK(selected: string[], key: string[]): number {
  if (selected.length === 0) return 0;
  const correctSelected = selected.filter(s => key.includes(s)).length;
  return correctSelected / selected.length;
}

/** PBS: correct statements / total statements (TKA rule: 1 point per statement) */
export function partialScorePBS(selected: ('B' | 'S' | null)[], key: ('B' | 'S')[]): number {
  if (key.length === 0) return 0;
  let correct = 0;
  for (let i = 0; i < key.length; i++) {
    if (selected[i] === key[i]) correct++;
  }
  return correct / key.length;
}

/**
 * Expand PGK/PBS items into dichotomous IRT items
 * Each option/statement becomes a separate item for IRT calibration
 */
export interface DichotomousIRTItem {
  itemId: string;      // e.g., "uuid_A", "uuid_stmt1"
  parentItemId: string; // original item UUID
  type: 'pgk_option' | 'pbs_statement';
  optionIndex: number;  // 0-based index of option/statement
  label: string;        // "A", "B", "C"... or statement text
  key: boolean;         // is this option/statement correct?
  irt_a?: number | null;
  irt_b?: number | null;
  irt_c?: number | null;
}

/** Expand PGK item into dichotomous items (one per option) */
export function expandPGKToDichotomous(item: DbItem): DichotomousIRTItem[] {
  const opts = optionsOf(item);
  const key = parseKey(item);
  const keyArray = Array.isArray(key) ? key : [];
  
  return opts.map((_, idx) => ({
    itemId: `${item.id}_${LETTERS[idx]}`,
    parentItemId: item.id,
    type: 'pgk_option' as const,
    optionIndex: idx,
    label: LETTERS[idx],
    key: keyArray.includes(LETTERS[idx]),
    irt_a: item.irt_a ?? null,
    irt_b: item.irt_b ?? null,
    irt_c: item.irt_c ?? null,
  }));
}

/** Expand PBS item into dichotomous items (one per statement) */
export function expandPBSToDichotomous(item: DbItem): DichotomousIRTItem[] {
  const stmts = asStringList(item.choices);
  const key = parseKey(item);
  const keyArray = Array.isArray(key) ? key : [];
  
  return stmts.map((_, idx) => ({
    itemId: `${item.id}_stmt${idx + 1}`,
    parentItemId: item.id,
    type: 'pbs_statement' as const,
    optionIndex: idx,
    label: stmts[idx],
    key: keyArray[idx] === 'B', // 'B' = Benar, 'S' = Salah
    irt_a: item.irt_a ?? null,
    irt_b: item.irt_b ?? null,
    irt_c: item.irt_c ?? null,
  }));
}

/** Convert student responses to dichotomous IRT responses */
export function responsesToDichotomousIRT(
  items: DbItem[], 
  answers: Record<string, { answer: string; correct: boolean; partialScore?: number }>
): IRTResponse[] {
  const responses: IRTResponse[] = [];
  
  for (const item of items) {
    const ans = answers[item.id];
    if (!ans) continue;
    
    if (item.item_type === 'pg_kompleks') {
      const selected = ans.answer ? JSON.parse(ans.answer) : [];
      const key = parseKey(item);
      const keyArray = Array.isArray(key) ? key : [];
      
      // Each option becomes a dichotomous response
      const opts = optionsOf(item);
      opts.forEach((_, idx) => {
        const optionLetter = LETTERS[idx];
        const isCorrect = keyArray.includes(optionLetter);
        const studentSelected = selected.includes(optionLetter);
        
        responses.push({
          itemId: `${item.id}_${optionLetter}`,
          correct: studentSelected === isCorrect, // TKA: correct if match (selected correct OR correctly didn't select incorrect)
          a: item.irt_a ?? 1,
          b: item.irt_b ?? 0,
          c: item.irt_c ?? 0,
        });
      });
    } else if (item.item_type === 'pernyataan_bs') {
      const selected = ans.answer ? JSON.parse(ans.answer) : [];
      const key = parseKey(item);
      const keyArray = Array.isArray(key) ? key : [];
      
      keyArray.forEach((correctVal, idx) => {
        const studentVal = selected[idx];
        responses.push({
          itemId: `${item.id}_stmt${idx + 1}`,
          correct: studentVal === correctVal,
          a: item.irt_a ?? 1,
          b: item.irt_b ?? 0,
          c: item.irt_c ?? 0,
        });
      });
    } else if (item.item_type === 'pg' || item.item_type === 'single') {
      // Standard PG: already dichotomous
      responses.push({
        itemId: item.id,
        correct: ans.correct,
        a: item.irt_a ?? 1,
        b: item.irt_b ?? 0,
        c: item.irt_c ?? 0,
      });
    }
    // Note: uraian, mencocokkan not expanded (scored separately)
  }
  
  return responses;
}
