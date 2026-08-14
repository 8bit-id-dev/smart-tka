import { insforge } from './insforge';

export type MapelRow = { id: string; name: string; jenjang: string; school_id: string };
export type MateriRow = { id: string; name: string; mapel_id: string };

export async function loadMapels(schoolId: string, jenjang?: string) {
  let q = insforge.database.from('mapels').select('id, name, jenjang, school_id').eq('school_id', schoolId);
  if (jenjang) q = q.eq('jenjang', jenjang);
  const { data, error } = await q;
  return { rows: (data || []) as MapelRow[], error: error?.message || '' };
}

export async function loadMateris(mapelId: string) {
  const { data, error } = await insforge.database.from('materis').select('id, name, mapel_id').eq('mapel_id', mapelId);
  return { rows: (data || []) as MateriRow[], error: error?.message || '' };
}
