import { insforge } from './insforge';

export type TipeSoal = 'pg' | 'pg_kompleks' | 'pernyataan_bs';

export type DrafSoal = {
  stem: string;
  opsi: string[];
  kunci: string[];
  pernyataan: string[];
  kunci_bs: ('B' | 'S')[];
  pembahasan: string;
};

function normalizeBase(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/\/+$/, '').replace(/\/api$/i, '');
}

function extractJson(text: string): unknown {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : t;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI tidak mengembalikan JSON.');
  return JSON.parse(raw.slice(start, end + 1));
}

async function bearer(): Promise<string> {
  const anon = (import.meta.env.VITE_INSFORGE_ANON_KEY as string | undefined)?.trim() || '';
  try {
    const auth = insforge.auth as unknown as {
      getCurrentSession?: () => Promise<{ data?: { session?: { accessToken?: string }; accessToken?: string } }>;
    };
    const s = await auth.getCurrentSession?.();
    return s?.data?.session?.accessToken || s?.data?.accessToken || anon;
  } catch {
    return anon;
  }
}

export async function drafSoalAI(input: {
  jenjang: string;
  mapel: string;
  materi: string;
  tipe: TipeSoal;
  catatan?: string;
  stemAda?: string;
}): Promise<DrafSoal | { error: string }> {
  const base = normalizeBase(import.meta.env.VITE_INSFORGE_URL as string | undefined);
  if (!base) return { error: 'VITE_INSFORGE_URL belum diisi.' };
  const token = await bearer();
  if (!token) return { error: 'Tidak ada token AI. Cek anon key / login.' };

  const tipeKet =
    input.tipe === 'pg'
      ? 'Pilihan ganda 5 opsi A-E, tepat SATU kunci.'
      : input.tipe === 'pg_kompleks'
        ? 'Pilihan ganda kompleks 5 opsi A-E, 2-3 kunci benar (all-or-nothing).'
        : 'Tiga pernyataan, masing-masing Benar atau Salah.';

  const user = input.stemAda
    ? `Perbaiki/tulis ULANG pembahasan untuk soal ini (jangan ganti tipe). Soal: ${input.stemAda}`
    : `Buat SATU soal baru.`;

  const prompt = `Anda asisten guru TKA Indonesia. ${user}
Jenjang: ${input.jenjang}. Mapel: ${input.mapel || '-'}. Materi: ${input.materi || '-'}.
Tipe: ${tipeKet}
Catatan guru: ${input.catatan || '-'}
Bukan soal resmi Kemendikdasmen. Penalaran, bukan hafalan semata.
Balas HANYA JSON valid, tanpa markdown:
{
  "stem": "pertanyaan",
  "opsi": ["A teks","B teks","C teks","D teks","E teks"],
  "kunci": ["C"],
  "pernyataan": ["...","...","..."],
  "kunci_bs": ["B","S","B"],
  "pembahasan": "jelas, 3-6 kalimat, sebutkan mengapa kunci benar dan pengecoh salah"
}
Untuk pg, kunci array 1 huruf. Untuk pg_kompleks, kunci 2-3 huruf. Untuk pernyataan_bs isi pernyataan + kunci_bs.`;

  try {
    const res = await fetch(`${base}/api/ai/chat/completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        temperature: 0.4,
        maxTokens: 1200,
        systemPrompt: 'Anda hanya mengeluarkan JSON soal TKA. Tidak mengaku soal resmi.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      text?: string;
      message?: string;
      error?: string | { message?: string };
      choices?: { message?: { content?: string } }[];
    };
    if (!res.ok) {
      const msg =
        typeof json.error === 'string' ? json.error : json.error?.message || json.message || `HTTP ${res.status}`;
      return {
        error:
          msg +
          (res.status === 401 || res.status === 403
            ? ' · Dashboard InsForge: pasang OpenRouter / AI, lalu login ulang.'
            : ''),
      };
    }
    const text = json.text || json.choices?.[0]?.message?.content || '';
    if (!text) return { error: 'AI tidak mengirim teks. Cek kuota OpenRouter di InsForge.' };
    const parsed = extractJson(text) as {
      stem?: string;
      opsi?: string[];
      kunci?: string[];
      pernyataan?: string[];
      kunci_bs?: string[];
      pembahasan?: string;
    };
    const opsi = (parsed.opsi || []).map(String);
    while (opsi.length < 5) opsi.push('');
    const kunci = (parsed.kunci || []).map((x) => String(x).toUpperCase().replace(/[^A-E]/g, '').slice(0, 1)).filter(Boolean);
    const pernyataan = (parsed.pernyataan || []).map(String);
    while (pernyataan.length < 3) pernyataan.push('');
    const kunci_bs = (parsed.kunci_bs || ['B', 'S', 'B']).slice(0, 3).map((x) => (String(x).toUpperCase().startsWith('S') ? 'S' : 'B')) as (
      | 'B'
      | 'S'
    )[];
    while (kunci_bs.length < 3) kunci_bs.push('B');
    return {
      stem: String(parsed.stem || '').trim(),
      opsi: opsi.slice(0, 5),
      kunci: kunci.length ? kunci : ['C'],
      pernyataan: pernyataan.slice(0, 3),
      kunci_bs,
      pembahasan: String(parsed.pembahasan || '').trim(),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
