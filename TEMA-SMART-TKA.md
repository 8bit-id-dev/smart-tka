# Tema & style SMART-TKA (kunci dari hero-landing)

Sumber kebenaran visual: `web/src/assets/hero-landing.png` (**halaman landing penuh**, bukan mockup HP).  
Pakai file ini untuk **semua layar berikutnya** (landing, Masuk, onboarding, dashboard) supaya tidak kembali ke iPhone / biru Q-learn / kuning penuh.

Referensi gambar: `hero-landing.png`, `hero.png`, `logo-8bit.png`, `logo-osis.jpeg`, `logo-sekolah.jpg`.

---

## Kepribadian

Tenang, sekolah, modern. Bukan portal kementerian, bukan MOOC, bukan game.

- **Bukan resmi** Kemendikdasmen — tidak ada Garuda, stempel RESMI, prediksi TKA/SPMB.
- Satu CTA: **Masuk** (akun dibuat admin, bukan Daftar).
- Ilustrasi datar, kulit hangat siswa Indonesia, seragam SMA.
- Aksen kuning **hanya** pada chip panah CTA. Nav/tombol di dalam app tetap **teal `#0d5c5c`**.

---

## Token landing (dari hero-landing.png)

| Token | Nilai | Pakai |
|---|---|---|
| Canvas | `#FFFFFF` | Latar layar publik |
| Studio | `#F2F3F5` | Di luar device (mockup) |
| Ink | `#111111` | Wordmark, judul |
| Body | `#3A3A3A` | Tagline Inggris |
| Muted | `#6B6B6B` | Keterangan ID, footer |
| Doodle | `#D0D4D8` | Ikon garis belakang siswa |
| CTA fill | `#FFFFFF` | Pill **Masuk** |
| CTA ink | `#111111` | Teks Masuk |
| CTA accent | `#F0B429` | Lingkaran panah saja |
| Teal app | `#0d5c5c` | **Bukan** di landing; untuk shell setelah login |
| Kulit | `#E0B089`–`#D4A574` | Wajah/leher/tangan merata |
| Radius pill | `999px` | Tombol Masuk |
| Type | Plus Jakarta Sans | 700 wordmark, 600 tagline, 400 body |

---

## Tata letak (mobile-first, Android)

Urutan vertikal, jarak merata (~20–28px antar blok):

1. Status bar Android (bukan notch iPhone)
2. Wordmark **SMART-TKA** — sekali, di atas, bold
3. Ilustrasi siswa **sedang** + doodle tipis (`UJIAN`, `BELAJAR`, lampu, gigi, buku)
4. Tagline Inggris (bukan judul kedua SMART-TKA)
5. Keterangan Indonesia 1–2 baris
6. Pill **Masuk** + chip kuning panah
7. `powered by` + **logo 8bit.png asli** + `8bit.id`

Desktop (1440): kiri ilustrasi + doodle; kanan wordmark + tagline + keterangan + Masuk + powered by. Jangan carousel 3 HP.

---

## Karakter hero

- Siswa SMA, kemeja putih, dasi abu, celana abu
- Name tag **AHMAD**
- Saku terlihat; logo **OSIS** (`osis.jpeg`) kecil di dalam saku
- Membawa **buku** + **smartphone** (bukan laptop)
- Opsional: logo sekolah SMA 3 Rembang di lengan kiri siswa
- Dilarang: Garuda, bendera sebagai lencana resmi, logo kementerian

---

## Copy terkunci

- Wordmark: `SMART-TKA`
- Tagline: `System for Mastery, Achieve, Readiness, and Training for TKA`
- Keterangan: `Latihan dan simulasi Tes Kemampuan Akademik agar siswa menguasai materi dan siap menghadapi TKA.`
- CTA: `Masuk`
- Footer: `powered by` + aset `8bit.png` + `8bit.id`
- Jangan tulis `8bit.id.dev` di UI
- Dilarang: malu, kamu malas, prediksi lolos, 5000 kursus, Daftar gratis

---

## Dua chrome (jangan dicampur)

| Konteks | Latar | Aksen tombol |
|---|---|---|
| Landing / splash | Putih | Pill putih + panah **kuning** |
| Setelah login (app) | Cream `#F7F4EE` | **Teal** `#0d5c5c` |

---

## Checklist layar berikutnya

- [x] Android-first (390 / 412), desktop belakangan
- [x] **Tanpa status bar** / notch / gesture line pada desain selanjutnya
- [x] Wordmark SMART-TKA hanya sekali di chrome
- [x] Tidak ada biru Q-learn
- [x] Kuning hanya chip/panah, bukan banjir latar
- [x] Logo 8bit = file PNG asli, bukan jam pasir generik
- [x] Tidak ada Google / Apple / Play badge
- [x] Disclaimer resmi: boleh di AuthScreen; landing memakai powered by 8bit
- [x] Form Masuk: `web/src/AuthScreen.tsx` + prompt `PROMPT-MASUK-HERO.md`
