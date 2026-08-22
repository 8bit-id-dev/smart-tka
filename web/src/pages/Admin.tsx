import { useEffect, useState } from 'react';
import { assignSiswaKeKelas, cariKelasByKode } from '../lib/kelas';
import { adminCreateAuthUser, insforge, summarizeAuthError, type AppProfile } from '../lib/insforge';
import { DirectoryGalleryAdmin } from './DirectoryGalleryAdmin';

type UserRow = AppProfile;
type ClassRow = { id: string; name: string; jenjang: string; invite_code?: string };
type PkgRow = { id: string; title: string; mapel: string; kind: string };
type AsgRow = { id: string; package_id: string; class_id: string; due_at: string | null };
type TSubjRow = { profile_id: string; subject: string; is_active: boolean };
type CS = { class_id: string; profile_id: string };
type MapelRow = { id: string; name: string };
type CsvRow = {
  email: string;
  password: string;
  nama: string;
  role: string;
  jenjang: string;
  kode_kelas: string;
};

const ROMAN_NUMERALS: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15,
};

function parseClassName(name: string): { roman: string; romanNum: number; num: number } {
  const match = name.match(/^([IVXLCDM]+)(?:\.(\d+))?$/i);
  if (match) {
    const roman = match[1].toUpperCase();
    const num = match[2] ? parseInt(match[2], 10) : 0;
    return { roman, romanNum: ROMAN_NUMERALS[roman] || 0, num };
  }
  return { roman: '', romanNum: 0, num: 0 };
}

function sortClassesByName(classes: ClassRow[]): ClassRow[] {
  return [...classes].sort((a, b) => {
    const parsedA = parseClassName(a.name);
    const parsedB = parseClassName(b.name);
    if (parsedA.romanNum !== parsedB.romanNum) {
      return parsedA.romanNum - parsedB.romanNum;
    }
    return parsedA.num - parsedB.num;
  });
}

const ROLES = ['siswa', 'orang_tua', 'guru', 'admin', 'kepsek'] as const;
const JENJANG_OPTS = ['sd', 'smp', 'sma', 'smk'] as const;

export function Admin({ me }: { me: AppProfile }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [pkgs, setPkgs] = useState<PkgRow[]>([]);
  const [asgs, setAsgs] = useState<AsgRow[]>([]);
  const [anggota, setAnggota] = useState<CS[]>([]);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('Siswa1234');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<string>('siswa');
  const [newJenjang, setNewJenjang] = useState('smp');
  const [newClass, setNewClass] = useState('');

  const [asgPkg, setAsgPkg] = useState('');
  const [asgClass, setAsgClass] = useState('');
  const [asgDue, setAsgDue] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [openUsers, setOpenUsers] = useState(false);
  const [openAsg, setOpenAsg] = useState(false);
  const [openTs, setOpenTs] = useState(false);
  const [manageTs, setManageTs] = useState<string | null>(null);
  const [tsMap, setTsMap] = useState<Record<string, TSubjRow[]>>({});
  const [mapelList, setMapelList] = useState<MapelRow[]>([]);
  const [openRole, setOpenRole] = useState<Record<string, boolean>>({});
  const [openKelas, setOpenKelas] = useState<Record<string, boolean>>({});

  async function load(opts?: { keepMessages?: boolean }) {
    if (!opts?.keepMessages) setErr('');
    const u = await insforge.database.from('profiles').select('id, user_id, full_name, role, school_id, jenjang, is_active');
    if (u.error && !opts?.keepMessages) setErr(u.error.message);
    else setUsers((u.data || []) as UserRow[]);

    const c = await insforge.database.from('classes').select('id, name, jenjang, invite_code');
    if (!c.error) setClasses((c.data || []) as ClassRow[]);

    const p = await insforge.database.from('packages').select('id, title, mapel, kind');
    if (!p.error) setPkgs((p.data || []) as PkgRow[]);

    const a = await insforge.database.from('assignments').select('id, package_id, class_id, due_at');
    if (!a.error) setAsgs((a.data || []) as AsgRow[]);
    const m = await insforge.database.from('class_students').select('class_id, profile_id');
    if (!m.error) setAnggota((m.data || []) as CS[]);

    const ml = await insforge.database.from('mapels').select('id, name');
    if (!ml.error && ml.data) {
      const raw = ml.data as { id: string; name: string }[];
      const deduped = [...new Map(raw.map((m) => [m.name, m])).values()];
      setMapelList(deduped as MapelRow[]);
    }
  }

  async function toggleActiveUser(id: string, currentIsActive: boolean) {
    setErr('');
    setOk('');
    const nextState = !currentIsActive;
    const { error } = await insforge.database.from('profiles').update({ is_active: nextState }).eq('id', id);
    if (error) {
      setErr('Gagal mengubah status user: ' + error.message);
    } else {
      setOk(`User berhasil di-${nextState ? 'aktifkan' : 'nonaktifkan'}.`);
      await load({ keepMessages: true });
    }
  }

   function urutNama(a: UserRow, b: UserRow) {
    return (a.full_name || '').localeCompare(b.full_name || '', 'id', { sensitivity: 'base' });
  }

  function isSubjectAssigned(pid: string, subject: string): boolean {
    return !!tsMap[pid]?.some((r) => r.subject === subject && r.is_active);
  }

  async function loadTs() {
    const { data } = await insforge.database
      .from('teacher_subjects')
      .select('profile_id, subject, is_active')
      .order('profile_id')
      .order('subject');
    const map: Record<string, TSubjRow[]> = {};
    for (const r of (data || []) as TSubjRow[]) {
      if (!map[r.profile_id]) map[r.profile_id] = [];
      map[r.profile_id].push(r);
    }
    setTsMap(map);
  }

  async function toggleSubject(pid: string, subject: string, currentlyAssigned: boolean) {
    setErr('');
    setOk('');
    if (currentlyAssigned) {
      const { error } = await insforge.database
        .from('teacher_subjects')
        .delete()
        .eq('profile_id', pid)
        .eq('subject', subject);
      if (error) {
        setErr('Gagal hapus assignment: ' + error.message);
        return;
      }
      setTsMap((prev) => ({
        ...prev,
        [pid]: prev[pid]?.filter((r) => r.subject !== subject) || [],
      }));
      setOk(`Mapel ${subject} dicabut dari guru.`);
    } else {
      const { error } = await insforge.database
        .from('teacher_subjects')
        .insert({ profile_id: pid, school_id: me.school_id, subject });
      if (error) {
        setErr('Gagal assign mapel: ' + error.message);
        return;
      }
      setTsMap((prev) => ({
        ...prev,
        [pid]: [...(prev[pid] || []), { profile_id: pid, subject, is_active: true }],
      }));
      setOk(`Guru kini bisa akses soal ${subject}.`);
    }
  }

  function barisUser(u: UserRow) {
    const active = u.is_active !== false;
    const isMe = u.id === me.id;

    return (
      <div key={u.id} className="profil-list" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div>
          <dt style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{u.full_name || '—'}</span>
            <span
              className="chip"
              style={{
                fontSize: 11,
                padding: '2px 6px',
                backgroundColor: active ? '#e6f4ea' : '#fce8e6',
                color: active ? '#137333' : '#c5221f',
              }}
            >
              {active ? 'Aktif' : 'Nonaktif'}
            </span>
          </dt>
          <dd className="mono">{u.user_id}</dd>
        </div>
        <div>
          <dt>Peran</dt>
          <dd>
            <select className="select" value={u.role} onChange={(e) => setRole(u.id, e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </dd>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {u.role === 'guru' && (
            <button
              type="button"
              className="btn-ghost btn"
              style={{ maxWidth: 130, fontSize: 13 }}
              onClick={() => setManageTs(manageTs === u.id ? null : u.id)}
            >
              {manageTs === u.id ? 'Tutup mapel' : 'Kelola Mapel'}
            </button>
          )}
          <button
            type="button"
            className="btn-ghost btn"
            disabled={isMe}
            style={{ maxWidth: 130, fontSize: 13, color: active ? 'var(--danger)' : 'var(--success)' }}
            onClick={() => void toggleActiveUser(u.id, active)}
          >
            {active ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
          <button type="button" className="btn-ghost btn" style={{ maxWidth: 130, fontSize: 13 }} onClick={() => hapusUser(u.id)}>
            Hapus
          </button>
        </div>
       {manageTs === u.id && u.role === 'guru' && (
          <div style={{ marginTop: 10, marginBottom: 8, padding: '8px 0 0', borderBottom: '1px solid var(--card-border)' }}>
            <span className="type-lab" style={{ fontSize: 11, marginBottom: 6, display: 'block' }}>Mata pelajaran yang diajarkan:</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {mapelList
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }))
                .map((m) => {
                  const assigned = isSubjectAssigned(u.id, m.name);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="chip-pick"
                      style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        backgroundColor: assigned ? 'var(--accent-soft)' : 'rgba(255,255,255,0.04)',
                        color: assigned ? 'var(--accent)' : 'var(--muted)',
                        cursor: 'pointer',
                      }}
                      onClick={() => void toggleSubject(u.id, m.name, assigned)}
                    >
                      {assigned ? '✓ ' : ''}{m.name}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    );
  }

  function collapsibleSub(label: string, count: number, open: boolean, onClick: () => void) {
    return (
      <button type="button" className="collapsible-subheader" onClick={onClick}>
        <h4 className="collapsible-subtitle">{label}</h4>
        <span className="collapsible-toggle" style={{ color: 'var(--muted)' }}>
          {count} · {open ? '▲' : '▼'}
        </span>
      </button>
    );
  }

  useEffect(() => {
    void load();
    void loadTs();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setOk('');
    if (!newEmail.trim() || newPassword.length < 8) {
      setErr('Isi email dan password minimal 8 karakter. Siswa tidak perlu daftar sendiri.');
      return;
    }
    const created = await adminCreateAuthUser({
      email: newEmail,
      password: newPassword,
      name: newName || newEmail,
    });
    if ('error' in created) {
      setErr('Gagal buat akun login: ' + summarizeAuthError(created.error));
      return;
    }
    const { data: prof, error } = await insforge.database
      .from('profiles')
      .insert({
        user_id: created.id,
        full_name: newName.trim() || newEmail.trim(),
        role: newRole,
        school_id: me.school_id,
        jenjang: newJenjang,
      })
      .select('id');
    if (error) {
      setErr('Akun login terbuat, profil gagal: ' + error.message + ' · Auth id: ' + created.id);
      return;
    }
    const pid = (prof?.[0] as { id?: string } | undefined)?.id;
    if (newClass && pid) {
      const add = await assignSiswaKeKelas(pid, newClass);
      if (add.error) setErr('Profil OK, masuk kelas gagal: ' + add.error.message);
    }
    setOk(`Siswa siap masuk dengan ${newEmail} / password yang Anda set. Tidak perlu Daftar.`);
    setNewEmail('');
    setNewName('');
    await load({ keepMessages: true });
  }

  function splitCsvLine(line: string, sep: string): string[] {
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else q = !q;
      } else if (ch === sep && !q) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
    return out.map((x) => x.replace(/^"|"$/g, ''));
  }

  function normHead(h: string) {
    return h
      .toLowerCase()
      .replace(/^\uFEFF/, '')
      .replace(/["']/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  function pickCol(head: string[], cells: string[], names: string[]) {
    for (const n of names) {
      const i = head.indexOf(n);
      if (i >= 0 && cells[i]) return cells[i];
    }
    return '';
  }

  function parseCsv(text: string): { error: string; rows: CsvRow[] } {
    const raw = text.replace(/^\uFEFF/, '');
    if (raw.startsWith('PK') || raw.includes('\u0000')) {
      return {
        error: 'File ini Excel (.xlsx), bukan CSV. Di Excel: File → Simpan sebagai → CSV UTF-8 (Comma delimited).',
        rows: [],
      };
    }
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return { error: 'CSV kurang dari 2 baris (header + data).', rows: [] };
    const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    const head = splitCsvLine(lines[0], sep).map(normHead);
    const emailAliases = ['email', 'e-mail', 'mail', 'alamat_email', 'surel'];
    const hasEmailHead = head.some((h) => emailAliases.includes(h));
    const rows = lines.slice(1).map((line) => {
      const c = splitCsvLine(line, sep);
      let email = pickCol(head, c, emailAliases);
      if (!email) {
        const found = c.find((x) => x.includes('@'));
        if (found) email = found;
      }
      let role = (pickCol(head, c, ['role', 'peran', 'jabatan']) || 'siswa').toLowerCase();
      if (role === 'orangtua' || role === 'ortu' || role === 'wali') role = 'orang_tua';
      if (role === 'kepala_sekolah' || role === 'kepala') role = 'kepsek';
      if (role === 'teacher') role = 'guru';
      if (role === 'student' || role === 'murid') role = 'siswa';
      let jenjang = (pickCol(head, c, ['jenjang', 'tingkat']) || 'smp').toLowerCase();
      if (jenjang.includes('sd')) jenjang = 'sd';
      else if (jenjang.includes('smk')) jenjang = 'smk';
      else if (jenjang.includes('sma') || jenjang.includes('ma')) jenjang = 'sma';
      else if (jenjang.includes('smp') || jenjang.includes('mts')) jenjang = 'smp';
      return {
        email: email.trim(),
        password: pickCol(head, c, ['password', 'sandi', 'kata_sandi']) || 'Siswa1234',
        nama: pickCol(head, c, ['nama', 'name', 'nama_lengkap', 'full_name']) || '',
        role: (['siswa', 'orang_tua', 'guru', 'admin', 'kepsek'] as string[]).includes(role) ? role : 'siswa',
        jenjang,
        kode_kelas: pickCol(head, c, ['kode_kelas', 'kelas', 'kode', 'invite_code', 'kodekelas']),
      };
    });
    if (!hasEmailHead && !rows.some((r) => r.email.includes('@'))) {
      return {
        error:
          'Kolom email tidak ketemu. Header baris 1 harus: email,password,nama,role,jenjang,kode_kelas. Header Anda: ' +
          head.join(' | '),
        rows: [],
      };
    }
    return { error: '', rows };
  }

  async function buatSatu(row: CsvRow) {
    const created = await adminCreateAuthUser({
      email: row.email,
      password: row.password || 'Siswa1234',
      name: row.nama || row.email,
    });
    if ('error' in created) return `Auth ${row.email}: ${summarizeAuthError(created.error)}`;
    const existing = await insforge.database.from('profiles').select('id').eq('user_id', created.id);
    const already = (existing.data || []) as { id: string }[];
    if (already[0]?.id) {
      const pid = already[0].id;
      if (row.kode_kelas) {
        const cls = cariKelasByKode(classes, row.kode_kelas);
        if (!cls) return `Kelas ${row.email}: kode_kelas "${row.kode_kelas}" tidak ketemu`;
        const add = await assignSiswaKeKelas(pid, cls.id);
        if (add.error) return `Kelas ${row.email}: ${add.error.message}`;
      }
      return null;
    }
    const { data: prof, error } = await insforge.database
      .from('profiles')
      .insert({
        user_id: created.id,
        full_name: row.nama || row.email,
        role: row.role || 'siswa',
        school_id: me.school_id,
        jenjang: row.jenjang || 'smp',
      })
      .select('id');
    if (error) return `Profil ${row.email}: ${error.message}`;
    const pid = (prof?.[0] as { id?: string } | undefined)?.id;
    if (row.kode_kelas && pid) {
      const cls = cariKelasByKode(classes, row.kode_kelas);
      if (!cls) return `Kelas ${row.email}: kode_kelas "${row.kode_kelas}" tidak ketemu`;
      const add = await assignSiswaKeKelas(pid, cls.id);
      if (add.error) return `Kelas ${row.email}: ${add.error.message}`;
    }
    return null;
  }

  async function importCsv(e: React.FormEvent) {
    e.preventDefault();
    if (!csvFile) {
      setErr('Pilih file CSV dulu, lalu klik Submit import.');
      return;
    }
    setErr('');
    setOk('Mengimpor…');
    if (/\.xlsx?$/i.test(csvFile.name) && !/\.csv$/i.test(csvFile.name)) {
      setErr('Jangan unggah .xlsx. Di Excel: File → Simpan sebagai → CSV UTF-8, lalu import file .csv itu.');
      setOk('');
      return;
    }
    const text = await csvFile.text();
    const parsed = parseCsv(text);
    if (parsed.error) {
      setErr(parsed.error);
      setOk('');
      return;
    }
    const rows = parsed.rows;
    if (rows.length === 0) {
      setErr('CSV kosong atau header salah. Wajib kolom email.');
      setOk('');
      return;
    }
    const gagal: string[] = [];
    let okN = 0;
    for (const row of rows) {
      if (!row.email.includes('@')) {
        gagal.push('Baris tanpa email (isi kolom email)');
        continue;
      }
      if (row.password.length < 8) {
        gagal.push(`${row.email}: password min 8 karakter`);
        continue;
      }
      const fail = await buatSatu(row);
      if (fail) gagal.push(fail);
      else okN += 1;
    }
    setOk(`Import selesai: ${okN} berhasil` + (gagal.length ? `, ${gagal.length} gagal.` : '.'));
    if (gagal.length) {
      const counts = new Map<string, number>();
      for (const g of gagal) {
        const key = g.replace(/Auth [^:]+: /, 'Auth: ').replace(/\S+@\S+/g, '(email)');
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const ringkas = [...counts.entries()].map(([k, n]) => `${n}× ${k}`).join('\n');
      setErr(ringkas + '\n\nContoh:\n' + gagal.slice(0, 6).join('\n'));
    }
    await load({ keepMessages: true });
  }

  async function setRole(id: string, role: string) {
    setErr('');
    const { error } = await insforge.database.from('profiles').update({ role }).eq('id', id);
    if (error) setErr(error.message);
    else {
      setOk('Peran diubah.');
      await load({ keepMessages: true });
    }
  }

  async function hapusUser(id: string) {
    if (!confirm('Hapus profil ini? Akun Auth tidak terhapus.')) return;
    const { error } = await insforge.database.from('profiles').delete().eq('id', id);
    if (error) setErr(error.message);
    else {
      setOk('Profil dihapus.');
      await load({ keepMessages: true });
    }
  }

  async function buatAssignment(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!asgPkg || !asgClass) {
      setErr('Pilih paket dan kelas. Jika kosong, buat soal/paket atau kelas dulu.');
      return;
    }
    const { error } = await insforge.database.from('assignments').insert({
      package_id: asgPkg,
      class_id: asgClass,
      due_at: asgDue ? new Date(asgDue).toISOString() : null,
    });
    if (error) setErr(error.message);
    else {
      setOk('Assignment tersimpan.');
      await load({ keepMessages: true });
    }
  }

  async function hapusAsg(id: string) {
    const { error } = await insforge.database.from('assignments').delete().eq('id', id);
    if (error) setErr(error.message);
    else await load();
  }

  if (!['admin', 'kepsek'].includes(me.role)) {
    return (
      <div className="page">
        <div className="form-card">
          <h2 className="card-title">Admin</h2>
          <p className="card-subtitle">Hanya admin / kepsek.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Admin</h1>
        <p className="page-subtitle">Kelola pengguna, kelas, paket, dan assignment di satu tempat.</p>
      </header>

      {err && (
        <div className="banner banner-danger" style={{ marginBottom: 20, whiteSpace: 'pre-wrap' }}>
          <p className="banner-text">{err}</p>
        </div>
      )}
      {ok && (
        <div className="banner banner-ok" style={{ marginBottom: 20 }}>
          <p className="banner-text">{ok}</p>
        </div>
      )}

      <form onSubmit={importCsv} className="form-container">
        <div className="form-card">
          <header className="card-header">
            <h2 className="card-title">Import CSV</h2>
            <p className="card-subtitle">
              Wajib file <b>.csv</b>. Email yang sudah di Auth akan ditautkan (bukan dibuat ulang) jika password CSV sama,
              atau jika daftar user Auth bisa dibaca. Auto-confirm email diatur di dashboard InsForge, bukan di tombol import.
            </p>
          </header>

          <div className="form-section">
            <div className="form-section-title">File CSV <span className="req"></span></div>
            <input type="file" id="csv-file" className="input" accept=".csv,text/csv,.txt" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
          </div>

          {csvFile && <p className="type-lab">Dipilih: {csvFile.name}</p>}

          <div className="form-section">
            <a href="/contoh-import-user.csv" download>
              Unduh contoh CSV
            </a>
          </div>

          <div className="actions">
            <button className="btn btn-primary" type="submit" disabled={!csvFile}>
              Submit import
            </button>
          </div>
        </div>
      </form>

      <form onSubmit={createUser} className="form-container" style={{ marginTop: 24 }}>
        <div className="form-card">
          <header className="card-header">
            <h2 className="card-title">Buat user (tanpa Daftar)</h2>
            <p className="card-subtitle">Siswa langsung masuk dengan email/password yang Anda isi.</p>
          </header>

          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <div className="form-section-title">Email <span className="req"></span></div>
                <input
                  className="input"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  placeholder="contoh@email.com"
                />
              </div>
              <div className="form-group">
                <div className="form-section-title">Password sementera <span className="req"></span></div>
                <input
                  className="input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  placeholder="Minimal 8 karakter"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Nama</div>
            <input
              className="input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Opsional — default ke email"
            />
          </div>

          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <div className="form-section-title">Peran</div>
                <select className="select" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <div className="form-section-title">Jenjang</div>
                <select className="select" value={newJenjang} onChange={(e) => setNewJenjang(e.target.value)}>
                  {JENJANG_OPTS.map((j) => (
                    <option key={j} value={j}>
                      {j.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title">Masukkan ke kelas (opsional)</div>
            <select className="select" value={newClass} onChange={(e) => setNewClass(e.target.value)}>
              <option value="">— belum —</option>
              {[...classes]
                .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="actions">
            <button className="btn btn-primary" type="submit">
              Buat akun + profil
            </button>
          </div>
        </div>
      </form>

      <div className="collapsible-section" style={{ marginTop: 24 }}>
        <button type="button" className="collapsible-header" onClick={() => setOpenUsers((v) => !v)} aria-expanded={openUsers}>
          <h2 className="collapsible-title" style={{ margin: 0 }}>
            User & peran ({users.length})
          </h2>
          <span className="collapsible-toggle">{openUsers ? '▲' : '▼'}</span>
        </button>
        {openUsers && (
          <div className="collapsible-content">
            <p className="type-lab">Per peran (dilipat). Siswa dikelompokkan per kelas.</p>
            {ROLES.map((role) => {
              const grup = users.filter((u) => u.role === role).sort(urutNama);
              const buka = !!openRole[role];
              const label = role === 'orang_tua' ? 'Orang tua' : role.charAt(0).toUpperCase() + role.slice(1);
              return (
                <div key={role} className="collapsible-subsection">
                  {collapsibleSub(label, grup.length, buka, () => setOpenRole((m) => ({ ...m, [role]: !m[role] })))}
                  {buka && role !== 'siswa' && grup.length === 0 && <p className="type-lab">Belum ada.</p>}
                  {buka && role !== 'siswa' && grup.map((u) => barisUser(u))}
                  {buka && role === 'siswa' && (
                    <>
                      {sortClassesByName(classes)
                        .map((kl) => {
                          const ids = new Set(anggota.filter((x) => x.class_id === kl.id).map((x) => x.profile_id));
                          const isi = grup.filter((u) => ids.has(u.id)).sort(urutNama);
                          const bk = !!openKelas[kl.id];
                          return (
                            <div key={kl.id} className="collapsible-subsection">
                              {collapsibleSub(
                                `${kl.name}${kl.invite_code ? ` · ${kl.invite_code}` : ''}`,
                                isi.length,
                                bk,
                                () => setOpenKelas((m) => ({ ...m, [kl.id]: !m[kl.id] })),
                              )}
                              {bk && isi.length === 0 && <p className="type-lab">Belum ada siswa di kelas ini.</p>}
                              {bk && isi.map((u) => barisUser(u))}
                            </div>
                          );
                        })}
                      {(() => {
                        const ada = new Set(anggota.map((x) => x.profile_id));
                        const tanpa = grup.filter((u) => !ada.has(u.id)).sort(urutNama);
                        const bk = !!openKelas['__tanpa'];
                        return (
                          <div className="collapsible-subsection">
                            {collapsibleSub('Belum masuk kelas', tanpa.length, bk, () =>
                              setOpenKelas((m) => ({ ...m, __tanpa: !m.__tanpa })),
                            )}
                            {bk && tanpa.length === 0 && <p className="type-lab">Semua siswa sudah di kelas.</p>}
                            {bk && tanpa.map((u) => barisUser(u))}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="collapsible-section" style={{ marginTop: 24 }}>
        <button type="button" className="collapsible-header" onClick={() => setOpenTs((v) => !v)} aria-expanded={openTs}>
          <h2 className="collapsible-title" style={{ margin: 0 }}>
            Mapel Guru
          </h2>
          <span className="collapsible-toggle">{openTs ? '▲' : '▼'}</span>
        </button>
        {openTs && (
          <div className="collapsible-content">
            <p className="type-lab">Tetapkan mata pelajaran yang diajarkan oleh setiap guru. Guru hanya bisa membuat/mengelola soal untuk mapel yang diassign di sini.</p>

            {users.filter((u) => u.role === 'guru').length === 0 && (
              <p className="type-lab">Belum ada guru di sekolah ini.</p>
            )}

            {users.filter((u) => u.role === 'guru').length > 0 && mapelList.length === 0 && (
              <p className="type-lab">Belum ada mapel di sekolah. Tambahkan melalui menu Kelas → Kurikulum.</p>
            )}

            {users.filter((u) => u.role === 'guru').length > 0 && mapelList.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Guru</th>
                      {mapelList
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }))
                        .map((m) => (
                          <th key={m.id} style={{ fontSize: 11, padding: '6px 8px' }}>{m.name}</th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter((u) => u.role === 'guru')
                      .sort(urutNama)
                      .map((u) =>
                        u.role === 'guru' ? (
                          <tr key={u.id}>
                            <td style={{ fontSize: 13, fontWeight: 600 }}>{u.full_name || '—'}</td>
                            {mapelList
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }))
                              .map((m) => {
                                const assigned = !!tsMap[u.id]?.some((r) => r.subject === m.name && r.is_active);
                                return (
                                  <td key={m.id} style={{ textAlign: 'center', padding: '4px 6px' }}>
                                    <button
                                      type="button"
                                      className="btn-ghost btn"
                                      style={{
                                        fontSize: 10,
                                        padding: '2px 6px',
                                        backgroundColor: assigned ? 'var(--accent-soft)' : undefined,
                                        color: assigned ? 'var(--accent)' : undefined,
                                      }}
                                      onClick={() => void toggleSubject(u.id, m.name, assigned)}
                                    >
                                      {assigned ? '✓' : '+'}
                                    </button>
                                  </td>
                                );
                              })}
                          </tr>
                        ) : null
                      )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="collapsible-section" style={{ marginTop: 24 }}>
        <button type="button" className="collapsible-header" onClick={() => setOpenAsg((v) => !v)} aria-expanded={openAsg}>
          <h2 className="collapsible-title" style={{ margin: 0 }}>
            Assignment ({asgs.length})
          </h2>
          <span className="collapsible-toggle">{openAsg ? '▲' : '▼'}</span>
        </button>
        {openAsg && (
          <div className="collapsible-content">
            <p className="type-lab">Tugaskan paket ke kelas yang sudah ada. Buat kelas di menu Kelas; buat paket di menu Paket.</p>

            <form onSubmit={buatAssignment} className="form-container">
              <div className="form-section">
                <div className="form-row">
                  <div className="form-group">
                    <div className="form-section-title">Paket</div>
                    <select className="select" value={asgPkg} onChange={(e) => setAsgPkg(e.target.value)}>
                      <option value="">— pilih —</option>
                      {pkgs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.mapel})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <div className="form-section-title">Kelas</div>
                    <select className="select" value={asgClass} onChange={(e) => setAsgClass(e.target.value)}>
                      <option value="">— pilih —</option>
                      {[...classes]
                        .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' }))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="form-section-title">Tenggat (opsional)</div>
                <input
                  className="input"
                  type="datetime-local"
                  value={asgDue}
                  onChange={(e) => setAsgDue(e.target.value)}
                />
              </div>

              <div className="actions">
                <button className="btn btn-primary" type="submit">
                  Simpan assignment
                </button>
              </div>
            </form>

            {pkgs.length === 0 && <p className="type-lab">Belum ada paket. Guru perlu merakit paket atau isi tabel packages.</p>}
            {asgs.length === 0 ? (
              <p className="type-lab" style={{ marginTop: 12 }}>Belum ada assignment.</p>
            ) : (
              <table className="table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Paket</th>
                    <th>Kelas</th>
                    <th>Tenggat</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {asgs.map((a) => (
                    <tr key={a.id}>
                      <td>{a.package_id.slice(0, 8)}…</td>
                      <td>{a.class_id.slice(0, 8)}…</td>
                      <td className="muted">{a.due_at ? new Date(a.due_at).toLocaleString('id-ID') : '—'}</td>
                      <td>
                        <button type="button" className="link" style={{ fontSize: 12 }} onClick={() => hapusAsg(a.id)}>
                          hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <DirectoryGalleryAdmin me={me} />
    </div>
  );
}
