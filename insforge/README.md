# InsForge — SMART-TKA (mulai di sini)

Anda bekerja dengan InsForge lewat **akun Anda** (browser) + **CLI** di folder proyek.  
Saya (agen) **tidak bisa login menggantikan Anda** kecuali Anda jalankan device-login dan setuju di browser.

Dokumentasi resmi agen: [insforge.dev/skill.md](https://insforge.dev/skill.md)  
Docs: [docs.insforge.dev](https://docs.insforge.dev)

---

## Langkah 1 — Buat 2 project di cloud

Buka [insforge.dev](https://insforge.dev/) (Google/GitHub).

1. **Create New Project** → nama `smart-tka-staging`  
2. Ulangi → `smart-tka-prod` (**jangan** pakai prod sampai RLS diuji)  
3. Salin **Project ID** dari URL:  
   `https://insforge.dev/dashboard/project/<PROJECT_ID>`

Simpan ID staging di catatan. MCP/agen **hanya** di-link ke staging.

---

## Langkah 2 — Login + link CLI (di komputer Anda)

Di folder repo SMART-TKA (boleh folder ini):

```bash
# Jangan install global
npx @insforge/cli login
npx @insforge/cli link --project-id <PROJECT_ID_STAGING>
npx @insforge/cli whoami
npx @insforge/cli metadata
```

Kalau terminal tidak bisa buka browser (SSH/sandbox):

```bash
npx @insforge/cli login --device
```

Lalu buka URL + kode yang muncul, Approve.

---

## Langkah 3 — Pasang SDK di app web (hasil Stitch)

```bash
npm install @insforge/sdk
```

Buat `src/lib/insforge.ts` (lihat `insforge/sdk-client.example.ts`).  
Isi `VITE_INSFORGE_URL` dan `VITE_INSFORGE_ANON_KEY` dari dashboard project (anon/public key saja — **bukan** service role).

`.env` **jangan** di-commit.

---

## Langkah 4 — Terapkan skema

Setelah `link`:

```bash
# sesuaikan subcommand jika `cli --help` beda sedikit
npx @insforge/cli db migrations up --all
```

File SQL ada di `insforge/migrations/`.  
Jika CLI minta path: tunjuk folder `insforge/migrations`.

Atau tempel isi `001_smart_tka_core.sql` di **SQL Studio** dashboard InsForge (staging).

---

## Langkah 5 — Editor (Antigravity / Cursor)

Pasang **InsForge MCP** (lihat [MCP setup](https://docs.insforge.dev/mcp-setup)).  
Prompt ke agen:

```
I'm using InsForge as my backend. Read the current directory.
Use npx @insforge/cli for all backend tasks.
Project is SMART-TKA staging only. Never migrate production.
Apply insforge/migrations if not applied. Do not disable RLS.
```

---

## Langkah 6 — Auth yang kita pakai

Aktifkan di dashboard Auth:

- Email + password  
- Google OAuth  
- (Apple menyusul saat ada native)

Setelah user pertama daftar, baris `profiles` harus terbentuk (trigger di migrasi).  
Set `role` lewat SQL staging untuk akun uji:

```sql
-- contoh: jadikan user Anda admin sekolah demo
update profiles set role = 'admin', school_id = '<uuid sekolah demo>'
where id = '<auth user uuid>';
```

---

## Perintah yang sering dipakai

```bash
npx @insforge/cli --help
npx @insforge/cli metadata          # skema, tabel, keys (hati-hati)
npx @insforge/cli whoami
```

Function CBT/timer: folder `insforge/functions/` (deploy setelah P2).

---

## Aturan aman (wajib)

| Boleh | Jangan |
|---|---|
| Link CLI ke **staging** | MCP ke production |
| Anon key di frontend | Service role di browser |
| Uji RLS: guru A tidak lihat sekolah B | `DISABLE ROW LEVEL SECURITY` |
| Branch DB untuk eksperimen | Generate soal AI ke tabel `items` prod |

---

## Setelah ini kita kerjakan bersama

Kirim ke saya (setelah Anda login):

1. Project ID staging (boleh)  
2. Output `npx @insforge/cli whoami` (tanpa token)  
3. Apakah `migrations up` sudah jalan  

Saya lanjutkan: seed sekolah demo, function timer, atau client React login.
