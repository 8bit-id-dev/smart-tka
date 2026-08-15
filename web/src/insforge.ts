import { createClient } from '@insforge/sdk';

const baseUrl = import.meta.env.VITE_INSFORGE_URL as string | undefined;
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY as string | undefined;

export const insforgeConfigured = Boolean(baseUrl && anonKey && !baseUrl.includes('YOUR-PROJECT'));

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
    .select('id, user_id, full_name, role, school_id, jenjang, is_active')
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
