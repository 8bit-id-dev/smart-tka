import { useEffect, useState } from 'react';
import { Gallery, type DirectoryPickerResult, type FileItem } from '../lib/Gallery';
import type { AppProfile } from '../lib/insforge';

type MimeFilter = 'all' | 'image' | 'video' | 'document';

const MIME_FILTERS: Record<MimeFilter, string[]> = {
  all: [],
  image: ['image/'],
  video: ['video/'],
  document: ['application/pdf', 'text/', 'application/msword', 'application/vnd.openxmlformats-officedocument']
};

export function DirectoryGalleryAdmin({ me }: { me: AppProfile }) {
  const [dir, setDir] = useState<DirectoryPickerResult | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [perm, setPerm] = useState<{ granted: boolean; showRationale?: boolean } | null>(null);
  const [mimeFilter, setMimeFilter] = useState<MimeFilter>('all');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [recursive, setRecursive] = useState(true);

  useEffect(() => {
    void init();
  }, []);

  async function init() {
    const p = await Gallery.checkPermission();
    setPerm(p);
    if (p.granted) {
      const persisted = await Gallery.getPersistedDirectories();
      const keys = Object.keys(persisted.directories || {});
      if (keys.length > 0) {
        const last = persisted.directories[keys[keys.length - 1]];
        setDir({ treeUri: last, displayName: 'Previous directory', persisted: true });
        void loadFiles(last);
      }
    }
  }

  async function requestPerm() {
    const res = await Gallery.requestPermission();
    setPerm(res);
    if (res.granted) void init();
  }

  async function pickDir() {
    try {
      const result = await Gallery.pickDirectory();
      setDir(result);
      void loadFiles(result.treeUri);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function loadFiles(treeUri: string) {
    setLoading(true);
    setErr('');
    try {
      const res = await Gallery.listFiles({
        treeUri,
        recursive,
        maxDepth: 5,
        mimeTypes: MIME_FILTERS[mimeFilter]
      });
      const arr = Object.values(res.files || {}) as FileItem[];
      arr.sort((a, b) => (b.dateModified || '').localeCompare(a.dateModified || ''));
      setFiles(arr);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (dir?.treeUri) await loadFiles(dir.treeUri);
  }

  if (me.role !== 'admin') {
    return (
      <div className="page">
        <div className="form-card">
          <h2 className="card-title">Galeri Perangkat</h2>
          <p className="card-subtitle">Hanya admin / kepsek.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="collapsible-section" style={{ marginTop: 24 }}>
      <header className="card-header">
        <h2 className="card-title">Galeri Perangkat</h2>
        <p className="card-subtitle">Pilih folder di perangkat untuk melihat semua file di dalamnya.</p>
      </header>

      {err && (
        <div className="banner banner-danger" style={{ marginBottom: 12 }}>
          <p className="banner-text">{err}</p>
        </div>
      )}

      {!perm && <p className="type-lab">Memeriksa izin...</p>}

      {perm && !perm.granted && (
        <div className="actions" style={{ marginBottom: 12 }}>
          <button className="btn btn-primary" type="button" onClick={requestPerm}>
            Izinkan akses galeri
          </button>
          {perm.showRationale && (
            <p className="type-lab" style={{ marginTop: 10 }}>
              Android memblokir akses. Buka Settings â†’ Apps â†’ Smart TKA â†’ Permissions â†’ Photos â†’ Allow.
            </p>
          )}
        </div>
      )}

      {perm && perm.granted && (
        <>
          <div className="form-section" style={{ marginBottom: 12 }}>
            <div className="form-section-title">Filter tipe file</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['all', 'image', 'video', 'document'] as MimeFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={mimeFilter === f ? 'chip-pick on' : 'chip-pick'}
                  onClick={() => {
                    setMimeFilter(f);
                    if (dir?.treeUri) void loadFiles(dir.treeUri);
                  }}
                >
                  {f === 'all' ? 'Semua' : f === 'image' ? 'Gambar' : f === 'video' ? 'Video' : 'Dokumen'}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section" style={{ marginBottom: 12 }}>
            <div className="form-section-title">Rekursif</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={recursive}
                onChange={(e) => {
                  setRecursive(e.target.checked);
                  if (dir?.treeUri) void loadFiles(dir.treeUri);
                }}
              />
              <span className="type-lab">Scan subfolder (maks 5 level)</span>
            </label>
          </div>

          <div className="actions" style={{ marginBottom: 12 }}>
            <button className="btn btn-primary" type="button" onClick={pickDir}>
              Pilih Folder
            </button>
            {dir && (
              <button className="btn btn-ghost" type="button" onClick={refresh}>
                Refresh
              </button>
            )}
          </div>

          {dir && (
            <p className="type-lab" style={{ marginBottom: 12 }}>
              Folder: <strong>{dir.displayName}</strong> â€¢ {files.length} file
            </p>
          )}

          {loading && <p className="type-lab">Memuat file...</p>}

          {!loading && files.length === 0 && dir && (
            <p className="type-lab">Folder kosong atau tidak ada file yang cocok.</p>
          )}

          {!loading && files.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 8,
              }}
            >
              {files.map((f) => (
                <div
                  key={f.id}
                  style={{
                    aspectRatio: '1',
                    overflow: 'hidden',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: '1px solid var(--card-border)',
                    background: 'var(--canvas)',
                    position: 'relative',
                  }}
                  onClick={() => f.mimeType.startsWith('image/') && setLightbox(f.uri)}
                  title={f.name}
                >
                  {f.mimeType.startsWith('image/') ? (
                    <img
                      src={f.uri}
                      alt={f.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      loading="lazy"
                    />
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
                      {f.name}
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
                    {f.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {lightbox && (
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
          onClick={() => setLightbox(null)}
        >
          <div style={{ maxWidth: '95vw', maxHeight: '95vh', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <img
              src={lightbox}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
            />
            <button className="btn btn-ghost" style={{ marginTop: 12, color: '#fff' }} onClick={() => setLightbox(null)}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
