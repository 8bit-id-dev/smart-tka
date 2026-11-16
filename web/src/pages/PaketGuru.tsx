import { useEffect, useMemo, useState } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';
import { FilterSelect } from '../components/FilterSelect';

type ItemRow = { id: string; stem: string; mapel: string; materi?: string | null; item_type: string; difficulty?: number | null; sub_materi?: string | null };
type Pkg = {
  id: string;
  title: string;
  kind: string;
  mapel: string;
  materi?: string | null;
  info?: string | null;
  jenjang: string;
  item_count: number;
  duration_sec: number | null;
  discuss_after_each: boolean;
  shuffle: boolean;
  use_ai_selection?: boolean;
  jumlah_soal_soal?: number | null;
  ai_config?: Record<string, unknown> | null;
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  pg: 'PG',
  pg_kompleks: 'PG Kompleks',
  uraian: 'Uraian',
  pernyataan_bs: 'B/S',
  mencocokkan: 'Mencocokkan',
};

const ALL_ITEM_TYPES = ['pg', 'pg_kompleks', 'uraian', 'pernyataan_bs', 'mencocokkan'];
const DIFF_OPTS = [
  { v: 1, label: '1 — Mudah' },
  { v: 2, label: '2 — Sedang' },
  { v: 3, label: '3 — Sulit' },
] as const;

const KINDS = [
  { id: 'latihan', label: 'Latihan (pembahasan langsung)' },
  { id: 'simulasi', label: 'Simulasi (pembahasan setelah paket)' },
  { id: 'ujian_kelas', label: 'Ujian kelas' },
  { id: 'lab_25', label: 'Lab 25 menit' },
] as const;

const JENJANG_OPTS = ['sd', 'smp', 'sma', 'smk'] as const;

type SubMateriRule = { nama: string; jumlah_per_type: Record<string, number>; difficulty_ratio?: Record<number, number> };

// AI Selection UI Component
function AISelectionUI({
  useAiSelection,
  itemsByMateri,
  filteredItems,
  activeTypes,
  jumlahPerTipe,
  jumlahSoalTotal,
  distribusiMode,
  setDistribusiMode,
  subMateriRules,
  setSubMateriRules,
  coverage,
  setJumlahPerTipe,
  setActiveTypes,
}: {
  useAiSelection: boolean;
  itemsByMateri: ItemRow[];
  filteredItems: ItemRow[];
  activeTypes: string[];
  jumlahPerTipe: Record<string, number>;
  jumlahSoalTotal: number;
  distribusiMode: 'materi' | 'sub_materi';
  setDistribusiMode: (mode: 'materi' | 'sub_materi') => void;
  subMateriRules: SubMateriRule[];
  setSubMateriRules: (rules: SubMateriRule[]) => void;
  coverage: {
    allTypesCovered: boolean;
    allMateriCovered: boolean;
    allDiffsCovered: boolean;
    typesCovered: number;
    activeTypes: number;
    materisCovered: number;
    materisInBank: number;
    diffsCovered: number;
    diffsInBank: number;
    showWarning: boolean;
  } | null;
  setJumlahPerTipe: (value: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  setActiveTypes: (value: string[] | ((prev: string[]) => string[])) => void;
}) {
  if (!useAiSelection) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div className="form-section-title" style={{ fontSize: 12, marginBottom: 8 }}>Mode Distribusi Soal</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="radio"
            value="materi"
            checked={distribusiMode === 'materi'}
            onChange={() => { setDistribusiMode('materi'); setSubMateriRules([]); }}
          />
          <span style={{ fontSize: 13 }}>Berdasarkan Materi (global per jenis)</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="radio"
            value="sub_materi"
            checked={distribusiMode === 'sub_materi'}
            onChange={() => setDistribusiMode('sub_materi')}
          />
          <span style={{ fontSize: 13 }}>Berdasarkan Sub-Materi (per sub-materi)</span>
        </label>
      </div>

      {distribusiMode === 'materi' && (
        <div>
          <div className="form-section-title" style={{ fontSize: 12 }}>Jumlah soal per jenis (AI distribusi acak per siswa)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
            {activeTypes.map((t) => {
              const availT = itemsByMateri.filter((it) => it.item_type === t).length;
              const label = t === 'pernyataan_bs' ? 'Pernyataan B/S' : (ITEM_TYPE_LABELS[t] ?? t);
              return (
                <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 90 }}>
                  <label style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</label>
                  <input
                    type="number"
                    className="input"
                    style={{ width: 90 }}
                    min={0}
                    max={availT}
                    value={(jumlahPerTipe as Record<string, number>)[t] || 0}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(Number(e.target.value) || 0, availT));
                      setJumlahPerTipe((prev: Record<string, number>) => ({ ...prev, [t]: v }) as Record<string, number>);
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{availT} tersedia</span>
                </div>
              );
            })}
          </div>
          {ALL_ITEM_TYPES.some((t) => !activeTypes.includes(t)) && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Tambah jenis soal:</span>
              <FilterSelect
                value=""
                onChange={(v) => {
                  if (v) {
                    setJumlahPerTipe((prev: Record<string, number>) => ({ ...prev, [v]: 0 }) as Record<string, number>);
                    setActiveTypes((a: string[]) => [...a, v]);
                  }
                }}
                placeholder="+"
                minWidth={140}
                options={ALL_ITEM_TYPES.filter((t) => !activeTypes.includes(t)).map((t) => ({
                  value: t,
                  label: t === 'pernyataan_bs' ? 'Pernyataan B/S' : (ITEM_TYPE_LABELS[t] ?? t),
                }))}
              />
            </div>
          )}
           <p className="input-hint" style={{ marginTop: 6 }}>
             Total {jumlahSoalTotal} soal ({filteredItems.length} tersedia). {jumlahSoalTotal === 0 ? 'Isi minimal 1.' : ''}
           </p>
        </div>
      )}

      {distribusiMode === 'sub_materi' && (
        <div>
          <div className="form-section-title" style={{ fontSize: 12 }}>Sub-Materi & Jumlah per Jenis</div>
          <p className="input-hint" style={{ marginBottom: 8 }}>
            Setiap sub-materi akan mendapat soal sesuai aturan di bawah. Item di bank soal harus memiliki kolom sub_materi terisi.
          </p>
          {subMateriRules.length === 0 && (
            <p className="input-hint" style={{ color: 'var(--muted)' }}>Belum ada sub-materi. Klik "Tambah Sub-Materi" untuk mulai.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {subMateriRules.map((rule, idx) => (
              <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, backgroundColor: 'var(--surface-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <input
                    type="text"
                    className="input"
                    style={{ flex: 1, maxWidth: 300 }}
                    value={rule.nama}
                    onChange={(e) => {
                      const next = [...subMateriRules];
                      next[idx] = { ...next[idx], nama: e.target.value };
                      setSubMateriRules(next);
                    }}
                    placeholder="Nama sub-materi (mis. Persamaan Linier)"
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => setSubMateriRules(subMateriRules.filter((_, i) => i !== idx))}
                  >
                    Hapus
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {activeTypes.map((t) => {
                    const availT = itemsByMateri.filter((it) => it.item_type === t && it.sub_materi === rule.nama).length;
                    const label = t === 'pernyataan_bs' ? 'Pernyataan B/S' : (ITEM_TYPE_LABELS[t] ?? t);
                    return (
                      <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 90 }}>
                        <label style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</label>
                        <input
                          type="number"
                          className="input"
                          style={{ width: 90 }}
                          min={0}
                          max={availT}
                          value={rule.jumlah_per_type[t] || 0}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(Number(e.target.value) || 0, availT));
                            const next = [...subMateriRules];
                            next[idx] = { ...next[idx], jumlah_per_type: { ...next[idx].jumlah_per_type, [t]: v } };
                            setSubMateriRules(next);
                          }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{availT} tersedia</span>
                      </div>
                    );
                  })}
                </div>
                {activeTypes.some((t) => {
                  const availT = itemsByMateri.filter((it) => it.item_type === t && it.sub_materi === rule.nama).length;
                  return (rule.jumlah_per_type[t] || 0) > availT;
                }) && (
                  <p className="input-hint" style={{ marginTop: 4, color: 'var(--danger)' }}>
                    ⚠ Beberapa jenis soal melebihi ketersediaan untuk sub-materi ini.
                  </p>
                )}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={!!rule.difficulty_ratio}
                      onChange={(e) => {
                        const next = [...subMateriRules];
                        if (e.target.checked) {
                          next[idx] = { ...next[idx], difficulty_ratio: { 1: 0.3, 2: 0.5, 3: 0.2 } };
                        } else {
                          const { difficulty_ratio: _, ...rest } = next[idx];
                          next[idx] = rest;
                        }
                        setSubMateriRules(next);
                      }}
                    />
                    Atur rasio tingkat kesulitan untuk sub-materi ini
                  </label>
                  {rule.difficulty_ratio && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {DIFF_OPTS.map((d) => (
                        <div key={d.v} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 90 }}>
                          <label style={{ fontSize: 11, color: 'var(--muted)' }}>{d.label}</label>
                          <input
                            type="number"
                            className="input"
                            style={{ width: 80 }}
                            min={0}
                            max={100}
                            value={Math.round((rule.difficulty_ratio?.[d.v] || 0) * 100)}
                            onChange={(e) => {
                              const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                              const next = [...subMateriRules];
                              next[idx] = { ...next[idx], difficulty_ratio: { ...next[idx].difficulty_ratio, [d.v]: val / 100 } };
                              setSubMateriRules(next);
                            }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                  const newRule = {
                    nama: '',
                    jumlah_per_type: activeTypes.reduce(
                      (acc, t) => ({ ...acc, [t]: 0 }),
                      {} as Record<string, number>
                    ),
                    difficulty_ratio: { 1: 0.3, 2: 0.5, 3: 0.2 },
                  };
                  setSubMateriRules([...subMateriRules, newRule]);
                }}
            >
              + Tambah Sub-Materi
            </button>
          </div>
          <p className="input-hint" style={{ marginTop: 8 }}>
            Total soal: <strong>{subMateriRules.reduce((sum, r) => sum + Object.values(r.jumlah_per_type).reduce((s, n) => s + (n || 0), 0), 0)}</strong>
          </p>
        </div>
      )}

      {coverage && (
        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, backgroundColor: 'var(--surface-2)', fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Cakupan paket:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ color: coverage.allTypesCovered ? 'var(--ok)' : 'var(--danger)' }}>
              {coverage.allTypesCovered ? '✓' : '✗'} {coverage.typesCovered}/{coverage.activeTypes} jenis soal
            </span>
            <span style={{ color: coverage.allMateriCovered ? 'var(--ok)' : 'var(--danger)' }}>
              {coverage.allMateriCovered ? '✓' : '✗'} {coverage.materisCovered}/{coverage.materisInBank} materi
            </span>
            <span style={{ color: coverage.allDiffsCovered ? 'var(--ok)' : 'var(--danger)' }}>
              {coverage.allDiffsCovered ? '✓' : '✗'} {coverage.diffsCovered}/{coverage.diffsInBank} tingkat kesulitan
            </span>
          </div>
          {coverage.showWarning && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              Pastikan setiap jenis soal minimal 1, dan filter mencakup semua materi & tingkat kesulitan.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function PaketGuru({ profile }: { profile: AppProfile }) {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('latihan');
  const [mapel, setMapel] = useState('');
  const [materi, setMateri] = useState('');
  const [jenjang, setJenjang] = useState(profile.jenjang || 'sma');
  const [menit, setMenit] = useState(15);
  const [shuffle, setShuffle] = useState(true);
  const [useAiSelection, setUseAiSelection] = useState(true);
  const [jumlahPerTipe, setJumlahPerTipe] = useState<Record<string, number>>(
    ALL_ITEM_TYPES.reduce((acc, t) => ({ ...acc, [t]: 0 }), {})
  );
  const [activeTypes, setActiveTypes] = useState<string[]>(['pg', 'pg_kompleks', 'pernyataan_bs']);
  const jumlahSoalTotal = useMemo(
    () => Object.values(jumlahPerTipe).reduce((s, n) => s + (n || 0), 0),
    [jumlahPerTipe]
  );
  const [selectedMateris, setSelectedMateris] = useState<Set<string>>(new Set());
  const [infoText, setInfoText] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedDiffs, setSelectedDiffs] = useState<Set<number>>(new Set());
  const [difficultyRatio, setDifficultyRatio] = useState<Record<number, number>>({ 1: 0.3, 2: 0.5, 3: 0.2 });
  const [useDifficultyRatio, setUseDifficultyRatio] = useState(true);
  const [mySubjects, setMySubjects] = useState<string[]>([]);
  const [mapelOptions, setMapelOptions] = useState<string[]>([]);
  const [jadwalMulai, setJadwalMulai] = useState('');
  const [jadwalSelesai, setJadwalSelesai] = useState('');
  const [jadwalToken, setJadwalToken] = useState('');
  const [distribusiMode, setDistribusiMode] = useState<'materi' | 'sub_materi'>('materi');
  const [subMateriRules, setSubMateriRules] = useState<SubMateriRule[]>([]);
  const isGuru = profile.role === 'guru';
  const isAdmin = profile.role === 'admin' || profile.role === 'konten';

  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<string>('');

  function generateToken(len = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let t = '';
    for (let i = 0; i < len; i++) t += chars[Math.floor(Math.random() * chars.length)];
    return t;
  }

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setErr('File harus berformat .xlsx atau .xls');
      return;
    }
    if (!isAdmin) {
      setErr('Hanya admin/konten yang bisa import bank soal');
      return;
    }
    setImportBusy(true);
    setErr('');
    setOk('');
    setImportResult('');
    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      
      type NaskahRow = {
        ID: string; Subbab: string; Tingkat: string; Bentuk: string;
        'Stimulus / Data': string; 'Pertanyaan / Perintah': string;
        'Pilihan atau Pernyataan': string; Waktu: string;
      };
      type KunciRow = {
        ID: string; Subbab: string; Tingkat: string; Bentuk: string;
        'Kunci (berdasarkan isi)': string; 'Pembahasan lengkap': string;
        Penskoran: string; Status: string;
      };
      
      const naskah = XLSX.utils.sheet_to_json<NaskahRow>(wb.Sheets['Naskah Siswa'], { defval: '' });
      const kunci = XLSX.utils.sheet_to_json<KunciRow>(wb.Sheets['Kunci & Pembahasan'], { defval: '' });
      
      if (!naskah.length || !kunci.length) {
        throw new Error('Sheet "Naskah Siswa" atau "Kunci & Pembahasan" tidak ditemukan/ kosong');
      }
      
      const kunciMap = new Map();
      for (const row of kunci) {
        kunciMap.set(row.ID, row);
      }
      
      function parseOptions(tipe: string, raw: string) {
        if (!raw || typeof raw !== 'string') return [];
        if (tipe === 'PG') return ['A', 'B', 'C', 'D', 'E'];
        return raw.split('\n')
          .map(s => s.trim())
          .filter(Boolean)
          .map(s => s.replace(/^\d+[\.\)]\s*/, ''))
          .map(s => s.replace(/\s*\[\s*\]\s*[BS]\s*\[\s*\]\s*[BS]\s*$/, ''))
          .map(s => s.trim());
      }
      
      function parseKey(tipe: string, raw: string, options: string[]) {
        if (!raw || typeof raw !== 'string') return tipe === 'PG' ? 0 : [];
        const s = raw.trim();
        if (tipe === 'PG') {
          const idx = 'ABCDE'.indexOf(s.toUpperCase());
          return idx >= 0 ? idx : 0;
        }
        if (tipe === 'PGK') {
          const correctTexts = s.split('||').map(p => p.trim());
          return options.map(opt => correctTexts.some(ct => 
            opt.toLowerCase().includes(ct.toLowerCase()) || ct.toLowerCase().includes(opt.toLowerCase())
          ));
        }
        if (tipe === 'PBS') {
          return s.split(/[\s\-–—]+/).map(c => c.trim().toUpperCase() === 'S' ? true : c.trim().toUpperCase() === 'B' ? false : null).filter(v => v !== null);
        }
        return [];
      }
      
      function parseDifficulty(t: string) {
        const map: Record<string, number> = { 'Mudah': 1, 'Sedang': 2, 'Sulit': 3 };
        return map[t] ?? 1;
      }
      
      function mapItemType(tipe: string) {
        const map: Record<string, string> = { 'PG': 'pg', 'PGK': 'pg_kompleks', 'PBS': 'pernyataan_bs' };
        return map[tipe] ?? 'pg';
      }
      
      function parseRationale(raw: string) {
        if (!raw) return '';
        return raw.replace(/\\n/g, '\n').trim();
      }
      
      const itemsToInsert = [];
      let skipped = 0;
      
      for (const row of naskah) {
        const id = row.ID;
        if (!id) { skipped++; continue; }
        
        const k = kunciMap.get(id);
        if (!k) { skipped++; continue; }
        
        const tipe = row.Bentuk;
        const options = parseOptions(tipe, row['Pilihan atau Pernyataan']);
        const key = parseKey(tipe, k['Kunci (berdasarkan isi)'], options);
        const rationale = parseRationale(k['Pembahasan lengkap']);
        
        itemsToInsert.push({
          external_id: id,
          scope: 'school',
          jenjang: 'sma',
          mapel: 'Matematika',
          item_type: mapItemType(tipe),
          stem: row['Pertanyaan / Perintah'] || '',
          stimulus: row['Stimulus / Data'] || null,
          choices: options.length > 0 ? options : null,
          correct_key: JSON.stringify(key),
          rationale: rationale,
          difficulty: parseDifficulty(row.Tingkat),
          status: 'published',
          sub_materi: row.Subbab || null,
          irt_a: null,
          irt_b: null,
          irt_c: null,
        });
      }
      
      if (itemsToInsert.length === 0) {
        throw new Error('Tidak ada soal valid untuk diimport');
      }
      
      const { error } = await insforge.database
        .from('items')
        .upsert(itemsToInsert, { onConflict: 'external_id', ignoreDuplicates: false });
      
      if (error) throw error;
      
      // Refresh items list if mapel matches
      if (mapel === 'Matematika') {
        const { data, error: fetchErr } = await insforge.database
          .from('items')
          .select('id, stem, mapel, materi, item_type, difficulty, sub_materi')
          .eq('mapel', 'Matematika')
          .neq('status', 'retired')
          .order('mapel')
          .order('materi');
        if (!fetchErr) setItems((data || []) as ItemRow[]);
      }
      
      setImportResult(`Berhasil import ${itemsToInsert.length} soal (skip ${skipped})`);
      setOk(`Import selesai: ${itemsToInsert.length} soal ditambahkan/diperbarui`);
      e.target.value = '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import gagal';
      setErr(msg);
      setImportResult('Gagal: ' + msg);
    } finally {
      setImportBusy(false);
    }
  }

  const discuss = kind === 'latihan';
  const durationSec = kind === 'latihan' ? (menit > 0 ? menit * 60 : null) : Math.max(5, menit) * 60;

  async function load() {
    let q = insforge.database
      .from('packages')
      .select('id, title, kind, mapel, materi, info, jenjang, item_count, duration_sec, discuss_after_each, shuffle, use_ai_selection, jumlah_soal_soal, ai_config');
    if (!isAdmin) {
      q = q.eq('created_by', profile.id);
    }
    const p = await q;
    if (p.error) setErr(p.error.message);
    else setPkgs((p.data || []) as Pkg[]);
  }

  useEffect(() => {
    void load();
  }, [profile.id]);

  useEffect(() => {
    if (!isGuru && !isAdmin) return;
    void (async () => {
      const { data, error } = await insforge.database
        .from('teacher_subjects')
        .select('subject')
        .eq('profile_id', profile.id)
        .eq('is_active', true);
      if (!error && data) setMySubjects((data as { subject: string }[]).map((r) => r.subject));
    })();
  }, [profile.id, isGuru, isAdmin]);

  useEffect(() => {
    void (async () => {
      const { data, error } = await insforge.database.from('items').select('mapel');
      if (!error && data) {
        setMapelOptions([...new Set((data as { mapel: string }[]).map((r) => r.mapel).filter(Boolean))].sort());
      }
    })();
  }, [jenjang]);

  useEffect(() => {
    if ((isGuru || isAdmin) && mySubjects.length > 0 && !mapel) {
      const first = mySubjects[0];
      setMapel(first);
      setMateri('');
      setSelectedMateris(new Set());
    }
  }, [isGuru, isAdmin, mySubjects, mapel]);

  useEffect(() => {
    if (!mapel) {
      setItems([]);
      return;
    }
    void (async () => {
      const { data, error } = await insforge.database
        .from('items')
        .select('id, stem, mapel, materi, item_type, difficulty, sub_materi')
        .eq('mapel', mapel)
        .neq('status', 'retired')
        .order('mapel')
        .order('materi');
      if (error) setErr(error.message);
      else setItems((data || []) as ItemRow[]);
    })();
  }, [mapel]);

  function toggle(id: string) {
    setPicked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  function kosongkanForm() {
    setEditId(null);
    setTitle('');
    setPicked([]);
    setKind('latihan');
    setMapel('');
    setMateri('');
    setMenit(15);
    setUseAiSelection(true);
    setActiveTypes(['pg', 'pg_kompleks', 'pernyataan_bs']);
    setJumlahPerTipe({ pg: 0, pg_kompleks: 0, pernyataan_bs: 0 });
    setSelectedMateris(new Set());
    setSelectedTypes(new Set());
    setSelectedDiffs(new Set());
    setDifficultyRatio({ 1: 0.3, 2: 0.5, 3: 0.2 });
    setUseDifficultyRatio(true);
    setInfoText('');
    setJadwalMulai('');
    setJadwalSelesai('');
    setJadwalToken('');
    setDistribusiMode('materi');
    setSubMateriRules([]);
  }

  async function muatPaket(p: Pkg) {
    if (isGuru && mySubjects.length > 0 && !mySubjects.includes(p.mapel)) {
      setErr(`Paket "${p.title}" adalah untuk mapel "${p.mapel}" yang tidak lagi Anda ajar.`);
      return;
    }
    setEditId(p.id);
    setTitle(p.title);
    setKind(p.kind as (typeof KINDS)[number]['id']);
    setMapel(p.mapel);
    setMateri(p.materi || '');
    setJenjang(p.jenjang);
    setMenit(p.duration_sec ? Math.round(p.duration_sec / 60) : 0);
    setShuffle(p.shuffle);
    setUseAiSelection(p.use_ai_selection || false);
    if (p.ai_config && typeof p.ai_config === 'object') {
      const cfg = p.ai_config as Record<string, unknown>;
      if (Array.isArray(cfg.materi)) setSelectedMateris(new Set(cfg.materi as string[]));
      else setSelectedMateris(p.materi ? new Set(p.materi.split(',').map((s) => s.trim()).filter(Boolean)) : new Set());
      if (Array.isArray(cfg.item_types)) setSelectedTypes(new Set(cfg.item_types as string[]));
      if (Array.isArray(cfg.difficulties)) setSelectedDiffs(new Set(cfg.difficulties as number[]));
      if (cfg.jumlah_per_type && typeof cfg.jumlah_per_type === 'object') {
        const jt = cfg.jumlah_per_type as Record<string, number>;
        setJumlahPerTipe(jt);
        setActiveTypes(Object.keys(jt));
      }
      if (cfg.mode === 'sub_materi' && Array.isArray(cfg.sub_materi_rules)) {
        setDistribusiMode('sub_materi');
        setSubMateriRules(cfg.sub_materi_rules as SubMateriRule[]);
      } else {
        setDistribusiMode('materi');
        setSubMateriRules([]);
      }
      if (cfg.difficulty_ratio && typeof cfg.difficulty_ratio === 'object') {
        setDifficultyRatio(cfg.difficulty_ratio as Record<number, number>);
        setUseDifficultyRatio(true);
      } else {
        setDifficultyRatio({ 1: 0.3, 2: 0.5, 3: 0.2 });
        setUseDifficultyRatio(false);
      }
    } else {
      setSelectedMateris(p.materi ? new Set(p.materi.split(',').map((s) => s.trim()).filter(Boolean)) : new Set());
      setDistribusiMode('materi');
      setSubMateriRules([]);
    }
    setInfoText(p.info || '');
    if (p.kind === 'ujian_kelas') {
      const { data: sch } = await insforge.database
        .from('exam_schedules')
        .select('start_at, end_at, token')
        .eq('package_id', p.id)
        .maybeSingle();
      if (sch) {
        setJadwalMulai(sch.start_at ? new Date(sch.start_at).toISOString().slice(0, 16) : '');
        setJadwalSelesai(sch.end_at ? new Date(sch.end_at).toISOString().slice(0, 16) : '');
        setJadwalToken(sch.token || '');
      } else {
        setJadwalMulai('');
        setJadwalSelesai('');
        setJadwalToken('');
      }
    } else {
      setJadwalMulai('');
      setJadwalSelesai('');
      setJadwalToken('');
    }
    const { data } = await insforge.database.from('package_items').select('item_id').eq('package_id', p.id);
    setPicked(((data || []) as { item_id: string }[]).map((r) => r.item_id));
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setOk('');
    if (!profile.school_id) {
      setErr('Profil belum punya school_id.');
      return;
    }
    if (!title.trim()) {
      setErr('Judul wajib.');
      return;
    }
    if (!mapel.trim()) {
      setErr('Pilih mapel.');
      return;
    }
    if (!useAiSelection && picked.length < 1) {
      setErr('Pilih minimal 1 soal dari bank soal.');
      return;
    }
    if (useAiSelection && jumlahSoalTotal < 1) {
      setErr('Pilih minimal 1 soal melalui jenis soal di bawah.');
      return;
    }
    if (useAiSelection) {
      for (const t of activeTypes) {
        const availT = itemsByMateri.filter((it) => it.item_type === t).length;
        if ((jumlahPerTipe[t] || 0) > availT) {
          setErr(`Jumlah ${ITEM_TYPE_LABELS[t] || t} (${jumlahPerTipe[t]}) melebihi tersedia (${availT}).`);
          return;
        }
      }
      if (jumlahSoalTotal > filteredItems.length && filteredItems.length > 0) {
        setErr(`Jumlah soal (${jumlahSoalTotal}) melebihi bank soal yang tersedia (${filteredItems.length}).`);
        return;
      }
      for (const t of activeTypes) {
        if ((jumlahPerTipe[t] || 0) < 1) {
          setErr(`Jumlah soal untuk jenis ${ITEM_TYPE_LABELS[t] || t} harus minimal 1.`);
          return;
        }
      }
      const materisWithQuestions = [...new Set(filteredItems.map((it) => it.materi).filter(Boolean) as string[])];
      const materisInBank = [...new Set(itemsByMateri.map((it) => it.materi).filter(Boolean) as string[])];
      const materisWithoutQuestions = materisInBank.filter((m) => !materisWithQuestions.includes(m));
      if (materisWithoutQuestions.length > 0) {
        setErr(`Materi berikut tidak memiliki soal dengan filter yang dipilih: ${materisWithoutQuestions.join(', ')}. Tambah jenis soal atau tingkat kesulitan agar semua materi tercakup.`);
        return;
      }
if (distribusiMode === 'sub_materi') {
        for (const rule of subMateriRules) {
          if (!rule.nama.trim()) {
            setErr('Semua sub-materi harus memiliki nama.');
            return;
          }
          for (const [type, count] of Object.entries(rule.jumlah_per_type)) {
            if ((count || 0) > 0) {
              const avail = itemsByMateri.filter((it) => it.item_type === type && it.sub_materi === rule.nama).length;
              if (avail < (count || 0)) {
                setErr(`Sub-materi "${rule.nama}" jenis ${ITEM_TYPE_LABELS[type] || type}: butuh ${count}, tersedia ${avail}.`);
                return;
              }
            }
          }
          if (rule.difficulty_ratio) {
            const totalRatio = Object.values(rule.difficulty_ratio).reduce((a, b) => a + b, 0);
            if (Math.abs(totalRatio - 1) > 0.01) {
              setErr(`Sub-materi "${rule.nama}": rasio tingkat kesulitan harus total 100% (sekarang ${Math.round(totalRatio * 100)}%).`);
              return;
            }
          }
        }
      }
    }

    const aiConfig = useAiSelection
      ? {
          mode: distribusiMode,
          mapel: mapel || null,
          materi: Array.from(selectedMateris),
          item_types: Array.from(selectedTypes),
          difficulties: Array.from(selectedDiffs),
          difficulty_ratio: useDifficultyRatio ? difficultyRatio : undefined,
          jumlah_soal: jumlahSoalTotal,
          jumlah_per_type: activeTypes.reduce(
            (acc, t) => ({ ...acc, [t]: jumlahPerTipe[t] || 0 }),
            {} as Record<string, number>
          ),
          sub_materi_rules: distribusiMode === 'sub_materi' ? subMateriRules : undefined,
          jenjang,
        }
      : null;

    const row = {
      school_id: profile.school_id,
      created_by: profile.id,
      kind,
      mapel,
      materi: Array.from(selectedMateris).join(', ') || materi || null,
      info: infoText.trim() || null,
      jenjang,
      title: title.trim(),
      item_count: useAiSelection ? jumlahSoalTotal : picked.length,
      duration_sec: durationSec,
      shuffle,
      discuss_after_each: discuss,
      use_ai_selection: useAiSelection,
      jumlah_soal_soal: useAiSelection ? jumlahSoalTotal : null,
      ai_config: aiConfig,
    };

    setOk('Menyimpan…');
    setBusy(true);
    let pkgId = editId;
    if (editId) {
      const { error } = await insforge.database.from('packages').update(row).eq('id', editId);
      if (error) {
        setErr(error.message);
        setOk('');
        setBusy(false);
        return;
      }
      await insforge.database.from('package_items').delete().eq('package_id', editId);
    } else {
      const { data, error } = await insforge.database.from('packages').insert(row).select('id');
      if (error || !data?.[0]) {
        setErr(error?.message || 'Gagal insert paket.');
        setOk('');
        setBusy(false);
        return;
      }
      pkgId = (data[0] as { id: string }).id;
    }

    if (!useAiSelection && picked.length > 0) {
      const links = picked.map((item_id, position) => ({ package_id: pkgId, item_id, position: position + 1 }));
      const { error: e2 } = await insforge.database.from('package_items').insert(links);
      if (e2) {
        setErr(e2.message);
        setOk('');
        setBusy(false);
        return;
      }
    }

    if (kind === 'ujian_kelas' && pkgId) {
      const token = jadwalToken.trim() || generateToken(6);
      const { error: schErr } = await insforge.database
        .from('exam_schedules')
        .upsert({
          package_id: pkgId,
          title: title.trim(),
          subject: mapel,
          materi: Array.from(selectedMateris).join(', ') || null,
          duration_sec: durationSec,
          info: infoText.trim() || null,
          start_at: new Date(jadwalMulai).toISOString(),
          end_at: new Date(jadwalSelesai).toISOString(),
          token,
          is_active: true,
          created_by: profile.id,
        }, { onConflict: 'package_id' });
      if (schErr) {
        setErr('Paket tersimpan tapi gagal simpan jadwal: ' + schErr.message);
        setOk('');
        setBusy(false);
        return;
      }
    }

    setOk(editId ? 'Paket diperbarui.' : 'Paket dibuat.');
    kosongkanForm();
    setBusy(false);
    await load();
  }

  async function hapus(id: string) {
    if (!confirm('Hapus paket ini?')) return;
    const prev = [...pkgs];
    setPkgs((c) => c.filter((p) => p.id !== id));
    setErr('');
    const { error } = await insforge.database.from('packages').delete().eq('id', id);
    if (error) {
      setPkgs(prev);
      setErr(error.message);
    } else {
      if (editId === id) kosongkanForm();
      await load();
    }
  }

  const uniqueMateris = [...new Set(items.map((it) => it.materi).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' })
  );

  const itemsByMateri = useMemo(() =>
    items
      .filter((it) => !mapel || it.mapel === mapel)
      .filter((it) => {
        if (selectedMateris.size === 0) return true;
        return it.materi ? selectedMateris.has(it.materi) : false;
      }),
    [items, mapel, selectedMateris]
  );

  const filteredItems = useMemo(() =>
    itemsByMateri
      .filter((it) => (selectedTypes.size === 0 ? true : selectedTypes.has(it.item_type)))
      .filter((it) => (selectedDiffs.size === 0 ? true : it.difficulty !== null && selectedDiffs.has(Number(it.difficulty)))),
    [itemsByMateri, selectedTypes, selectedDiffs]
  );

  const coverage = useMemo(() => {
    if (!useAiSelection || itemsByMateri.length === 0) return null;
    const materisInBank = [...new Set(itemsByMateri.map((it) => it.materi).filter(Boolean) as string[])];
    const materisCovered = materisInBank.filter((m) => filteredItems.some((it) => it.materi === m));
    const diffsInBank = [...new Set(itemsByMateri.map((it) => it.difficulty).filter(Boolean) as number[])];
    const diffsCovered = diffsInBank.filter((d) => filteredItems.some((it) => it.difficulty === d));
    const typesCovered = activeTypes.filter((t) => (jumlahPerTipe[t] || 0) > 0);
    const allMateriCovered = materisCovered.length === materisInBank.length && materisInBank.length > 0;
    const allDiffsCovered = diffsCovered.length === diffsInBank.length && diffsInBank.length > 0;
    const allTypesCovered = typesCovered.length === activeTypes.length && activeTypes.length > 0;
    return {
      allMateriCovered,
      allDiffsCovered,
      allTypesCovered,
      typesCovered: typesCovered.length,
      activeTypes: activeTypes.length,
      materisCovered: materisCovered.length,
      materisInBank: materisInBank.length,
      diffsCovered: diffsCovered.length,
      diffsInBank: diffsInBank.length,
      showWarning: !allMateriCovered || !allDiffsCovered || !allTypesCovered,
    };
  }, [useAiSelection, itemsByMateri, filteredItems, activeTypes, jumlahPerTipe]);

  if (!['guru', 'admin', 'konten'].includes(profile.role)) {
    return (
      <div className="page">
        <div className="form-card">
          <h2 className="card-title">Paket</h2>
          <p className="card-subtitle">Hanya guru/admin.</p>
        </div>
      </div>
);
}

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{editId ? 'Ubah paket' : 'Buat paket soal'}</h1>
        <p className="page-subtitle">Satu paket = satu mapel. Pilih soal dari semua bank soal sesuai mapel.</p>
      </header>

      {err && (
        <div className="banner banner-danger" style={{ marginBottom: 20 }}>
          <p className="banner-text">{err}</p>
        </div>
      )}
      {ok && (
        <div className="banner banner-ok" style={{ marginBottom: 20 }}>
          <p className="banner-text">{ok}</p>
        </div>
      )}
      {importResult && (
        <div className={`banner ${importResult.startsWith('Gagal') ? 'banner-danger' : 'banner-ok'}`} style={{ marginBottom: 20 }}>
          <p className="banner-text">{importResult}</p>
        </div>
      )}

      <div className="page-split">
        <div className="form-sticky">
          <form onSubmit={simpan} className="form-container">
            <div className="form-card">
              <header className="card-header">
                <div>
                  <h2 className="card-title">{editId ? 'Sunting paket' : 'Identitas paket'}</h2>
                  <p className="card-subtitle">Judul, jenis uji, jenjang, dan mapel/materi.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {isAdmin && (
                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                      Import Excel
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleImportExcel}
                        disabled={importBusy}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                  {editId && (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={kosongkanForm}>
                      Batal
                    </button>
                  )}
                </div>
              </header>

              <div className="form-section">
                <div className="form-section-title">Judul <span className="req"></span></div>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Latihan penalaran 15 menit"
                />
              </div>

              <div className="form-section">
                <div className="form-group">
                  <div className="form-section-title">Jenis <span className="req"></span></div>
                  <FilterSelect
                    value={kind}
                    onChange={(v) => setKind(v as (typeof KINDS)[number]['id'])}
                    placeholder="Pilih jenis"
                    minWidth={160}
                    options={KINDS.filter((k) => k.id !== 'lab_25').map((k) => ({ value: k.id, label: k.label }))}
                  />
                </div>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <div className="form-section-title">Jenjang <span className="req"></span></div>
                  <FilterSelect
                    value={jenjang}
                    onChange={setJenjang}
                    placeholder="Pilih jenjang"
                    minWidth={90}
                    options={JENJANG_OPTS.map((j) => ({ value: j, label: j.toUpperCase() }))}
                  />
                </div>
              </div>

              <div className="form-section">
                <div className="form-section-title">Mapel <span className="req"></span></div>
                <FilterSelect
                  value={mapel}
                  onChange={(m) => {
                    setMapel(m);
                    setMateri('');
                    setSelectedMateris(new Set());
                  }}
                  placeholder="Pilih mapel"
                  minWidth={200}
                  options={((isGuru && !isAdmin) ? mySubjects : mapelOptions).map((m) => ({ value: m, label: m }))}
                />
                {mapel && (
                  <p className="input-hint">
                    {mapel}{selectedMateris.size ? ` · ${Array.from(selectedMateris).join(', ')}` : ''}
                  </p>
                )}

                <div className="hint-panel" style={{ marginTop: 8 }}>
                  <div className="form-section-title" style={{ fontSize: 12, marginBottom: 6 }}>Materi (pilih satu atau lebih)</div>
                  {uniqueMateris.length === 0 ? (
                    <p className="input-hint">Tidak ada materi tersedia untuk mapel ini.</p>
                  ) : (
                    <div className="field-row" style={{ flexWrap: 'wrap', gap: 10 }}>
                      {uniqueMateris.map((m) => {
                        const checked = selectedMateris.has(m);
                        return (
                          <label key={m} className={checked ? 'chip chip-terpilih' : 'chip'}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!mapel}
                              onChange={(e) => {
                                const next = new Set(selectedMateris);
                                if (e.target.checked) next.add(m);
                                else next.delete(m);
                                setSelectedMateris(next);
                                setMateri(Array.from(next).join(','));
                              }}
                            />
                            {m}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-section">
                <div className="form-group">
                  <div className="form-section-title">
                    Durasi (menit) <span className="req"></span>
                  </div>
                  <input
                    className="input"
                    type="number"
                    min={kind === 'latihan' ? 0 : 5}
                    max={180}
                    value={menit}
                    onChange={(e) => setMenit(Number(e.target.value))}
                  />
                  <p className="input-hint" style={{ marginTop: 4 }}>
                    {kind === 'latihan' ? '0 = tanpa countdown ketat' : 'wajib untuk simulasi/ujian'}
                  </p>
                </div>
                <div className="form-group" style={{ marginTop: 16 }}>
                  <div className="form-section-title">Pengaturan</div>
                  <div className="field-row" style={{ marginTop: 8 }}>
                    <input type="checkbox" id="pkg-shuffle" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
                    <label className="form-label" htmlFor="pkg-shuffle">
                      Acak urutan per murid
                    </label>
                  </div>
                  <div className="field-row" style={{ marginTop: 6 }}>
                    <input type="checkbox" id="pkg-discuss" checked={discuss} onChange={() => {}} disabled />
                    <label className="form-label" htmlFor="pkg-discuss" style={{ color: 'var(--muted)' }}>
                      Pembahasan langsung (otomatis untuk jenis Latihan)
                    </label>
                  </div>
                  <div className="field-row" style={{ marginTop: 6, gap: 6 }}>
                    <input
                      type="checkbox"
                      id="pkg-ai"
                      checked={useAiSelection}
                      onChange={(e) => {
                        setUseAiSelection(e.target.checked);
                      }}
                    />
                    <label className="form-label" htmlFor="pkg-ai">
                      AI seleksi acak per siswa
                    </label>
                  </div>
                  <AISelectionUI
                    useAiSelection={useAiSelection}
                    itemsByMateri={itemsByMateri}
                    filteredItems={filteredItems}
                    activeTypes={activeTypes}
                    jumlahPerTipe={jumlahPerTipe}
                    jumlahSoalTotal={jumlahSoalTotal}
                    distribusiMode={distribusiMode}
                    setDistribusiMode={setDistribusiMode}
                    subMateriRules={subMateriRules}
                    setSubMateriRules={setSubMateriRules}
                    coverage={coverage}
                    setJumlahPerTipe={setJumlahPerTipe}
                    setActiveTypes={setActiveTypes}
                  />
                </div>
              </div>

              {kind === 'ujian_kelas' && (
                <div className="form-section" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div className="form-section-title">Jadwal Ujian <span className="req"></span></div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label className="form-label" htmlFor="jadwal-mulai">Waktu mulai</label>
                      <input
                        id="jadwal-mulai"
                        type="datetime-local"
                        className="input"
                        value={jadwalMulai}
                        onChange={(e) => setJadwalMulai(e.target.value)}
                        required
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label className="form-label" htmlFor="jadwal-selesai">Waktu selesai</label>
                      <input
                        id="jadwal-selesai"
                        type="datetime-local"
                        className="input"
                        value={jadwalSelesai}
                        onChange={(e) => setJadwalSelesai(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label className="form-label" htmlFor="jadwal-token">Token akses (opsional)</label>
                    <div className="field-row" style={{ gap: 8, alignItems: 'center' }}>
                      <input
                        id="jadwal-token"
                        type="text"
                        className="input"
                        style={{ flex: 1, textTransform: 'uppercase' }}
                        value={jadwalToken}
                        onChange={(e) => setJadwalToken(e.target.value.toUpperCase())}
                        placeholder="Kosong = auto-generate"
                        maxLength={12}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setJadwalToken(generateToken(6))}
                      >
                        Generate
                      </button>
                    </div>
                    <p className="input-hint" style={{ marginTop: 4 }}>Kode 6-12 karakter untuk siswa masuk ujian. Biarkan kosong untuk otomatis.</p>
                  </div>
                </div>
              )}

              <div className="form-section">
                <div className="form-section-title">Info paket <small className="muted" style={{ display: 'block', fontSize: 11, fontWeight: 400 }}>(opsional — ditampilkan di halaman konfirmasi sebelum mengerjakan)</small></div>
                <textarea
                  className="input"
                  value={infoText}
                  onChange={(e) => setInfoText(e.target.value)}
                  placeholder="mis. Paket ini mencakup PG + uraian. Durasi 90 menit. Bawa kalkulator."
                  rows={3}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>

            <div className="actions">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Menyimpan…' : editId ? 'Simpan perubahan' : 'Buat paket'}
              </button>
            </div>
          </form>
        </div>

        <div className="right-col">
        {!useAiSelection && (
        <div className="form-card">
          <header className="card-header">
            <h2 className="card-title">Pilih soal</h2>
            <p className="card-subtitle">
              {useAiSelection
                  ? `${filteredItems.length} soal tersedia — AI akan pilih ${jumlahSoalTotal} untuk tiap siswa`
                : `${picked.length} dipilih · ${filteredItems.length} tersedia`}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {!useAiSelection && items.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (picked.length === filteredItems.length) setPicked([]);
                    else setPicked(filteredItems.map((it) => it.id));
                  }}
                >
                  {picked.length === filteredItems.length ? 'Hapus semua' : 'Pilih semua'}
                </button>
              )}
              {uniqueMateris.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (selectedMateris.size === uniqueMateris.length) setSelectedMateris(new Set());
                    else setSelectedMateris(new Set(uniqueMateris));
                  }}
                >
                  {selectedMateris.size === uniqueMateris.length ? 'Semua materi' : `Semua materi (${uniqueMateris.length})`}
                </button>
              )}
            </div>
          </header>

          {uniqueMateris.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div className="form-section-title" style={{ fontSize: 12, marginBottom: 6 }}>Filter materi (pilih satu atau lebih)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {uniqueMateris.map((m) => {
                  const checked = selectedMateris.has(m);
                  const count = itemsByMateri.filter((it) => it.materi === m).length;
                  const filteredCount = filteredItems.filter((it) => it.materi === m).length;
                  const hasFiltered = filteredCount > 0;
                  return (
                    <label key={m} className="chip-pick" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: count === 0 ? 0.5 : 1 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={count === 0}
                        onChange={(e) => {
                          const next = new Set(selectedMateris);
                          if (e.target.checked) next.add(m);
                          else next.delete(m);
                          setSelectedMateris(next);
                        }}
                      />
                      <span className="type-bm" style={{ fontSize: 12 }}>
                        {m} ({count})
                        {useAiSelection && count > 0 && !hasFiltered && <span style={{ color: 'var(--danger)', marginLeft: 4 }}>⚠</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <div className="form-section-title" style={{ fontSize: 12, marginBottom: 6 }}>Jenis soal</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_ITEM_TYPES.map((t) => {
                const checked = selectedTypes.has(t);
                const label = ITEM_TYPE_LABELS[t] ?? t;
                const available = itemsByMateri.filter((it) => it.item_type === t).length;
                return (
                  <label key={t} className="chip-pick" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: available === 0 ? 0.5 : 1 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={available === 0}
                      onChange={(e) => {
                        const next = new Set(selectedTypes);
                        if (e.target.checked) next.add(t);
                        else next.delete(t);
                        setSelectedTypes(next);
                      }}
                    />
                    <span className="type-bm" style={{ fontSize: 12 }}>{label} ({available})</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div className="form-section-title" style={{ fontSize: 12, marginBottom: 6 }}>Tingkat kesulitan</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DIFF_OPTS.map((d) => {
                const checked = selectedDiffs.has(d.v);
                const available = itemsByMateri.filter((it) => it.difficulty === d.v).length;
                const filteredCount = filteredItems.filter((it) => it.difficulty === d.v).length;
                const hasFiltered = filteredCount > 0;
                return (
                  <label key={d.v} className="chip-pick" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: available === 0 ? 0.5 : 1 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={available === 0}
                      onChange={(e) => {
                        const next = new Set(selectedDiffs);
                        if (e.target.checked) next.add(d.v);
                        else next.delete(d.v);
                        setSelectedDiffs(next);
                      }}
                    />
                    <span className="type-bm" style={{ fontSize: 12 }}>
                      {d.label} ({available})
                      {useAiSelection && available > 0 && !hasFiltered && <span style={{ color: 'var(--danger)', marginLeft: 4 }}>⚠</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            {selectedDiffs.size > 0 && (
              <p className="input-hint" style={{ marginTop: 6 }}>Hanya soal dengan tingkat kesulitan terpilih yang dimasukkan ke paket.</p>
            )}
          </div>

          {useAiSelection && (
            <div style={{ marginTop: 12 }}>
              <label className="field-row" style={{ alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={useDifficultyRatio}
                  onChange={(e) => setUseDifficultyRatio(e.target.checked)}
                />
                <span style={{ fontWeight: 500 }}>Gunakan rasio tingkat kesulitan global (default: Mudah 30%, Sedang 50%, Sulit 20%)</span>
              </label>
              {useDifficultyRatio && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {DIFF_OPTS.map((d) => (
                    <div key={d.v} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 100 }}>
                      <label style={{ fontSize: 11, color: 'var(--muted)' }}>{d.label}</label>
                      <input
                        type="number"
                        className="input"
                        style={{ width: 80 }}
                        min={0}
                        max={100}
                        value={Math.round((difficultyRatio[d.v] || 0) * 100)}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          setDifficultyRatio((prev) => ({ ...prev, [d.v]: val / 100 }));
                        }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>% dari total soal</span>
                    </div>
                  ))}
                </div>
              )}
              {useDifficultyRatio && (
                <p className="input-hint" style={{ marginTop: 4 }}>
                  Total: {Math.round((difficultyRatio[1] + difficultyRatio[2] + difficultyRatio[3]) * 100)}% {Math.round((difficultyRatio[1] + difficultyRatio[2] + difficultyRatio[3]) * 100) !== 100 && '⚠ Harus 100%'}
                </p>
              )}
            </div>
          )}

          {useAiSelection && (
            <div className="rec-card" style={{ marginBottom: 12 }}>
              <div className="rec-icon">💡</div>
              <div className="rec-info">
                <h3>Distribusi oleh AI</h3>
                <p>AI akan memilih secara acak {jumlahSoalTotal} soal untuk setiap siswa — berbeda tiap user — berdasarkan jumlah per jenis soal, jenis soal, dan tingkat kesulitan di atas. Semua soal pada bank soal ini dapat dipilih.</p>
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="banner banner-warn">
              <p className="banner-text">Pilih mapel terlebih dahulu untuk melihat bank soal tersedia.</p>
            </div>
          )}
          {items.length > 0 && filteredItems.length === 0 && (
            <p className="type-lab">Tidak ada soal untuk materi ini.</p>
          )}

          <div className="chip-pick-row">
            {filteredItems.map((it) => (
              <label
                key={it.id}
                className="chip-pick"
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 6,
                  cursor: 'pointer',
                  backgroundColor: picked.includes(it.id) ? 'var(--accent-soft)' : undefined,
                }}
              >
                <div className="field-row" style={{ width: '100%', margin: 0, gap: 6, padding: 0 }}>
                  <input type="checkbox" checked={picked.includes(it.id)} onChange={() => toggle(it.id)} />
                  <span className="chip chip-sedang" style={{ fontSize: 10, padding: '2px 6px' }}>{it.item_type}</span>
                </div>
                <span className="type-bm" style={{ fontSize: 13, marginTop: 2 }}>
                  {it.mapel}
                  {it.materi ? ` · ${it.materi}` : ''} — {it.stem.slice(0, 120)}
                </span>
              </label>
            ))}
          </div>
        </div>
        )}

      <section className="form-card" style={{ marginTop: 0 }}>
        <header className="card-header">
          <h2 className="card-title">Paket saya ({pkgs.length})</h2>
        </header>

        {pkgs.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h3 className="empty-state-title">Belum ada paket</h3>
            <p className="empty-state-text">Buat paket pertama di formulir di atas.</p>
          </div>
        )}

        {pkgs.map((p) => (
          <article key={p.id} className="card" style={{ marginBottom: 8, boxShadow: 'none', padding: '12px 16px' }}>
            <div className="card-header">
              <div>
                <h3 className="card-title" style={{ fontSize: 15 }}>{p.title}</h3>
                <p className="card-subtitle">
                  {p.kind} · {p.mapel} · {p.item_count} soal ·{' '}
                  {p.duration_sec ? `${Math.round(p.duration_sec / 60)} mnt` : 'tanpa timer ketat'} ·{' '}
                  {p.discuss_after_each ? 'pembahasan langsung' : 'pembahasan setelah paket'}
                  {p.use_ai_selection && ` · AI: ${p.jumlah_soal_soal} soal/siswa`}
                </p>
              </div>
              <div className="btn-group">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => muatPaket(p)}>
                  Ubah
                </button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => hapus(p.id)}>
                  Hapus
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
    </div>
  </div>
  );
}