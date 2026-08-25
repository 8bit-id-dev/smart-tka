import { useCallback, useEffect, useMemo, useState } from 'react';
import { listGalleryPhotos, getPhotoUrls, GALLERY_BUCKET, type GalleryPhoto, type GalleryFileType } from '../lib/galleryCloud';
import type { AppProfile } from '../lib/insforge';
import { FilterSelect } from './FilterSelect';

const URL_CHUNK = 100;

function dateNum(ts: string | null): number {
  if (!ts) return 0;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : 0;
}

function monthKey(ts: string | null): string {
  if (!ts) return 'Tanpa tanggal';
  const d = new Date(dateNum(ts));
  return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

function fmtDate(ts: string | null): string {
  if (!ts) return '—';
  return new Date(dateNum(ts)).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

async function downloadPhoto(url: string, name: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  } catch {
    /* abaikan error download */
  }
}

function GalleryLightbox({
  photos,
  index,
  urls,
  onClose,
  onNav,
}: {
  photos: GalleryPhoto[];
  index: number;
  urls: Map<string, string>;
  onClose: () => void;
  onNav: (i: number) => void;
}) {
  const photo = photos[index];
  const src = urls.get(photo.key);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onNav(index - 1);
      if (e.key === 'ArrowRight' && index < photos.length - 1) onNav(index + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onNav, index, photos.length]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div style={{ maxWidth: '95vw', maxHeight: '95vh', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        {src && photo.type === 'image' ? (
          <img
            src={src}
            alt={photo.name}
            style={{ maxWidth: '100%', maxHeight: '82vh', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
          />
        ) : src && photo.type === 'video' ? (
          <video
            src={src}
            controls
            autoPlay
            style={{ maxWidth: '100%', maxHeight: '82vh', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
          />
        ) : src ? (
          <div
            style={{
              minWidth: 260,
              minHeight: 180,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              padding: 24,
            }}
          >
            <span style={{ fontSize: 40 }}>📄</span>
            <span style={{ color: '#fff', fontWeight: 600, wordBreak: 'break-all' }}>{photo.name}</span>
            <span style={{ color: '#aaa', fontSize: 12 }}>{fmtSize(photo.size)}</span>
          </div>
        ) : (
          <p style={{ color: '#999' }}>Memuat berkas...</p>
        )}
        <div style={{ marginTop: 10, color: '#aaa', fontSize: 12 }}>
          <span style={{ color: '#fff', fontWeight: 500 }}>{photo.name}</span>
          {' · '}
          {fmtDate(photo.uploadedAt)}
          {' · '}
          {fmtSize(photo.size)}
          {' · device '}
          {photo.device}
        </div>
        <div className="actions" style={{ justifyContent: 'center' }}>
          {src && (
            <button className="btn btn-ghost" type="button" style={{ color: '#fff' }} onClick={() => void downloadPhoto(src, photo.name)}>
              Unduh
            </button>
          )}
          <button className="btn btn-ghost" type="button" style={{ color: '#fff' }} onClick={onClose}>
            Tutup
          </button>
        </div>
        {index > 0 && (
          <button
            type="button"
            style={{
              position: 'fixed',
              left: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid #333',
              borderRadius: '50%',
              width: 44,
              height: 44,
              color: '#fff',
              fontSize: 20,
              cursor: 'pointer',
            }}
            onClick={() => onNav(index - 1)}
          >
            ‹
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            type="button"
            style={{
              position: 'fixed',
              right: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid #333',
              borderRadius: '50%',
              width: 44,
              height: 44,
              color: '#fff',
              fontSize: 20,
              cursor: 'pointer',
            }}
            onClick={() => onNav(index + 1)}
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * GalleryCloudViewer
 *
 * Melihat foto yang disinkronkan dari HP siswa ke bucket InsForge 'gallery'
 * (hasil kerja GallerySyncWorker di aplikasi Android). Hanya untuk admin/kepsek.
 *
 * Akses mengikuti RLS storage.objects: listing + signed URL dilakukan lewat
 * SDK dengan JWT user yang login — tidak ada token manual / token write di web.
 */
export function GalleryCloudViewer({ me }: { me: AppProfile }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [device, setDevice] = useState('');
  const [search, setSearch] = useState('');
  const [fileType, setFileType] = useState<GalleryFileType | ''>('');
  const [sortKey, setSortKey] = useState<'date' | 'name' | 'size'>('date');
  const [sortDesc, setSortDesc] = useState(true);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [lightbox, setLightbox] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    const res = await listGalleryPhotos();
    if (res.error) {
      setErr(res.error);
      setPhotos([]);
    } else {
      setPhotos(res.photos);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const devices = useMemo(
    () => [...new Set(photos.map((p) => p.device))].sort((a, b) => a.localeCompare(b, 'id')),
    [photos],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = photos.filter(
      (p) =>
        (!device || p.device === device) &&
        (!fileType || p.type === fileType) &&
        (!q || p.name.toLowerCase().includes(q) || p.device.toLowerCase().includes(q)),
    );
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name, 'id', { numeric: true, sensitivity: 'base' });
      else if (sortKey === 'size') cmp = a.size - b.size;
      else cmp = dateNum(a.uploadedAt) - dateNum(b.uploadedAt);
      return sortDesc ? -cmp : cmp;
    });
    return list;
  }, [photos, device, search, fileType, sortKey, sortDesc]);

  // Signed URL untuk foto yang tampil (chunk per 100, cache di lib)
  useEffect(() => {
    let cancelled = false;
    const keys = filtered.map((p) => p.key);
    if (keys.length === 0) {
      setUrls(new Map());
      return;
    }
    (async () => {
      const map = new Map<string, string>();
      for (let i = 0; i < keys.length; i += URL_CHUNK) {
        const chunk = keys.slice(i, i + URL_CHUNK);
        const res = await getPhotoUrls(chunk);
        if (res.error && !cancelled) setErr(res.error);
        if (cancelled) return;
        for (const [k, u] of res.urls) map.set(k, u);
      }
      if (!cancelled) setUrls(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [filtered]);

  // Kelompokkan per bulan, urut dari bulan terbaru
  const groups = useMemo(() => {
    const g = new Map<string, GalleryPhoto[]>();
    for (const p of filtered) {
      const k = monthKey(p.uploadedAt);
      const arr = g.get(k);
      if (arr) arr.push(p);
      else g.set(k, [p]);
    }
    return [...g.entries()].sort((a, b) => dateNum(b[1][0].uploadedAt) - dateNum(a[1][0].uploadedAt));
  }, [filtered]);

  if (me.role !== 'admin') {
    return (
      <div className="page">
        <div className="form-card">
          <h2 className="card-title">Galeri Cloud</h2>
          <p className="card-subtitle">Hanya admin / kepsek.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="collapsible-section" style={{ marginTop: 24 }}>
      <header className="card-header">
        <h2 className="card-title">Galeri Cloud</h2>
        <p className="card-subtitle">
          Berkas yang tersinkron dari HP siswa ke bucket "{GALLERY_BUCKET}". Gunakan filter untuk mempersempit.
        </p>
      </header>

      {err && (
        <div className="banner banner-danger" style={{ marginBottom: 12 }}>
          <p className="banner-text">{err}</p>
        </div>
      )}

      {loading ? (
        <p className="type-lab">Memuat foto dari cloud...</p>
      ) : (
        <>
          {photos.length === 0 && (
            <p className="type-lab" style={{ marginBottom: 12 }}>
              Belum ada berkas di bucket ini. Pastikan sync di HP siswa aktif dan bucket "{GALLERY_BUCKET}" sudah dibuat.
            </p>
          )}

          {photos.length > 0 && (
            <div className="form-section" style={{ marginBottom: 12 }}>
              <div className="form-section-title">Cari</div>
              <input
                className="input"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama foto atau device..."
                style={{ maxWidth: 360 }}
              />
            </div>
          )}

          {devices.length > 1 && (
            <div className="form-section" style={{ marginBottom: 12 }}>
              <div className="form-section-title">Device</div>
              <div className="chip-pick-row">
                <button
                  type="button"
                  className={device === '' ? 'chip-pick on' : 'chip-pick'}
                  onClick={() => setDevice('')}
                >
                  Semua ({photos.length})
                </button>
                {devices.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={device === d ? 'chip-pick on' : 'chip-pick'}
                    onClick={() => setDevice(d)}
                  >
                    {d} ({photos.filter((p) => p.device === d).length})
                  </button>
                ))}
              </div>
            </div>
          )}

          {photos.some((p) => p.type !== 'image') && (
            <div className="form-section" style={{ marginBottom: 12 }}>
              <div className="form-section-title">Jenis</div>
              <div className="chip-pick-row">
                <button
                  type="button"
                  className={fileType === '' ? 'chip-pick on' : 'chip-pick'}
                  onClick={() => setFileType('')}
                >
                  Semua ({photos.length})
                </button>
                {(['image', 'video', 'document'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={fileType === t ? 'chip-pick on' : 'chip-pick'}
                    onClick={() => setFileType(t)}
                  >
                    {t === 'image' ? 'Gambar' : t === 'video' ? 'Video' : 'Dokumen'} (
                    {photos.filter((p) => p.type === t).length})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="actions" style={{ marginBottom: 12 }}>
            <button className="btn btn-primary" type="button" onClick={() => void load()}>
              ↻ Refresh
            </button>
            <FilterSelect
              value={sortKey}
              onChange={(v) => setSortKey(v as 'date' | 'name' | 'size')}
              placeholder="Urutkan"
              minWidth={110}
              options={[
                { value: 'date', label: 'Tanggal' },
                { value: 'name', label: 'Nama' },
                { value: 'size', label: 'Ukuran' },
              ]}
            />
            <button className="btn btn-ghost" type="button" onClick={() => setSortDesc((v) => !v)}>
              {sortDesc ? '↓ Turun' : '↑ Naik'}
            </button>
            <span className="type-lab" style={{ alignSelf: 'center' }}>
              {filtered.length} berkas
            </span>
          </div>

          {filtered.length === 0 && photos.length > 0 && (
            <p className="type-lab">Tidak ada foto yang cocok dengan filter.</p>
          )}

          {groups.map(([month, list]) => (
            <div key={month} style={{ marginBottom: 24 }}>
              <p className="type-lab" style={{ marginBottom: 8 }}>
                {month} — {list.length} foto
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: 8,
                }}
              >
                {list.map((p) => {
                  const src = urls.get(p.key);
                  const idx = filtered.findIndex((x) => x.key === p.key);
                  return (
                    <div
                      key={p.key}
                      style={{
                        aspectRatio: '1',
                        overflow: 'hidden',
                        borderRadius: 8,
                        cursor: src ? 'pointer' : 'default',
                        border: '1px solid var(--card-border)',
                        background: 'var(--canvas)',
                        position: 'relative',
                      }}
                      onClick={() => src && setLightbox(idx)}
                      title={p.name}
                    >
                      {src && p.type === 'image' ? (
                        <img
                          src={src}
                          alt={p.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          loading="lazy"
                        />
                      ) : src && p.type === 'video' ? (
                        <video
                          src={src}
                          muted
                          playsInline
                          preload="metadata"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : src ? (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            background: 'var(--accent-soft)',
                          }}
                        >
                          <span style={{ fontSize: 24 }}>📄</span>
                          <span style={{ fontSize: 9, color: 'var(--accent)', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fmtSize(p.size)}
                          </span>
                        </div>
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            color: 'var(--muted)',
                            padding: 8,
                            textAlign: 'center',
                            wordBreak: 'break-all',
                          }}
                        >
                          {p.name}
                        </div>
                      )}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                          color: '#fff',
                          fontSize: 10,
                          padding: '14px 6px 4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {lightbox !== null && filtered[lightbox] && (
        <GalleryLightbox
          photos={filtered}
          index={lightbox}
          urls={urls}
          onClose={() => setLightbox(null)}
          onNav={(i) => setLightbox(i)}
        />
      )}
    </div>
  );
}