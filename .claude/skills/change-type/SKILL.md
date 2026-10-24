---
name: change-type
description: >-
    Framework operasional untuk mendefinisikan Change Type sebelum agent melakukan perubahan kode. Aktifkan skill ini ketika user menyebutkan kata kunci seperti PATCH, HOTFIX, BUG-FIX, ENHANCEMENT, FEATURE, REFACTOR, MIGRATION, UPDATE, UPGRADE, OPTIMIZATION, ROLLBACK, HARDENING, REWRITE, REWORK, PORTING, INTEGRATION, MODERNIZATION, MAINTENANCE, DEPLOYMENT, atau RELEASE — atau ketika user meminta perbaikan bug, fitur baru, refactoring, migrasi, deployment, atau aktivitas pemeliharaan sistem. Skill ini memastikan agent beroperasi dengan batasan yang jelas, mengurangi over-engineering dan perubahan di luar scope.
---

# Change Type Framework

Setiap permintaan coding harus dimulai dengan menentukan **Change Type** secara eksplisit. Ini bukan formalitas — ini adalah kontrak operasional antara user dan agent yang menentukan apa yang boleh berubah, apa yang tidak boleh, dan bagaimana keberhasilan diukur.

## Cara Menggunakan

Saat menerima permintaan perubahan kode, ikuti urutan ini:

1.  **Identifikasi Change Type** dari konteks permintaan user atau tanyakan jika tidak jelas.
2.  **Baca template** yang sesuai dari `references/types.md`.
3.  **Buat Change Brief** di awal respons menggunakan format ringkas.
4.  **Eksekusi** dalam batas yang telah ditetapkan.
5.  **Validasi** menggunakan Success Criteria sebelum menyerahkan hasil.

## Change Brief Format (Wajib Ditampilkan Sebelum Eksekusi)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE TYPE : <TYPE>
SCOPE       : <file/modul/komponen yang mungkin berubah>
FORBIDDEN   : <apa yang tidak boleh disentuh>
RISK LEVEL  : LOW | MEDIUM | HIGH
SUCCESS     : <kriteria keberhasilan yang terukur>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Tabel Risk Level

| Change Type   | Kategori   | Default Risk | Alasan                                           |
| :------------ | :--------- | :----------- | :----------------------------------------------- |
| PATCH         | Corrective | LOW          | Perubahan minimal, terisolasi                    |
| BUG-FIX       | Corrective | LOW–MEDIUM   | Bisa multi-file jika bug kompleks                |
| HOTFIX        | Corrective | MEDIUM       | Speed-first, solusi temporer mungkin ada         |
| ROLLBACK      | Corrective | HIGH         | State reversion, data integrity kritis           |
| UPDATE        | Adaptive   | LOW–MEDIUM   | Dependency bump, breaking change mungkin ada     |
| DEPLOYMENT    | Adaptive   | MEDIUM–HIGH  | Environment change, rollback perlu disiapkan     |
| RELEASE       | Adaptive   | MEDIUM       | Versioning & packaging, no code change           |
| PORTING       | Adaptive   | HIGH         | Platform-specific path, test coverage luas       |
| UPGRADE       | Adaptive   | HIGH         | Major version, kemungkinan breaking change besar |
| MIGRATION     | Adaptive   | HIGH         | Data & arsitektur, rollback wajib                |
| MAINTENANCE   | Preventive | LOW          | Cleanup rutin, fungsionalitas tidak berubah      |
| HARDENING     | Preventive | MEDIUM       | Security change, false-positive risk ada         |
| INTEGRATION   | Preventive | MEDIUM–HIGH  | Multi-komponen, interface contract kritis        |
| REFACTOR      | Preventive | HIGH         | Perubahan struktural luas, risiko perilaku       |
| ENHANCEMENT   | Perfective | MEDIUM       | Modifikasi fitur yang ada, regresi mungkin       |
| OPTIMIZATION  | Perfective | MEDIUM       | Performa change, correctness harus terjaga       |
| REWORK        | Perfective | MEDIUM–HIGH  | Implementasi ulang, scope creep risk             |
| FEATURE       | Perfective | MEDIUM–HIGH  | Kode baru, integrasi sistem dibutuhkan           |
| MODERNIZATION | Perfective | HIGH         | Stack change luas, behavior harus terjaga        |
| REWRITE       | Perfective | VERY HIGH    | Kode baru dari awal, parity validation kritis    |

## Eskalasi dan Interupsi

Jika saat mengeksekusi agent menemukan kondisi berikut, **HARUS BERHENTI** dan melaporkan ke user sebelum melanjutkan:

- Perubahan yang diperlukan melampaui scope yang ditetapkan.
- Menemukan bug tambahan di luar area target (catat, jangan perbaiki).
- Risk level aktual lebih tinggi dari yang diperkirakan.
- Constraint yang saling bertentangan ditemukan.

Gunakan format interupsi:

```
⚠️  SCOPE ALERT
Untuk menyelesaikan [task], agent perlu menyentuh [area di luar scope].
Opsi:
  A) Ubah Change Type ke ENHANCEMENT/FEATURE
  B) Batasi perbaikan hanya pada [area terbatas] dengan trade-off [X]
  C) Buat task terpisah untuk [area tambahan]
Pilih opsi atau berikan arahan baru.
```

## Referensi Lengkap

Lihat definisi operasional setiap Change Type di: [references/types.md](./references/types.md)

Lihat panduan anti-pattern (hal yang sering salah dilakukan agent) di: [references/antipatterns.md](./references/antipatterns.md)
