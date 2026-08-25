import { useEffect, useRef, useState } from 'react';
import { insforge, type AppProfile } from '../lib/insforge';
import { Icons } from '../AppShell';
import { PhotoCropModal } from '../components/PhotoCropModal';
import { GallerySyncCard } from '../components/GallerySyncCard';
import defaultPhoto from '../assets/profile.jpg';

const JENJANG_LABEL: Record<string, string> = {
  sd: 'SD kelas 6',
  smp: 'SMP kelas 9',
  sma: 'SMA kelas 12',
  smk: 'SMK',
  paket_a: 'Paket A',
  paket_b: 'Paket B',
  paket_c: 'Paket C',
};

function sixDigit() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function Profil({
  profile,
  email,
  onOut,
}: {
  profile: AppProfile;
  email: string | null;
  onOut: () => void;
}) {
  const jenjang = profile.jenjang ? JENJANG_LABEL[profile.jenjang] || profile.jenjang : 'Belum diisi';
  const [code, setCode] = useState<string | null>(null);
  const [exp, setExp] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const [ortu, setOrtu] = useState<{ parent_id: string; nama: string }[]>([]);
  const [photoUrl, setPhotoUrl] = useState(profile.photo_url || defaultPhoto);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile.role !== 'siswa') return;
    void (async () => {
      const { data } = await insforge.database
        .from('profiles')
        .select('parent_code, parent_code_exp')
        .eq('id', profile.id);
      const row = (data || [])[0] as { parent_code?: string | null; parent_code_exp?: string | null } | undefined;
      if (row?.parent_code && row.parent_code_exp && new Date(row.parent_code_exp) > new Date()) {
        setCode(row.parent_code);
        setExp(row.parent_code_exp);
      }
      const links = await insforge.database
        .from('parent_links')
        .select('parent_id, status')
        .eq('student_id', profile.id)
        .eq('status', 'accepted');
      const ids = ((links.data || []) as { parent_id: string }[]).map((r) => r.parent_id);
      if (ids.length) {
        const p = await insforge.database.from('profiles').select('id, full_name').in('id', ids);
        setOrtu(((p.data || []) as { id: string; full_name: string | null }[]).map((r) => ({ parent_id: r.id, nama: r.full_name || 'Orang tua' })));
      }
    })();
  }, [profile.id, profile.role]);

  async function buatKode() {
    setBusy(true);
    setMsg('');
    const next = sixDigit();
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await insforge.database
      .from('profiles')
      .update({ parent_code: next, parent_code_exp: until })
      .eq('id', profile.id);
    setBusy(false);
    if (error) {
      setMsg(error.message + ' — jalankan SQL 017 di SQL Studio.');
      return;
    }
    setCode(next);
    setExp(until);
   }



  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoErr('Hanya file gambar (jpg, png, gif) yang diperbolehkan.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoErr('Ukuran maksimal 2 MB.');
      return;
    }
    setPhotoErr('');
    setCropSrc(URL.createObjectURL(file));
  }

  async function uploadBlob(blob: Blob) {
    setPhotoLoading(true);
    setPhotoErr('');
    const ext = blob.type.split('/')[1] || 'jpg';
    const path = `${profile.id}.${ext}`;
    try {
      const { error, data } = await insforge.storage.from('profile-photos').upload(path, blob);
      if (error) {
        setPhotoErr(error.message);
        return;
      }
      const pubPath = (data as { path?: string })?.path || path;
      const { data: pub } = insforge.storage.from('profile-photos').getPublicUrl(pubPath);
      const url = pub?.publicUrl || '';
      setPhotoUrl(url);
      await insforge.database.from('profiles').update({ photo_url: url }).eq('id', profile.id);
    } catch (e) {
      setPhotoErr(e instanceof Error ? e.message : 'Upload gagal.');
    }
    setPhotoLoading(false);
    if (cropSrc) {
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  }

  async function deletePhoto() {
    setPhotoLoading(true);
    setPhotoErr('');
    if (!photoUrl || photoUrl === defaultPhoto) {
      setPhotoLoading(false);
      return;
    }
    try {
      const clean = photoUrl.split('?')[0];
      const fname = clean.substring(clean.lastIndexOf('/') + 1);
      await insforge.storage.from('profile-photos').remove([fname]);
    } catch {
      /* file mungkin sudah tidak ada — tetap lanjut ke foto default */
    }
    setPhotoUrl(defaultPhoto);
    const { error } = await insforge.database.from('profiles').update({ photo_url: null }).eq('id', profile.id);
    if (error) setPhotoErr(error.message);
    setPhotoLoading(false);
  }

  return (
    <div className="dashboard-page">
      <header className="page-header" style={{ marginBottom: 20 }}>
        <p className="page-subtitle">Data akun Anda</p>
        <h1 className="page-title">Profil</h1>
      </header>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Avatar + info */}
         <div className="card" style={{ textAlign: 'center', minWidth: 200, flex: '1 1 260px' }}>
              <div style={{
                width: 160, height: 160, borderRadius: '30%', aspectRatio: '1 / 1',
                background: photoUrl ? undefined : 'var(--card)', color: photoUrl ? '#fff' : 'var(--muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 44, fontWeight: 700, margin: '0 auto 16px',
                overflow: 'hidden', objectFit: 'cover',
                border: photoUrl ? '2px solid var(--accent-soft)' : '1px solid var(--card-border)',
                cursor: 'pointer', userSelect: 'none',
              }} onClick={() => setPhotoMenuOpen(true)}>
              {photoUrl ? <img src={photoUrl} alt="Foto profil" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', borderRadius: '30%' }} /> : Icons.profil(false)}
            </div>
            {photoErr && <p className="legal" style={{ color: '#f85149', marginTop: 4 }}>{photoErr}</p>}
            {photoMenuOpen && (
              <div className="photo-menu-backdrop" onClick={() => setPhotoMenuOpen(false)}>
                <div className="photo-menu" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="photo-menu-item" onClick={() => { fileInputRef.current?.click(); setPhotoMenuOpen(false); }} disabled={photoLoading}>
                    Edit Foto
                  </button>
                  {photoUrl && photoUrl !== defaultPhoto && (
                    <button type="button" className="photo-menu-item photo-menu-item-danger" onClick={() => { void deletePhoto(); setPhotoMenuOpen(false); }} disabled={photoLoading}>
                      Hapus Foto
                    </button>
                  )}
                </div>
              </div>
            )}
            <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={onPickPhoto} disabled={photoLoading} />
           <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>{profile.full_name || 'Pengguna'}</h2>
           <span className="badge badge-info" style={{ marginBottom: 16 }}>{profile.role}</span>

          <div style={{ textAlign: 'left', marginTop: 8 }}>
            <dl className="profil-list" style={{ margin: 0 }}>
             <div>
               <dt>Email</dt>
               <dd style={{ fontSize: 14 }}>
                 {email ? (() => {
                   const atIdx = email.indexOf('@');
                   return atIdx > 0 ? (
                     <>
                       <span style={{ display: 'block' }}>{email.slice(0, atIdx)}</span>
                       <span style={{ display: 'block' }}>{email.slice(atIdx)}</span>
                     </>
                   ) : (
                     email
                   );
                 })() : '—'}
               </dd>
             </div>
              <div>
                <dt>Jenjang</dt>
                <dd style={{ fontSize: 14 }}>{jenjang}</dd>
              </div>
              <div>
                <dt>ID Profil</dt>
                <dd className="mono">{profile.id}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Actions */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {profile.role === 'siswa' && (
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 8 }}>Taut Orang Tua</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                Buat kode 6 digit. Orang tua memasukkan kode ini di menu Anak. Berlaku 24 jam.
              </p>
              {code && exp && (
                <div style={{
                  background: 'var(--accent-soft)', borderRadius: 12, padding: 16,
                  textAlign: 'center', marginBottom: 12,
                }}>
                  <p style={{ fontSize: 32, fontWeight: 800, letterSpacing: '0.15em',                   color: 'var(--accent)', margin: '0 0 4px' }}>
                    {code}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
                    Kadaluarsa {new Date(exp).toLocaleString('id-ID')}
                  </p>
                </div>
              )}
              <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void buatKode()}>
                {code ? 'Buat kode baru' : 'Buat kode taut'}
              </button>
              {ortu.length > 0 && (
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>
                  Tertaut: {ortu.map((o) => o.nama).join(', ')}
                </p>
              )}
              {msg && <p className="legal" style={{ marginTop: 8 }}>{msg}</p>}
            </div>
          )}

          {profile.role === 'siswa' && <GallerySyncCard />}

          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 12 }}>Keluar</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
              Keluar dari akun Anda di perangkat ini.
            </p>
            <button className="btn btn-danger" type="button" onClick={onOut} style={{ maxWidth: 200 }}>
              Keluar (Sign Out)
            </button>
          </div>
        </div>
      </div>

      {cropSrc && (
        <PhotoCropModal
          src={cropSrc}
          onCancel={() => {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }}
          onSave={(blob) => {
            void uploadBlob(blob);
          }}
        />
      )}
    </div>
  );
}