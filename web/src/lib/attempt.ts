import { insforge } from './insforge';
import type { DbItem } from './soal';

export type StartOk = {
  ok: true;
  attempt_id: string;
  ends_at: string;
  tab_leave_count: number;
  items: DbItem[];
};

function storageKey(packageId: string) {
  return 'stka_att_' + packageId;
}

export function bacaToken(packageId: string) {
  try {
    const raw = sessionStorage.getItem(storageKey(packageId));
    if (!raw) return '';
    const j = JSON.parse(raw) as { token?: string };
    return j.token || '';
  } catch {
    return '';
  }
}

export function simpanToken(packageId: string, attemptId: string, token: string) {
  sessionStorage.setItem(storageKey(packageId), JSON.stringify({ attemptId, token }));
}

export function hapusToken(packageId: string) {
  sessionStorage.removeItem(storageKey(packageId));
}

export function tokenBaru() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 't' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function paketKetat(kind: string, discussAfter: boolean) {
  if (discussAfter) return false;
  return kind === 'simulasi' || kind === 'ujian_kelas' || kind === 'lab_25';
}

export async function attemptStart(packageId: string, token: string): Promise<StartOk | { ok: false; error: string }> {
  const { data, error } = await insforge.database.rpc('smart_attempt_start', {
    p_package_id: packageId,
    p_token: token,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes('does not exist') || error.message.includes('Could not find')
        ? 'Fungsi sesi ujian belum ada. Jalankan SQL 014_attempt_server.sql.'
        : error.message,
    };
  }
  const j = data as StartOk & { ok?: boolean; error?: string };
  if (!j || j.ok === false) return { ok: false, error: (j && j.error) || 'Gagal mulai sesi.' };
  return j;
}

export async function attemptTick(attemptId: string, token: string) {
  const { data, error } = await insforge.database.rpc('smart_attempt_tick', {
    p_attempt_id: attemptId,
    p_token: token,
  });
  if (error) return { ok: false as const, remaining_sec: 0, ended: false, error: error.message };
  return data as { ok: boolean; remaining_sec?: number; ended?: boolean; error?: string };
}

export async function attemptTab(attemptId: string, token: string, kind: string) {
  await insforge.database.rpc('smart_attempt_tab', {
    p_attempt_id: attemptId,
    p_token: token,
    p_kind: kind,
  });
}

export async function attemptSubmit(attemptId: string, token: string, answers: Record<string, string>) {
  const { data, error } = await insforge.database.rpc('smart_attempt_submit', {
    p_attempt_id: attemptId,
    p_token: token,
    p_answers: answers,
  });
  if (error) return { ok: false as const, error: error.message };
  return data as { ok: boolean; score?: number; benar?: number; total?: number; error?: string };
}
