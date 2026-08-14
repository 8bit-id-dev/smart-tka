import { insforge } from './insforge';

/** Pindahkan siswa ke satu kelas (hapus keanggotaan lama). */
export async function assignSiswaKeKelas(
  profileId: string,
  classId: string,
  opts?: { fromClassId?: string | null; reason?: string; jenjang?: string },
) {
  const from = opts?.fromClassId;
  await insforge.database.from('class_students').delete().eq('profile_id', profileId);
  const ins = await insforge.database.from('class_students').insert({ class_id: classId, profile_id: profileId });
  if (ins.error) return ins;
  if (opts?.jenjang) {
    await insforge.database.from('profiles').update({ jenjang: opts.jenjang }).eq('id', profileId);
  }
  if (from !== classId) {
    const log = await insforge.database.from('class_moves').insert({
      profile_id: profileId,
      from_class_id: from || null,
      to_class_id: classId,
      reason: opts?.reason || 'pindah',
    });
    if (log.error && !String(log.error.message).includes('does not exist')) {
      /* pindah tetap sukses meski log gagal */
    }
  }
  return ins;
}

export function cariKelasByKode(
  classes: { id: string; name: string; invite_code?: string }[],
  kode: string,
) {
  const k = kode.trim().toUpperCase();
  if (!k) return undefined;
  return classes.find((c) => (c.invite_code || '').toUpperCase() === k || c.name.toUpperCase() === k);
}
