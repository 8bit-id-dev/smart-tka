import { createClient } from '@insforge/sdk';

/** Hilangkan / di belakang dan /api di ujung — cegah Cannot GET //api/... */
function normalizeBase(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/\/+$/, '').replace(/\/api$/i, '');
}

const baseUrl = normalizeBase(import.meta.env.VITE_INSFORGE_URL as string | undefined);
const anonKey = (import.meta.env.VITE_INSFORGE_ANON_KEY as string | undefined)?.trim();

export const insforgeConfigured = Boolean(
  baseUrl.startsWith('https://') && anonKey && !baseUrl.includes('YOUR-PROJECT') && !baseUrl.includes('insforge.dev/dashboard'),
);

export const insforge = createClient({
  baseUrl: baseUrl || 'https://invalid.local',
  anonKey: anonKey || '',
});

export type AppProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  role: string;
  school_id: string | null;
  jenjang: string | null;
  photo_url: string | null;
  is_active?: boolean | null;
};

export async function getMyProfile(): Promise<{
  authUser: { id: string; email?: string } | null;
  profile: AppProfile | null;
  error: string | null;
}> {
  const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
  if (authError) {
    return { authUser: null, profile: null, error: authError.message };
  }
  const user = authData?.user ?? null;
  if (!user) {
    return { authUser: null, profile: null, error: null };
  }

  const { data, error } = await insforge.database
    .from('profiles')
    .select('id, user_id, full_name, role, school_id, jenjang, photo_url, is_active')
    .eq('user_id', user.id);

  if (error) {
    return {
      authUser: { id: user.id, email: user.email },
      profile: null,
      error: `profiles: ${error.message}`,
    };
  }

  const rows = (data || []) as AppProfile[];
  return {
    authUser: { id: user.id, email: user.email },
    profile: rows[0] ?? null,
    error: rows[0] ? null : 'Login OK, tapi belum ada baris di public.profiles untuk user_id ini.',
  };
}

type AuthJson = {
  user?: { id: string };
  data?: { user?: { id: string } };
  error?: string | { message?: string };
  message?: string;
};

function authErr(json: AuthJson, fallback: string) {
  return typeof json.error === 'string' ? json.error : json.error?.message || json.message || fallback;
}

function authId(json: AuthJson) {
  return json.user?.id || json.data?.user?.id || '';
}

function isDupEmail(msg: string) {
  const m = msg.toLowerCase();
  return (
    m.includes('already') ||
    m.includes('exists') ||
    m.includes('duplicate') ||
    m.includes('registered') ||
    m.includes('terdaftar') ||
    m.includes('sudah')
  );
}

export async function tandaiEmailVerified(userId: string, email: string) {
  try {
    await fetch(`${baseUrl}/api/auth/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ emailVerified: true, email_verified: true }),
    });
  } catch {
    /* abaikan */
  }
  try {
    await insforge.database.rpc('smart_confirm_auth_emails', {});
  } catch {
    /* fungsi 013 belum dipasang */
  }
  void email;
}

async function searchAuthUserId(email: string): Promise<string> {
  const q = encodeURIComponent(email.trim());
  const res = await fetch(`${baseUrl}/api/auth/users?limit=50&search=${q}`, {
    headers: { Authorization: `Bearer ${anonKey}` },
  });
  const json = (await res.json().catch(() => ({}))) as {
    users?: { id?: string; email?: string }[];
    data?: { users?: { id?: string; email?: string }[]; items?: { id?: string; email?: string }[] };
    items?: { id?: string; email?: string }[];
  };
  const list = json.users || json.data?.users || json.data?.items || json.items || [];
  const hit = list.find((u) => (u.email || '').toLowerCase() === email.trim().toLowerCase());
  return hit?.id || '';
}

/** Login lewat fetch (desktop) — tidak menimpa cookie/sesi admin di browser. */
export async function lookupAuthUserByPassword(input: {
  email: string;
  password: string;
}): Promise<{ id: string } | { error: string }> {
  if (!baseUrl) return { error: 'URL belum diisi.' };
  try {
    const res = await fetch(`${baseUrl}/api/auth/sessions?client_type=desktop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ email: input.email.trim(), password: input.password }),
    });
    const json = (await res.json().catch(() => ({}))) as AuthJson;
    if (!res.ok) return { error: authErr(json, `HTTP ${res.status}`) };
    const id = authId(json);
    if (!id) return { error: 'Login OK tapi tanpa user id.' };
    return { id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Buat user Auth, atau tautkan jika email sudah ada (login / cari daftar user). */
export async function adminCreateAuthUser(input: {
  email: string;
  password: string;
  name: string;
}): Promise<{ id: string; reused?: boolean } | { error: string }> {
  if (!baseUrl || !anonKey) return { error: 'URL/anon key belum diisi.' };
  try {
    const res = await fetch(`${baseUrl}/api/auth/users?client_type=desktop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        email: input.email.trim(),
        password: input.password,
        name: input.name.trim() || input.email.trim(),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as AuthJson;
    if (res.ok) {
      const id = authId(json);
      if (!id) return { error: 'Auth tidak mengembalikan user id. Cek respons API.' };
      await tandaiEmailVerified(id, input.email);
      return { id };
    }
    const msg = authErr(json, `HTTP ${res.status}`);
    if (res.status === 409 || isDupEmail(msg)) {
      const found = await lookupAuthUserByPassword({ email: input.email, password: input.password });
      if ('id' in found) {
        await tandaiEmailVerified(found.id, input.email);
        return { id: found.id, reused: true };
      }
      const listed = await searchAuthUserId(input.email);
      if (listed) {
        await tandaiEmailVerified(listed, input.email);
        return { id: listed, reused: true };
      }
      return {
        error:
          'Email sudah di Auth. Password CSV tidak cocok dan daftar user tidak terbaca. Dashboard: matikan verifikasi email (auto-confirm). Atau SQL 010.',
      };
    }
    return { error: msg };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function summarizeAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('password csv') || m.includes('sudah di auth')) return msg;
  if (m.includes('already') || m.includes('exists') || m.includes('duplicate') || m.includes('registered')) {
    return 'Email sudah terdaftar di Auth';
  }
  if (m.includes('signup') || m.includes('sign up') || m.includes('disabled') || m.includes('not allowed')) {
    return 'Pendaftaran Auth ditutup. Dashboard InsForge → Authentication → izinkan signup / Auto-confirm email.';
  }
  if (m.includes('password') && (m.includes('weak') || m.includes('short') || m.includes('8'))) {
    return 'Password terlalu pendek (min 8)';
  }
  if (m.includes('rate') || m.includes('too many')) {
    return 'Terlalu banyak request Auth — tunggu 1 menit lalu import lagi (batch kecil)';
  }
  if (m.includes('403') || m.includes('401') || m.includes('unauthorized')) {
    return 'Auth menolak (401/403). Cek VITE_INSFORGE_ANON_KEY dan izinkan signup.';
  }
  return msg;
}
