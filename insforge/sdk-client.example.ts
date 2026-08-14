import { createClient } from '@insforge/sdk';

/**
 * Isi dari dashboard InsForge (staging):
 * Settings → API → Project URL + anon key
 */
export const insforge = createClient({
  baseUrl: import.meta.env.VITE_INSFORGE_URL as string,
  anonKey: import.meta.env.VITE_INSFORGE_ANON_KEY as string,
});

export type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  role: 'siswa' | 'orang_tua' | 'guru' | 'admin' | 'kepsek';
  school_id: string | null;
  jenjang: string | null;
};

export async function getMyProfile() {
  const { data: session } = await insforge.auth.getSession();
  if (!session) return null;
  const { data, error } = await insforge.database
    .from('profiles')
    .select()
    .eq('user_id', session.user.id)
    .single();
  if (error) throw error;
  return data as Profile;
}
