import XLSX from 'xlsx';
import { createClient } from '@insforge/sdk';

const INS_URL = 'https://t8hhdbf6.ap-southeast.insforge.app';
const INS_ANON_KEY = 'ik_fbb1ff8ef5c457c5b7446d8579754187';

const client = createClient({ baseUrl: INS_URL, anonKey: INS_ANON_KEY });

function parseOptions(tipe, raw) {
  if (!raw || typeof raw !== 'string') return [];
  if (tipe === 'PG') {
    return ['A', 'B', 'C', 'D', 'E'];
  }
  // PGK and PBS: split by newlines, remove numbering and checkbox markup
  return raw.split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^\d+[\.\)]\s*/, ''))
    .map(s => s.replace(/\s*\[\s*\]\s*[BS]\s*\[\s*\]\s*[BS]\s*$/, ''))
    .map(s => s.trim());
}

function parseKey(tipe, raw, options) {
  if (!raw || typeof raw !== 'string') return tipe === 'PG' ? 0 : [];
  const s = raw.trim();
  if (tipe === 'PG') {
    const idx = 'ABCDE'.indexOf(s.toUpperCase());
    return idx >= 0 ? idx : 0;
  }
  if (tipe === 'PGK') {
    // Kunci lists correct statements separated by ||, match with options
    const correctTexts = s.split('||').map(p => p.trim());
    return options.map(opt => correctTexts.some(ct => 
      opt.toLowerCase().includes(ct.toLowerCase()) || ct.toLowerCase().includes(opt.toLowerCase())
    ));
  }
  if (tipe === 'PBS') {
    // Kunci is S/B sequence like "S – B – B – S"
    return s.split(/[\s\-–—]+/).map(c => c.trim().toUpperCase() === 'S' ? true : c.trim().toUpperCase() === 'B' ? false : null).filter(v => v !== null);
  }
  return [];
}

function parseDifficulty(t) {
  const map = { 'Mudah': 1, 'Sedang': 2, 'Sulit': 3 };
  return map[t] ?? 1;
}

function mapItemType(tipe) {
  const map = { 'PG': 'pg', 'PGK': 'pg_kompleks', 'PBS': 'pernyataan_bs' };
  return map[tipe] ?? 'pg';
}

function parseRationale(raw) {
  if (!raw) return '';
  return raw.replace(/\\n/g, '\n').trim();
}

async function main() {
  console.log('Reading Excel file...');
  const wb = XLSX.readFile('Bank_Soal_Statistika_Data_Berkelompok_Kelas_XII_459_Soal.xlsx');
  
  const naskah = XLSX.utils.sheet_to_json(wb.Sheets['Naskah Siswa'], { defval: '' });
  const kunci = XLSX.utils.sheet_to_json(wb.Sheets['Kunci & Pembahasan'], { defval: '' });
  
  console.log(`Naskah rows: ${naskah.length}, Kunci rows: ${kunci.length}`);
  
  const kunciMap = new Map();
  for (const row of kunci) {
    kunciMap.set(row.ID, row);
  }
  
  const items = [];
  let skipped = 0;
  
  for (const row of naskah) {
    const id = row.ID;
    if (!id) { skipped++; continue; }
    
    const k = kunciMap.get(id);
    if (!k) {
      console.warn(`No kunci found for ${id}`);
      skipped++;
      continue;
    }
    
    const tipe = row.Bentuk;
    const options = parseOptions(tipe, row['Pilihan atau Pernyataan']);
    const key = parseKey(tipe, k['Kunci (berdasarkan isi)'], options);
    const rationale = parseRationale(k['Pembahasan lengkap']);
    
    const item = {
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
    };
    
    items.push(item);
  }
  
  console.log(`Prepared ${items.length} items (skipped ${skipped})`);
  
  if (items.length === 0) {
    console.log('No items to import');
    return;
  }
  
  console.log('Upserting to database...');
  const { data, error } = await client.database
    .from('items')
    .upsert(items, { onConflict: 'external_id', ignoreDuplicates: false });
  
  if (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
  
  console.log(`Successfully imported ${items.length} items`);
}

main().catch(console.error);