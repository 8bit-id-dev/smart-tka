# Edge Functions (P2+)

Deploy dari CLI setelah `link` staging. Nama file = nama function.

Rencana:

| Function | Kegunaan |
|---|---|
| `attempt-start` | Buat attempt, set `ends_at` = now + duration_sec |
| `attempt-tick` | Return sisa detik dari server (sumber countdown UI) |
| `attempt-submit` | Kunci paket, hitung skor, buka pembahasan |
| `answer-lock` | Latihan: kunci 1 butir, return is_correct + rationale |
| `ai-report` | Model Gateway; input metrik saja |

Jangan hitung sisa waktu di browser sebagai sumber kebenaran.
