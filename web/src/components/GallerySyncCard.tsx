import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Gallery, type SyncStatus } from '../lib/Gallery';

const POLL_MS = 3000;

function fmtLastSync(ts: number): string {
  if (!ts) return 'Belum pernah';
  return new Date(ts).toLocaleString('id-ID');
}

/**
 * GallerySyncCard
 *
 * UI siswa untuk sinkronisasi galeri HP ke bucket InsForge 'gallery'
 * (backend: GallerySyncWorker di aplikasi Android). Hanya relevan di
 * perangkat Android (Capacitor native); di web/desktop hanya menampilkan
 * catatan. Status di-poll setiap POLL_MS agar progress live.
 */
export function GallerySyncCard() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await Gallery.getSyncStatus();
      setStatus(s);
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  if (!Capacitor.isNativePlatform()) {
    return (
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 8 }}>Sinkronisasi Galeri</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
          Fitur ini berjalan di aplikasi Android. Buka SMART-TKA di HP Android untuk mengaktifkan sinkronisasi foto.
        </p>
      </div>
    );
  }

  const enabled = status?.enabled ?? false;
  const isRunning = status?.isRunning ?? false;
  const total = status?.total ?? 0;
  const uploaded = status?.uploaded ?? 0;
  const failed = status?.failed ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((uploaded / total) * 100)) : 0;

  async function toggle() {
    setBusy(true);
    setErr('');
    try {
      if (enabled) {
        await Gallery.stopSync();
      } else {
        await Gallery.startSync({ wifiOnly: status?.wifiOnly ?? false });
      }
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function setWifiOnly(v: boolean) {
    setBusy(true);
    setErr('');
    try {
      await Gallery.startSync({ wifiOnly: v });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 8 }}>Sinkronisasi Galeri</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Foto di galeri HP ini diunggah ke cloud agar bisa dilihat admin sekolah. Progress tersimpan otomatis.
      </p>

      {!status?.configured && (
        <div className="banner warn" style={{ marginBottom: 12 }}>
          <p className="banner-text">Sinkronisasi belum dikonfigurasi di aplikasi ini. Hubungi admin sekolah.</p>
        </div>
      )}

      {status?.permDenied && (
        <div className="banner warn" style={{ marginBottom: 12 }}>
          <p className="banner-text">Akses galeri ditolak. Buka Settings → Apps → Smart TKA → Permissions → Photos → Allow.</p>
        </div>
      )}

      {err && (
        <div className="banner danger" style={{ marginBottom: 12 }}>
          <p className="banner-text">{err}</p>
        </div>
      )}

      {status && (
        <>
          <p style={{ fontSize: 13, margin: '0 0 8px' }}>
            Status: <strong>{isRunning ? 'Sinkronisasi berjalan...' : enabled ? 'Aktif' : 'Nonaktif'}</strong>
          </p>

          {total > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                <span>{uploaded} / {total} foto</span>
                <span>{failed > 0 ? `${failed} gagal` : `${pct}%`}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--canvas)', overflow: 'hidden' }}>
                <div
                  style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width .3s' }}
                />
              </div>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={status.wifiOnly}
              disabled={busy || !status.configured || !enabled}
              onChange={(e) => void setWifiOnly(e.target.checked)}
            />
            <span>Hanya saat WiFi (hemat kuota)</span>
          </label>

          <button
            className={enabled ? 'btn btn-danger' : 'btn btn-primary'}
            type="button"
            disabled={busy || !status.configured}
            onClick={() => void toggle()}
            style={{ maxWidth: 240 }}
          >
            {busy ? 'Memproses...' : enabled ? 'Nonaktifkan Sinkronisasi' : 'Aktifkan Sinkronisasi'}
          </button>

          <p className="legal" style={{ marginTop: 10 }}>
            Terakhir sinkron: {fmtLastSync(status.lastSync)}
          </p>
        </>
      )}
    </div>
  );
}
