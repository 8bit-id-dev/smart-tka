# SMART-TKA × InsForge — langkah demi langkah (sangat detail)

Ikuti **berurutan**. Jangan loncat ke produksi.  
Waktu: ± 45–90 menit untuk sampai “saya sudah login CLI + tabel ada di staging”.

**Yang Anda butuhkan**

- Laptop dengan Chrome/Edge  
- Akun Google atau GitHub  
- Node.js **20+** (`node -v` di terminal)  
- Folder kerja, contoh: `Documents/smart-tka`  
- Koneksi internet stabil  

Cek Node:

```bash
node -v
npm -v
```

Jika perintah tidak dikenali: pasang LTS dari [nodejs.org](https://nodejs.org/), tutup terminal, buka lagi.

---

# BAGIAN A — Akun & dua project di cloud

## A1. Buka InsForge

1. Buka [https://insforge.dev/](https://insforge.dev/).  
2. Klik **Start Building** / **Sign in**.  
3. Masuk dengan **Google** atau **GitHub** (email akan terverifikasi).  
4. Jika diminta nama organisasi, isi misalnya `SMART-TKA`.  
5. Anda harus sampai **dashboard** (daftar project, bisa masih kosong).

Jika halaman error: ganti browser, matikan blocker iklan untuk domain ini, coba mode penyamaran.

## A2. Buat project STAGING (wajib dulu)

1. Klik **Create New Project** / **New project**.  
2. Nama project: `smart-tka-staging`  
   (huruf kecil, strip; jangan spasi).  
3. Tunggu ± 3–15 detik sampai status Ready.  
4. Anda masuk ke konsol project.  
5. Lihat **address bar**, bentuknya:

```
https://insforge.dev/dashboard/project/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

6. Salin bagian `xxxxxxxx-...` itu. Itu **Project ID staging**.  
7. Simpan di catatan (Notepad):

```
STAGING_PROJECT_ID=...
```

## A3. Catat URL backend + kunci anon

Masih di project staging:

1. Buka menu **Settings** / **API** / **Keys** (nama menu bisa **Project settings**).  
2. Cari dua nilai kira-kira seperti ini:

| Nama di UI | Contoh | Simpan sebagai |
|---|---|---|
| Project URL / API URL / Base URL | `https://xxxx.us-east.insforge.app` | `VITE_INSFORGE_URL` |
| Anon key / Public key / Publishable | string panjang | `VITE_INSFORGE_ANON_KEY` |

3. **Jangan** salin kunci yang bertuliskan **service** / **secret** / **admin** ke frontend.  
4. Tambahkan ke catatan:

```
VITE_INSFORGE_URL=https://....insforge.app
VITE_INSFORGE_ANON_KEY=eyJ....
```

## A4. Buat project PRODUCTION (kosongkan dulu)

1. Kembali ke daftar project.  
2. **Create New Project** → nama `smart-tka-prod`.  
3. Salin Project ID prod ke catatan, beri label **JANGAN DIPAKAI DULU**.  
4. Jangan jalankan migrasi di prod sampai RLS diuji di staging.

## A5. Aktifkan cara login pengguna (Auth)

Di **staging**:

1. Menu **Authentication** / **Auth**.  
2. Nyalakan **Email + password** (atau Email magic link jika hanya itu yang ada).  
3. Nyalakan **Google** OAuth jika ada tombol Providers.  
   - Google Cloud Console akan minta Client ID/Secret jika InsForge tidak menyediakan default.  
   - Jika rumit: **tunda Google**, pakai email/password dulu.  
4. Simpan. Jangan wajibkan “confirm email” ketat di staging (atau cek folder spam).

---

# BAGIAN B — Folder di komputer Anda

## B1. Siapkan folder proyek

**Windows (PowerShell):**

```powershell
cd $HOME\Documents
mkdir smart-tka
cd smart-tka
```

**macOS / Linux:**

```bash
cd ~/Documents
mkdir -p smart-tka
cd smart-tka
```

## B2. Salin file yang sudah dibuat di workspace ini

Dari workspace Arena (`insforge/`) salin seluruh folder ke `Documents/smart-tka/insforge/` sehingga ada:

```
smart-tka/
  insforge/
    README.md
    LANGKAH-DEMI-LANGKAH.md   ← file ini
    migrations/
      001_smart_tka_core.sql
    sdk-client.example.ts
    functions/
      README.md
```

Jika Anda bekerja langsung di workspace ini, cukup:

```bash
cd /home/user
# atau path workspace Anda
```

## B3. (Opsional sekarang) App web kosong

Nanti setelah Stitch export. Untuk tes InsForge saja, cukup folder + CLI. App Vite bisa menyusul di Bagian E.

---

# BAGIAN C — Login CLI & tautkan staging

Buka terminal **di dalam** folder `smart-tka`.

## C1. Login

```bash
npx @insforge/cli login
```

- Pertama kali: `npx` mengunduh paket; ketik `y` jika ditanya install.  
- Browser terbuka → masuk akun InsForge yang sama.  
- Kembali ke terminal: harus ada tulisan sukses / logged in.

**Jika browser tidak terbuka** (SSH, remote, sandbox):

```bash
npx @insforge/cli login --device
```

1. Terminal menampilkan URL + kode pendek.  
2. Buka URL di HP/laptop lain.  
3. Masuk, klik **Approve**.  
4. Terminal berubah jadi sukses.

## C2. Tautkan folder ke staging

Ganti ID dengan punya Anda:

```bash
npx @insforge/cli link --project-id STAGING_PROJECT_ID
```

Harus selesai tanpa error. Biasanya muncul file tersembunyi di folder (mis. `.insforge` atau sejenis). **Jangan commit secret.**

## C3. Pastikan identitas

```bash
npx @insforge/cli whoami
npx @insforge/cli metadata
```

`whoami` menampilkan email Anda.  
`metadata` menampilkan project, tabel (masih sedikit), URL.

Jika `whoami` error: ulang `login`, pastikan Anda di folder yang sama dengan `link`.

## C4. Bantuan perintah (jika nama subcommand beda)

```bash
npx @insforge/cli --help
npx @insforge/cli db --help
```

Catat apakah migrasi disebut `db migrations up` atau `db migrate`. Pakai yang ada di help — itu yang benar untuk versi CLI Anda.

---

# BAGIAN D — Pasang skema database (tabel SMART-TKA)

Ada **dua cara**. Pilih **satu** yang berhasil. Keduanya hanya di **staging**.

## D1. Cara dashboard (paling mudah)

1. Buka project `smart-tka-staging` di browser.  
2. Menu **Database** → **SQL** / **SQL Studio** / **Query**.  
3. Buka file `insforge/migrations/001_smart_tka_core.sql` di editor.  
4. **Select all** → copy.  
5. Tempel di SQL Studio.  
6. Klik **Run** / **Execute**.  
7. Jika error di baris `auth` / `smart_uid` / `create type ... already exists`:  
   - Kirim **teks error lengkap** ke saya; jangan hapus tabel sembarangan.  
8. Jika sukses: buka **Table editor**. Anda harus melihat antara lain:

`schools`, `profiles`, `classes`, `items`, `packages`, `attempts`, `announcements`

9. Klik satu tabel → pastikan **RLS / Row Level Security = ON** (jangan dimatikan).

## D2. Cara CLI (jika help mendukung migrations)

Contoh (sesuaikan help):

```bash
npx @insforge/cli db migrations up --all
```

atau menunjuk folder:

```bash
npx @insforge/cli db migrations up --dir ./insforge/migrations
```

Jika perintah tidak ada: pakai **D1** saja.

## D3. Cek cepat isi (opsional)

Di SQL Studio:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by 1;
```

Harus ada `profiles`, `items`, `packages`.

---

# BAGIAN E — App web React menyambung InsForge

Lakukan jika Anda sudah punya export Stitch, **atau** tes koneksi dulu dengan Vite kosong.

## E1. Vite kosong (tes koneksi, boleh dilewati jika sudah ada app Stitch)

```bash
cd ~/Documents/smart-tka
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install @insforge/sdk
```

## E2. File environment

Di folder `web/` buat file `.env` (jangan di-git):

```
VITE_INSFORGE_URL=https://GANTI.insforge.app
VITE_INSFORGE_ANON_KEY=GANTI_ANON_KEY
```

Tanpa tanda kutip. Tanpa spasi di sekitar `=`.

Tambahkan `.env` ke `.gitignore` jika belum:

```
.env
.env.local
```

## E3. Client SDK

Salin `insforge/sdk-client.example.ts` menjadi:

`web/src/lib/insforge.ts`

Pastikan import path `@insforge/sdk` ter-install.

## E4. Halaman tes login (sementara)

Buat `web/src/pages/LoginTest.tsx` atau tempel di `App.tsx` untuk tes:

Alur yang harus jalan:

1. `insforge.auth.signUp({ email, password })` **atau** `signIn` — sesuaikan nama method di dokumentasi SDK / autocomplete editor (`signInWithPassword`, dll.).  
2. Jika method beda, buka node_modules atau docs: [TypeScript SDK](https://docs.insforge.dev/sdks/typescript/database).  
3. Setelah login, panggil `getMyProfile()`.

**Penting:** trigger “auto insert profile” mungkin **belum** ada di migrasi v1. User pertama bisa belum punya baris `profiles`.

### E4b. Buat profil manual di SQL (setelah Anda daftar 1 akun)

1. Auth → Users di dashboard: salin **User UUID**.  
2. SQL:

```sql
insert into schools (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'SMP Demo SMART-TKA')
on conflict do nothing;

insert into profiles (user_id, full_name, role, school_id, jenjang)
values (
  'TEMPLEKAN-UUID-USER-DARI-AUTH',
  'Admin Demo',
  'admin',
  '11111111-1111-1111-1111-111111111111',
  'smp'
);
```

3. Refresh app: `getMyProfile()` harus mengembalikan `role: admin`.

## E5. Jalankan web

```bash
cd web
npm run dev
```

Buka URL yang ditulis Vite (biasanya `http://localhost:5173`).  
Jika env tidak kebaca: **hentikan** server (`Ctrl+C`), jalankan lagi (Vite hanya baca `.env` saat start).

CORS error: di dashboard InsForge cari **Allowed origins** / URL whitelist, tambahkan `http://localhost:5173`.

---

# BAGIAN F — Editor AI (Antigravity / Cursor) + MCP

Lakukan **setelah** C3 sukses.

1. Buka [docs.insforge.dev/mcp-setup](https://docs.insforge.dev/mcp-setup).  
2. Pilih editor Anda (Cursor / VS Code / Antigravity).  
3. Tempel config MCP InsForge (biasanya butuh login yang sama).  
4. Restart editor.  
5. Chat agen, tempel:

```
Saya pakai InsForge backend SMART-TKA.
Folder sudah di-link ke project STAGING.
Jangan sentuh production.
Jangan matikan RLS.
Baca insforge/migrations dan metadata CLI.
Tolong verifikasi tabel sudah ada.
```

6. Jika agen minta `create` project baru: **tolak**; kita sudah punya staging.

---

# BAGIAN G — Uji RLS (wajib sebelum isi soal sungguhan)

1. Buat 2 user email berbeda (mis. `guru.a@test.com`, `guru.b@test.com`).  
2. SQL: profil A `school_id` demo, profil B `school_id` sekolah lain (buat `schools` kedua).  
3. Login sebagai A di web: hanya data sekolah A.  
4. Jika B terlihat: **berhenti**, kirim query + policy ke saya. Jangan lanjut konten.

---

# BAGIAN H — Apa yang belum dilakukan (sengaja)

| Item | Kapan |
|---|---|
| Function countdown ujian | Setelah login + attempt UI |
| 2.400 soal | Tim konten / impor |
| Project prod + migrasi | Setelah uji RLS + 1 sekolah piloting |
| iOS/Android | Setelah web stabil (D17) |
| Midtrans | P3 |

---

# BAGIAN I — Masalah yang sering terjadi

| Gejala | Perbaikan |
|---|---|
| `npx` tidak ada | Install Node 20+ |
| `login` hang | `login --device` |
| `link` “project not found” | Salah ID; salin ulang dari URL |
| `whoami` unauthenticated | `login` lagi di folder yang sama |
| SQL `type already exists` | Normal jika dijalankan 2×; lanjut atau skip blok enum |
| SQL gagal di `smart_uid` / jwt | Kirim error; kita sesuaikan helper dengan JWT InsForge Anda |
| Tabel ada tapi select kosong | RLS: belum ada baris `profiles` untuk user Anda |
| Vite env undefined | Prefix wajib `VITE_`, restart dev server |
| CORS | Allow `http://localhost:5173` |
| Jangan commit `.env` | Cek `git status` |

---

# BAGIAN J — Checklist selesai “fase fondasi”

Centang sebelum kita lanjut function timer:

- [ ] Dua project: staging + prod  
- [ ] Project ID & anon key staging tersimpan **lokal**  
- [ ] `npx @insforge/cli whoami` sukses  
- [ ] `link` ke **staging**  
- [ ] Tabel inti terlihat, RLS on  
- [ ] Satu user Auth + satu baris `profiles`  
- [ ] (Opsional) Vite + SDK membaca profil  
- [ ] Belum ada secret di Git  

---

# BAGIAN K — Kirim ke saya agar bisa dibantu langkah berikutnya

Copy-paste (sensor token):

```
1. OS: Windows / Mac / Linux
2. node -v:
3. whoami sukses? (ya/tidak + email tersamarkan)
4. Cara migrasi: SQL Studio / CLI / belum
5. Error SQL (jika ada), teks penuh
6. Tabel yang terlihat:
7. App web sudah ada? Stitch / Vite kosong / belum
```

**Jangan** kirim anon key, service role, atau password.

---

Lanjut resmi setelah checklist: **function `attempt-start` + `attempt-tick`** (countdown ujian) atau **halaman login React** menyatu dengan export Stitch.
