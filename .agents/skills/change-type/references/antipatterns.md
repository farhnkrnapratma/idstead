# Anti-Pattern Guide untuk Change Type Framework

Kegagalan AI coding agent paling sering disebabkan oleh beberapa pola di bawah. Gunakan dokumen ini sebagai checklist sebelum dan selama eksekusi.

---

## AP-01: Scope Creep (Paling Umum)

**Gejala:** Agent menerima instruksi PATCH lalu melakukan refactor seluruh file.

**Contoh buruk:**

```
User: "Fix the null pointer in getUser()"
Agent: Memperbaiki NPE, sekaligus merename variabel, mengekstrak helper function,
       mengganti loop menjadi stream, dan menambah logging.
```

**Cara mencegah:**

- Baca Change Type sebelum eksekusi.
- Tanyakan: "Apakah perubahan ini diminta, atau hanya kebiasaan?"
- Jika menemukan kode buruk di luar scope, **catat** jangan **perbaiki**.

---

## AP-02: Implicit Type Assumption

**Gejala:** User hanya menulis "fix this bug" dan agent mengasumsikan scope sendiri tanpa konfirmasi.

**Contoh buruk:**

```
User: "fix this bug"
Agent: (mengasumsikan FEATURE karena bug memerlukan desain ulang)
       Langsung menulis ulang modul + menambah abstraksi baru.
```

**Cara mencegah:**

- Jika Change Type tidak eksplisit, **tanyakan** sebelum mulai.
- Gunakan pertanyaan: "Apakah ini PATCH (fix minimal) atau BUG-FIX (yang bisa melibatkan lebih banyak file)?"

---

## AP-03: Risk Underestimation

**Gejala:** Agent mengklasifikasikan REFACTOR sebagai LOW risk dan tidak menyediakan rollback information.

**Cara mencegah:**

- Gunakan tabel Risk Level di SKILL.md sebagai patokan default.
- Jika ada keraguan, **eskalasikan risk level**, jangan underestimate.
- Untuk HIGH/VERY HIGH risk: selalu sertakan rollback info dalam output.

---

## AP-04: Menggabungkan Multiple Change Types

**Gejala:** Agent melakukan REFACTOR + BUG-FIX + OPTIMIZATION dalam satu commit.

**Contoh buruk:**

```
"Sekalian saya refactor supaya lebih mudah di-maintain, dan saya juga
optimasi query-nya yang lambat."
```

**Cara mencegah:**

- Satu task = satu Change Type.
- Jika menemukan kebutuhan Change Type berbeda, buat task terpisah.
- Exception: HOTFIX boleh include minimal BUG-FIX jika tidak bisa dipisah.

---

## AP-05: Missing Forbidden Zone Awareness

**Gejala:** Agent mengubah public API saat melakukan PATCH.

**Cara mencegah:**

- Sebelum setiap modifikasi, tanyakan: "Apakah ini termasuk Forbidden Changes untuk Change Type ini?"
- Jika ya, **berhenti dan laporkan** ke user.

---

## AP-06: Test Assumption Error

**Gejala:** Agent mengubah test expectation untuk "menyesuaikan" dengan kode baru, padahal test yang gagal adalah sinyal yang valid.

**Aturan keras:**

- **PATCH / BUG-FIX / HOTFIX**: Tidak boleh mengubah test expectation. Jika test gagal, investigasi kode, bukan ubah test.
- **REFACTOR**: Test harus pass identik, tanpa modifikasi.
- **FEATURE / ENHANCEMENT**: Boleh menambah test baru, tidak mengubah yang lama.

---

## AP-07: Rollback Plan Omission

**Gejala:** Agent melakukan MIGRATION atau UPGRADE tanpa menyediakan rollback procedure dalam outputnya.

**Cara mencegah:**

- Untuk HIGH/VERY HIGH risk Change Type, rollback plan adalah **output wajib**.
- Format minimal rollback: "Untuk kembali ke state sebelumnya: [langkah-langkah]"

---

## AP-08: Premature Optimization

**Gejala:** Agent melakukan OPTIMIZATION tanpa benchmark yang membuktikan ada bottleneck di sana.

**Aturan:**

- OPTIMIZATION task harus dimulai dengan **profiling/benchmark** yang mengidentifikasi bottleneck spesifik.
- "Ini terlihat lambat" bukan justifikasi yang cukup.

---

## Checklist Pre-Execution

Sebelum mulai mengeksekusi perubahan, validasi:

- [ ] Change Type sudah ditentukan secara eksplisit.
- [ ] Scope sudah didefinisikan (file/modul mana yang boleh berubah).
- [ ] Forbidden Changes sudah diketahui.
- [ ] Risk level sudah ditetapkan.
- [ ] Rollback plan tersedia (untuk HIGH/VERY HIGH risk).
- [ ] Success Criteria sudah jelas dan terukur.
