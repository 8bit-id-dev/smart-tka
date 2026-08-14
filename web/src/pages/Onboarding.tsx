import { useState } from 'react';

const JENJANG = [
  { id: 'sd', label: 'SD kelas 6' },
  { id: 'smp', label: 'SMP kelas 9' },
  { id: 'sma', label: 'SMA kelas 12' },
  { id: 'smk', label: 'SMK' },
  { id: 'paket_b', label: 'Paket B' },
];

export function Onboarding({ onDone }: { onDone: (jenjang: string) => void }) {
  const [step, setStep] = useState(0);
  const [jenjang, setJenjang] = useState('smp');

  return (
    <div className="auth-page">
      <main className="auth-card" style={{ maxWidth: 480 }}>
        {step === 0 && (
          <>
            <h1>Pilih jenjang</h1>
            <p className="auth-lead">Sesuai kelas akhir Anda.</p>
            <div className="choices">
              {JENJANG.map((j) => (
                <button key={j.id} type="button" className={`choice ${jenjang === j.id ? 'sel' : ''}`} onClick={() => setJenjang(j.id)}>
                  {j.label}
                </button>
              ))}
            </div>
            <button className="btn" type="button" style={{ marginTop: 20 }} onClick={() => setStep(1)}>
              Lanjut
            </button>
          </>
        )}
        {step === 1 && (
          <>
            <h1>Mata pelajaran</h1>
            <p className="auth-lead">
              {jenjang === 'sma' || jenjang === 'smk'
                ? 'Bahasa Indonesia, Matematika, Bahasa Inggris. Pilihan menyusul.'
                : 'Bahasa Indonesia dan Matematika.'}
            </p>
            <button className="btn" type="button" onClick={() => setStep(2)}>
              Lanjut
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <h1>Apa itu TKA?</h1>
            <ul className="type-bm" style={{ lineHeight: 1.6, paddingLeft: 20 }}>
              <li>Tidak wajib dan tidak menentukan kelulusan.</li>
              <li>Berguna untuk SPMB jalur prestasi.</li>
              <li>SMART-TKA adalah latihan, bukan portal resmi kementerian.</li>
            </ul>
            <button className="btn" type="button" style={{ marginTop: 20 }} onClick={() => onDone(jenjang)}>
              Mulai ke beranda
            </button>
          </>
        )}
      </main>
    </div>
  );
}
