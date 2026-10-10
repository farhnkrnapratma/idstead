# Definisi Operasional Change Type

Setiap Change Type mendefinisikan **kontrak perilaku** agent: apa yang boleh disentuh, apa yang terlarang, dan bagaimana keberhasilan dibuktikan.

---

## Taksonomi 4 Dimensi (ISO/IEC 14764)

Setiap Change Type masuk dalam salah satu dari 4 kategori fundamental:

| Kategori | Tujuan | Change Types |
| :-- | :-- | :-- |
| **Corrective** | Memperbaiki defek yang ada | PATCH, HOTFIX, BUG-FIX, ROLLBACK |
| **Adaptive** | Menyesuaikan dengan lingkungan baru | MIGRATION, PORTING, DEPLOYMENT, UPDATE, UPGRADE |
| **Perfective** | Meningkatkan kualitas, fitur, atau performa | FEATURE, ENHANCEMENT, OPTIMIZATION, MODERNIZATION, REWRITE, REWORK |
| **Preventive** | Mengurangi risiko masalah di masa depan | REFACTOR, HARDENING, MAINTENANCE, INTEGRATION |

Gunakan taksonomi ini untuk mengambil keputusan ketika Change Type terasa ambigu.

---

## PATCH

```
Change Type    : PATCH
Risk Level     : LOW
Tujuan         : Memperbaiki defek yang teridentifikasi dengan perubahan
                 sekecil mungkin.
```

**Constraint (tidak boleh dilanggar):**

- Tidak menambah fitur baru.
- Tidak memodifikasi public API (signature, endpoint, kontrak).
- Tidak mengubah database schema.
- Tidak mengubah business logic di luar area defek.
- Minimalkan jumlah file yang dimodifikasi.
- Pertahankan backward compatibility.

**Forbidden Changes:**

- Refactoring kode yang tidak terkait.
- Penambahan dependency baru tanpa justifikasi kuat.
- Perubahan formatting/style di seluruh file.

**Success Criteria:**

- Bug yang dilaporkan sudah resolved.
- Existing test suite masih pass (tanpa modifikasi test).
- Tidak ada behavioral change di luar area yang terpengaruh.
- Diff sekecil mungkin (line count minimal).

**Output yang Diharapkan:**

- Root cause analysis singkat.
- Daftar file yang dimodifikasi dengan alasan.
- Penjelasan mengapa ini adalah fix minimal yang valid.

---

## HOTFIX

```
Change Type    : HOTFIX
Risk Level     : MEDIUM
Tujuan         : Menyelesaikan masalah kritis di production secepat mungkin.
                 Speed dan stability adalah prioritas utama.
```

**Constraint (tidak boleh dilanggar):**

- Prioritaskan kecepatan dan stabilitas di atas kesempurnaan.
- Solusi temporer diperbolehkan jika didokumentasikan dengan TODO/FIXME.
- Hindari broad refactoring.
- Batasi perubahan hanya pada production path yang terpengaruh.
- Jangan introduce dependency baru tanpa urgensi jelas.

**Forbidden Changes:**

- Architectural changes.
- Perubahan yang memerlukan review panjang.
- Database migration tanpa rollback strategy.

**Success Criteria:**

- Fungsi production sudah pulih.
- Production risk diminimasi.
- Technical debt yang dihasilkan sudah didokumentasikan.
- Rollback path tersedia jika diperlukan.

**Output yang Diharapkan:**

- Emergency fix (deploy-ready).
- Risk assessment singkat.
- TODO/FIXME yang didokumentasikan untuk permanent solution.
- Rekomendasi permanent solution sebagai task terpisah.

---

## ENHANCEMENT

```
Change Type    : ENHANCEMENT
Risk Level     : MEDIUM
Tujuan         : Meningkatkan fitur yang sudah ada tanpa mengubah tujuan
                 utamanya. UX, performance, atau maintainability boleh diperbaiki.
```

**Constraint (tidak boleh dilanggar):**

- Fungsionalitas yang sudah ada harus tetap bekerja.
- Backward compatibility harus dipertahankan (atau dibuatkan migration path).
- Hanya sentuh fitur yang relevan, bukan refactor global.

**Forbidden Changes:**

- Mengubah public API contract tanpa versioning.
- Menambah fitur yang sepenuhnya baru (itu adalah FEATURE).
- Mengubah fundamental behavior yang user andalkan.

**Success Criteria:**

- Fitur yang sudah ada menjadi lebih berguna, efisien, atau mudah dipelihara.
- Tidak ada regresi pada test yang ada.
- Dokumentasi diperbarui jika behavior berubah.
- Performance benchmark tidak menurun (jika relevan).

**Output yang Diharapkan:**

- Deskripsi enhancement dan justifikasinya.
- Impact analysis (apa yang berubah, siapa yang terpengaruh).
- Updated implementation + test jika behavior berubah.

---

## FEATURE

```
Change Type    : FEATURE
Risk Level     : MEDIUM-HIGH
Tujuan         : Mengimplementasikan fungsionalitas baru yang saat ini tidak ada.
```

**Constraint (tidak boleh dilanggar):**

- Design harus align dengan arsitektur yang ada.
- Sertakan test dan dokumentasi.
- Pertimbangkan extensibility (jangan hardcode assumptions).
- Tidak memodifikasi behavior fitur yang sudah ada.

**Forbidden Changes:**

- Mengubah existing feature behavior (buat Enhancement terpisah).
- Memodifikasi core infrastructure tanpa explicit approval.
- Menambah scope di luar acceptance criteria yang disepakati (scope creep).

**Success Criteria:**

- Kapabilitas baru tersedia dan dapat digunakan.
- Fungsionalitas yang ada tetap intact.
- Semua acceptance criteria terpenuhi.
- Test coverage mencakup happy path dan edge cases.
- Dokumentasi/changelog diperbarui.

**Output yang Diharapkan:**

- Design summary (bagaimana ini fit dengan arsitektur yang ada).
- Implementation dengan test.
- Daftar acceptance criteria yang sudah terpenuhi.

---

## REFACTOR

```
Change Type    : REFACTOR
Risk Level     : HIGH
Tujuan         : Memperbaiki struktur kode tanpa mengubah perilaku yang
                 terobservasi. Pure internal improvement.
```

**Constraint (tidak boleh dilanggar):**

- Tidak ada fitur baru.
- Tidak ada perubahan business logic.
- External behavior harus tetap identik (input/output sama).
- Tidak mengubah public API.

**Forbidden Changes:**

- Memperbaiki bug yang ditemukan saat refactor (buat PATCH terpisah).
- Menambah fungsionalitas baru ("oh sekalian saja").
- Mengubah test expectation (kecuali test itu sendiri yang salah).

**Success Criteria:**

- Semua existing test pass tanpa modifikasi.
- Readability, maintainability, atau performance meningkat (dibuktikan).
- Code metrics membaik (cyclomatic complexity, coupling, dll. jika relevan).
- Tidak ada behavioral change yang bisa dideteksi.

**Output yang Diharapkan:**

- Refactoring rationale (mengapa ini perlu dilakukan sekarang).
- Daftar architectural improvements yang dilakukan.
- Verifikasi behavior preservation (test results, before/after comparison).

---

## MIGRATION

```
Change Type    : MIGRATION
Risk Level     : HIGH
Tujuan         : Memindahkan sistem dari teknologi atau arsitektur saat ini
                 ke target platform/struktur.
```

**Constraint (tidak boleh dilanggar):**

- Pertahankan business functionality.
- Jaga data integrity (tidak ada data loss yang tidak disengaja).
- Sediakan rollback strategy yang jelas dan teruji.
- Jalankan parallel testing sebelum cutover.

**Forbidden Changes:**

- Menambah fitur baru saat migration berlangsung.
- Mengubah business logic saat migration (pisahkan ke task lain).
- One-way migration tanpa rollback path (kecuali disepakati eksplisit).

**Success Criteria:**

- Sistem berjalan dengan benar di target platform.
- Data terjaga (validasi pre/post migration).
- Langkah-langkah migration terdokumentasi dan reproducible.
- Rollback plan tersedia dan sudah diuji (dry-run jika memungkinkan).
- Performance tidak degradasi di target platform.

**Output yang Diharapkan:**

- Migration plan dengan checkpoint.
- Risk assessment dan mitigation plan.
- Validation checklist (pre-migration, during, post-migration).
- Rollback procedure.

---

## BUG-FIX

```
Change Type    : BUG-FIX
Risk Level     : LOW-MEDIUM
Kategori       : Corrective
Tujuan         : Memperbaiki bug yang teridentifikasi. Lebih luas dari PATCH —
                 boleh menyentuh beberapa area jika bug melibatkan interaksi
                 antar komponen.
```

**Constraint (tidak boleh dilanggar):**

- Fokus pada perbaikan bug, bukan improvement.
- Tidak menambah fitur baru.
- Perubahan terbatas pada area yang relevan dengan bug.

**Forbidden Changes:**

- Refactoring kode yang tidak berkaitan langsung dengan bug.
- Mengubah behavior fitur lain yang tidak terlibat.

**Success Criteria:**

- Bug sudah tidak bisa direproduksi.
- Regression test ditambahkan untuk bug ini.
- Fitur lain tidak terpengaruh.

**Output yang Diharapkan:**

- Deskripsi bug dan reproduksi steps.
- Root cause analysis.
- Fix + regression test.

**Perbedaan dengan PATCH:** PATCH = perubahan minimal absolut (1-2 baris). BUG-FIX = perbaikan bug yang bisa melibatkan beberapa file jika bug tersebut kompleks.

---

## UPDATE

```
Change Type    : UPDATE
Risk Level     : LOW-MEDIUM
Kategori       : Adaptive
Tujuan         : Memperbarui dependency, library, konfigurasi, atau komponen
                 sistem ke versi yang lebih baru.
```

**Constraint (tidak boleh dilanggar):**

- Pertahankan API compatibility jika memungkinkan.
- Jika ada breaking change, dokumentasikan dengan jelas.
- Jalankan test suite setelah update.

**Forbidden Changes:**

- Menambah fitur baru memanfaatkan versi baru (buat ENHANCEMENT terpisah).
- Mengubah business logic saat melakukan update.

**Success Criteria:**

- Versi dependency/komponen berhasil diperbarui.
- Semua test pass.
- Tidak ada regresi fungsional.
- CHANGELOG/dependency manifest diperbarui.

**Output yang Diharapkan:**

- Daftar yang diupdate + versi lama vs baru.
- Breaking changes yang ditemukan dan cara mitigasinya.
- Test results.

---

## UPGRADE

```
Change Type    : UPGRADE
Risk Level     : HIGH
Kategori       : Adaptive
Tujuan         : Meningkatkan versi platform, framework, atau infrastruktur
                 secara signifikan (major version bump).
```

**Constraint (tidak boleh dilanggar):**

- Buat branch/environment terpisah untuk upgrade.
- Jalankan full regression test.
- Sediakan rollback plan.
- Dokumentasikan semua breaking changes.

**Forbidden Changes:**

- Menggabungkan upgrade dengan feature development.
- Skip versi intermediate yang memerlukan migration step.

**Success Criteria:**

- Sistem berjalan stabil di versi baru.
- Semua test pass.
- Rollback plan tersedia.
- Dokumentasi dependencies diperbarui.

**Output yang Diharapkan:**

- Upgrade plan dengan checkpoint.
- Daftar breaking changes dan adaptasi yang dilakukan.
- Test results sebelum dan sesudah.
- Rollback procedure.

---

## OPTIMIZATION

```
Change Type    : OPTIMIZATION
Risk Level     : MEDIUM
Kategori       : Perfective
Tujuan         : Meningkatkan performa, efisiensi resource, atau response time
                 tanpa mengubah perilaku fungsional.
```

**Constraint (tidak boleh dilanggar):**

- Perilaku eksternal harus identik (sama-sama correct, hanya lebih cepat/efisien).
- Ukur performa sebelum dan sesudah (benchmark wajib).
- Tidak mengubah public API.

**Forbidden Changes:**

- Mengubah output/behavior demi performa (trade-off yang mengubah correctness).
- Premature optimization tanpa benchmark yang membuktikan bottleneck.

**Success Criteria:**

- Metric performa target tercapai (latency, throughput, memory, CPU).
- Tidak ada regresi fungsional.
- Benchmark before/after terdokumentasi.

**Output yang Diharapkan:**

- Profiling report yang mengidentifikasi bottleneck.
- Benchmark sebelum dan sesudah.
- Penjelasan teknik optimasi yang digunakan.

---

## ROLLBACK

```
Change Type    : ROLLBACK
Risk Level     : HIGH
Kategori       : Corrective
Tujuan         : Mengembalikan sistem ke state/versi sebelumnya karena
                 deployment/change terbaru menyebabkan masalah.
```

**Constraint (tidak boleh dilanggar):**

- Rollback harus cepat dan predictable.
- Jangan tambahkan kode baru saat rollback — kembalikan ke state yang diketahui baik.
- Dokumentasikan root cause untuk post-mortem.

**Forbidden Changes:**

- Menggabungkan rollback dengan perbaikan (lakukan rollback murni dulu, fix kemudian).
- Rollback parsial yang meninggalkan sistem dalam state tidak konsisten.

**Success Criteria:**

- Sistem kembali ke state yang stabil dan diketahui.
- Data integrity terjaga.
- Post-mortem plan tersedia.

**Output yang Diharapkan:**

- Rollback steps yang dilakukan.
- Verifikasi bahwa sistem kembali normal.
- Root cause summary untuk tindak lanjut.

---

## HARDENING

```
Change Type    : HARDENING
Risk Level     : MEDIUM
Kategori       : Preventive
Tujuan         : Meningkatkan keamanan sistem dengan menutup celah, mengurangi
                 attack surface, atau memperketat konfigurasi.
```

**Constraint (tidak boleh dilanggar):**

- Tidak mengubah fungsionalitas yang user-facing (kecuali memang untuk menutup celah).
- Dokumentasikan setiap perubahan keamanan.
- Uji bahwa legitimate use cases tidak terblokir.

**Forbidden Changes:**

- Menambah fitur baru bersamaan dengan hardening.
- Perubahan yang memperkenalkan regression pada functionality.

**Success Criteria:**

- Vulnerability atau attack surface yang ditarget sudah ditutup.
- Security scan/audit menunjukkan perbaikan.
- Legitimate functionality tidak terganggu.

**Output yang Diharapkan:**

- Deskripsi celah yang ditutup.
- Perubahan konfigurasi/kode yang dilakukan.
- Verifikasi melalui security test atau audit.

---

## REWRITE

```
Change Type    : REWRITE
Risk Level     : VERY HIGH
Kategori       : Perfective
Tujuan         : Menulis ulang sebagian atau seluruh kode dari awal, biasanya
                 karena kode lama tidak lagi maintainable atau harus ganti stack.
```

**Constraint (tidak boleh dilanggar):**

- Definisikan scope rewrite dengan jelas (partial vs full).
- Pertahankan semua behavior yang terdokumentasi.
- Jalankan kode lama dan baru secara paralel untuk validasi (jika memungkinkan).
- Sediakan rollback/fallback ke kode lama.

**Forbidden Changes:**

- Mengubah business requirements saat rewrite.
- Menghilangkan fitur tanpa explicit decision.
- One-shot rewrite tanpa milestone/checkpoint.

**Success Criteria:**

- Semua behavior yang ada terjaga (dibuktikan dengan test parity).
- Kode baru lebih maintainable/performant/modern.
- Rollback ke kode lama masih memungkinkan.

**Output yang Diharapkan:**

- Rewrite scope dan justifikasi.
- Comparison matrix: fitur lama vs fitur baru.
- Test parity report.
- Rollback strategy.

---

## REWORK

```
Change Type    : REWORK
Risk Level     : MEDIUM-HIGH
Kategori       : Perfective
Tujuan         : Mengerjakan ulang karena hasil implementasi sebelumnya tidak
                 memenuhi requirement atau kualitas yang diharapkan.
```

**Constraint (tidak boleh dilanggar):**

- Definisikan dengan jelas mengapa implementasi lama inadequate.
- Pastikan requirement baru sudah jelas sebelum mulai.
- Jangan scope creep — rework hanya untuk area yang inadequate.

**Forbidden Changes:**

- Menambah requirement baru yang tidak ada di versi sebelumnya (itu FEATURE).
- Mengubah area yang sudah acceptable.

**Success Criteria:**

- Area yang dirework memenuhi requirement yang awalnya tidak terpenuhi.
- Tidak ada regresi di area lain.
- Acceptance criteria yang dulu gagal sekarang pass.

**Output yang Diharapkan:**

- Identifikasi gap antara implementasi lama dan requirement.
- Implementasi baru.
- Verifikasi bahwa requirement terpenuhi.

---

## PORTING

```
Change Type    : PORTING
Risk Level     : HIGH
Kategori       : Adaptive
Tujuan         : Mengadaptasi software agar berjalan di platform, OS, atau
                 runtime environment yang berbeda.
```

**Constraint (tidak boleh dilanggar):**

- Pertahankan behavior yang sama di semua platform target.
- Gunakan abstraksi untuk code path yang platform-specific.
- Test di semua target platform sebelum selesai.

**Forbidden Changes:**

- Menambah fitur baru yang hanya ada di satu platform.
- Mengubah business logic saat porting.

**Success Criteria:**

- Software berjalan dengan benar di platform target.
- Feature parity dengan platform asal.
- Test suite pass di semua platform target.

**Output yang Diharapkan:**

- Daftar platform-specific changes yang dibuat.
- Test results di setiap platform.
- Known limitations atau differences.

---

## INTEGRATION

```
Change Type    : INTEGRATION
Risk Level     : MEDIUM-HIGH
Kategori       : Preventive
Tujuan         : Menggabungkan komponen, sistem, atau layanan yang sebelumnya
                 terpisah agar dapat bekerja bersama.
```

**Constraint (tidak boleh dilanggar):**

- Definisikan interface/kontrak antara komponen sebelum implementasi.
- Jangan mengubah internal komponen lebih dari yang diperlukan untuk integrasi.
- Pastikan error handling antar komponen jelas.

**Forbidden Changes:**

- Mengubah core logic komponen yang diintegrasikan.
- Menambah fitur baru di dalam scope integration task.

**Success Criteria:**

- Komponen berhasil beroperasi bersama sesuai kontrak yang disepakati.
- Error cases antar komponen ter-handle.
- Integration test pass.

**Output yang Diharapkan:**

- Interface/kontrak yang didefinisikan.
- Integration implementation.
- Integration test suite.

---

## MODERNIZATION

```
Change Type    : MODERNIZATION
Risk Level     : HIGH
Kategori       : Perfective
Tujuan         : Memperbarui teknologi, arsitektur, atau pola desain ke standar
                 yang lebih modern tanpa (atau dengan minimal) mengubah business logic.
```

**Constraint (tidak boleh dilanggar):**

- Business functionality harus terjaga.
- Lakukan secara incremental, bukan big-bang.
- Pertahankan API compatibility.

**Forbidden Changes:**

- Menambah fitur baru selama modernization.
- Mengubah business rules atau logic.

**Success Criteria:**

- Sistem menggunakan teknologi/pola yang lebih modern.
- Behavior yang ada terjaga.
- Developer experience meningkat (build time, tooling, maintainability).

**Output yang Diharapkan:**

- Before/after technology stack comparison.
- Migration steps yang dilakukan.
- Validation bahwa behavior tidak berubah.

---

## MAINTENANCE

```
Change Type    : MAINTENANCE
Risk Level     : LOW
Kategori       : Preventive
Tujuan         : Aktivitas pemeliharaan rutin: membersihkan dead code, memperbarui
                 dokumentasi, merapikan konfigurasi, menghapus deprecated warnings.
```

**Constraint (tidak boleh dilanggar):**

- Tidak mengubah fungsionalitas.
- Perubahan harus aman dan low-risk.
- Dokumentasikan apa yang dihapus dan mengapa.

**Forbidden Changes:**

- Menghapus kode yang masih digunakan.
- Mengubah logic dengan alasan "cleanup".
- Menambah fitur baru.

**Success Criteria:**

- Codebase lebih bersih dan lebih mudah dipelihara.
- Tidak ada functionality yang hilang.
- Test suite tetap pass.

**Output yang Diharapkan:**

- Daftar hal yang dibersihkan/diperbarui.
- Verifikasi tidak ada regresi.

---

## DEPLOYMENT

```
Change Type    : DEPLOYMENT
Risk Level     : MEDIUM-HIGH
Kategori       : Adaptive
Tujuan         : Menerapkan aplikasi ke environment tertentu (staging, production).
                 Fokus pada konfigurasi, infrastructure, dan proses release.
```

**Constraint (tidak boleh dilanggar):**

- Tidak ada perubahan kode aplikasi saat deployment task.
- Pastikan environment target sudah siap.
- Sediakan rollback plan.
- Verifikasi health checks setelah deployment.

**Forbidden Changes:**

- Mengubah application code (itu adalah task terpisah).
- Deploy ke production tanpa staging validation.

**Success Criteria:**

- Aplikasi berjalan dengan benar di environment target.
- Health checks pass.
- Monitoring aktif.
- Rollback tersedia.

**Output yang Diharapkan:**

- Deployment checklist yang completed.
- Post-deployment verification results.
- Rollback procedure.

---

## RELEASE

```
Change Type    : RELEASE
Risk Level     : MEDIUM
Kategori       : Adaptive
Tujuan         : Menyiapkan dan menerbitkan versi resmi software: versioning,
                 changelog, tagging, dan packaging.
```

**Constraint (tidak boleh dilanggar):**

- Tidak ada perubahan kode fungsional di release commit.
- Version number harus mengikuti semantic versioning (atau konvensi yang disepakati).
- CHANGELOG harus akurat dan lengkap.

**Forbidden Changes:**

- Menambah fitur last-minute tanpa melalui review.
- Skip testing sebelum release.

**Success Criteria:**

- Release artifact sudah dibuat dan tersedia.
- CHANGELOG akurat.
- Version tag sudah dibuat.
- Release notes dipublikasikan.

**Output yang Diharapkan:**

- Release checklist yang completed.
- CHANGELOG entry.
- Version tag dan artifact.

---

## Tabel Perbandingan Lengkap

### Kelompok Corrective

| Dimensi            | PATCH | HOTFIX | BUG-FIX |   ROLLBACK   |
| :----------------- | :---: | :----: | :-----: | :----------: |
| Boleh tambah fitur |  ❌   |   ❌   |   ❌    |      ❌      |
| Boleh ubah API     |  ❌   |   ❌   |   ❌    |      ❌      |
| Solusi temporer OK |  ❌   |   ✅   |   ❌    | ✅ sementara |
| Rollback required  |  ❌   |   ✅   |   ❌    |     N/A      |
| Speed > Perfection |  ❌   |   ✅   |   ❌    |      ✅      |
| Test harus pass    |  ✅   |   ⚠️   |   ✅    |      ✅      |

### Kelompok Adaptive

| Dimensi                | MIGRATION | PORTING | DEPLOYMENT | UPDATE | UPGRADE |
| :--------------------- | :-------: | :-----: | :--------: | :----: | :-----: |
| Boleh ubah schema      |    ✅     |   ❌    |     ❌     |   ⚠️   |   ⚠️    |
| Rollback required      |    ✅     |   ✅    |     ✅     |   ⚠️   |   ✅    |
| Boleh ubah API         |    ✅     |   ❌    |     ❌     |   ⚠️   |   ✅    |
| Perlu environment baru |    ⚠️     |   ✅    |     ✅     |   ❌   |   ⚠️    |

### Kelompok Perfective

| Dimensi                | FEATURE | ENHANCEMENT | OPTIMIZATION | MODERNIZATION | REWRITE | REWORK |
| :--------------------- | :-----: | :---------: | :----------: | :-----------: | :-----: | :----: |
| Boleh tambah fitur     |   ✅    |  ⚠️ minor   |      ❌      |      ❌       |   ❌    |   ❌   |
| Behavior boleh berubah |   ✅    |  ⚠️ minor   |      ❌      |      ❌       |   ❌    |   ✅   |
| Test baru diperlukan   |   ✅    |     ⚠️      | ✅ benchmark |      ⚠️       |   ✅    |   ✅   |
| Rollback required      |   ❌    |     ❌      |      ❌      |      ✅       |   ✅    |   ❌   |

### Kelompok Preventive

| Dimensi                  | REFACTOR |  HARDENING  | MAINTENANCE | INTEGRATION |
| :----------------------- | :------: | :---------: | :---------: | :---------: |
| Behavior boleh berubah   |    ❌    | ⚠️ security |     ❌      |     ⚠️      |
| Boleh ubah public API    |    ❌    |     ❌      |     ❌      |     ⚠️      |
| Fitur baru diperbolehkan |    ❌    |     ❌      |     ❌      |     ❌      |
| Benchmark diperlukan     |    ❌    |     ❌      |     ❌      |     ✅      |
