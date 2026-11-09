# Sistem Manajemen Pegawai (Employee Management System)
### Berbasis Google Spreadsheet & Google Apps Script (GAS)

Aplikasi web modern, ringan, dan **100% serverless** untuk mengelola data kepegawaian perusahaan dengan memanfaatkan **Google Spreadsheet** sebagai basis data (*database*) dan **Google Apps Script** sebagai *backend API* serta *hosting antarmuka* (Web App).

---

## 📋 Daftar Isi
1. [Gambaran Umum](#-gambaran-umum)
2. [Fitur-Fitur Utama](#-fitur-fitur-utama)
3. [Arsitektur & Mode Akses](#-arsitektur--mode-akses)
4. [Kriteria Kelengkapan Data](#-kriteria-kelengkapan-data)
5. [Struktur Database Spreadsheet](#-struktur-database-spreadsheet)
6. [Struktur Berkas Proyek](#-struktur-berkas-proyek)
7. [Panduan Instalasi & Konfigurasi Lengkap](#-panduan-instalasi--konfigurasi-lengkap)
8. [Panduan Penggunaan Operasional](#-panduan-penggunaan-operasional)
9. [Troubleshooting & Tips](#-troubleshooting--tips)

---

## 🌟 Gambaran Umum

Aplikasi ini dirancang untuk menjawab kebutuhan tim HR / Personalia dalam mengelola data karyawan di berbagai anak perusahaan atau divisi tanpa memerlukan server khusus, database berbayar, atau infrastruktur rumit. Seluruh data tersimpan aman di Google Drive milik organisasi.

### Mengapa Solusi Ini Efisien?
- **Zero Cost Infrastructure:** Tidak memerlukan hosting atau database bulanan; memanfaatkan kuota gratis Google Workspace / Akun Google pribadi.
- **Data Kepemilikan Penuh:** Seluruh data berada langsung di Google Spreadsheet Anda, mudah diekspor ke Excel, PDF, atau diolah dengan Google Data Studio / Looker Studio.
- **Dual Mode Interface:** Memisahkan secara ketat portal kelola HR (Admin) dengan formulir pengisian mandiri karyawan (*Self-Service*).

---

## ✨ Fitur-Fitur Utama

### 1. 🏢 Manajemen Multi-Perusahaan & Jabatan
- Pengelolaan master data perusahaan (nama, email kantor, telepon, alamat, website).
- Pengelolaan master jabatan yang terhubung dinamis (*cascading filter*) per unit perusahaan.

### 2. ⚡ Onboarding Cepat (*Quick Onboard*)
- Admin HR tidak perlu menunggu seluruh berkas terkumpul untuk mendaftarkan pegawai baru.
- Cukup isi **Nama Panggilan**, **Nomor Telepon / WhatsApp**, serta **Perusahaan & Jabatan**.
- Data langsung tersimpan dan tautan pengisian mandiri langsung dapat dikirimkan ke pegawai.

### 3. 🔗 Formulir Pengisian Mandiri Pegawai (*Self-Service Form*)
- Pegawai menerima tautan unik berenkripsi token UUID (`?token=xxxxxxxx-xxxx-...`).
- **Terisolasi:** Pegawai tidak dapat mengakses dashboard admin, menu navigasi, atau melihat data pegawai lain.
- **Terkunci Otomatis:** Pegawai yang berstatus Resign atau telah diarsipkan tautannya otomatis ditutup demi keamanan.
- Pegawai dapat mengisi NIK KTP, Nama Lengkap resmi, Tempat & Tanggal Lahir, Alamat Domisili, Pendidikan, Agama, Jenis Kelamin, Golongan Darah, hingga Rekening Bank Payroll.

### 4. 📊 Audit Kelengkapan Data Realtime
- Penghitungan persentase kelengkapan data secara interaktif dan seragam antara Admin dan Formulir Mandiri.
- Kartu peringatan khusus (*Alert Banner*) pada dashboard yang menampilkan pegawai mana saja yang datanya belum lengkap beserta kolom yang masih kosong.

### 5. 💳 Informasi Rekening Bank Payroll
- Mendukung pilihan bank: **BRI**, **BNI**, **BTN**, **Mandiri**, dan **Syariah**.
- Dilengkapi kolom Nomor Rekening untuk keperluan penggajian (*payroll*).

### 6. 📦 Sistem Arsip & Resign (Tanpa Hapus Fisik)
- Menghindari kehilangan riwayat data (*data loss*); tombol hapus permanen ditiadakan.
- Pegawai yang tidak aktif/resign diarsipkan dengan mencatat **Tanggal Resign** dan **Keterangan / Alasan Resign**.
- Tab filter khusus **"Arsip / Resign"** untuk audit historis, lengkap dengan tombol **"Pulihkan"** jika pegawai kembali aktif.

### 7. 📲 Multi-Channel Reminder (WhatsApp & Email)
- Tombol integrasi langsung ke WhatsApp Web / Aplikasi WhatsApp (`wa.me`) dengan template pesan personalisasi otomatis yang menyebutkan kolom apa saja yang belum terisi beserta link mandirinya.
- Fitur kirim email pengingat langsung via akun Gmail terintegrasi.

---

## 🏛 Arsitektur & Mode Akses

Aplikasi dijalankan dalam satu URL Web App Google Apps Script dengan router otomatis:

```
┌─────────────────────────────────────────────────────────────┐
│                 Google Apps Script Web App                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
            Apakah parameter ?token=UUID ada?
                               │
               ┌───────────────┴───────────────┐
              TIDAK                           ADA
               │                               │
        [PORTAL ADMIN]                Cek Status Pegawai
       Diproteksi PIN                  di Google Sheets
       (Default: 123456)                       │
               │                       ┌───────┴───────┐
               ▼                    AKTIF            RESIGN
    • Dashboard & KPI Ringkasan        │               │
    • Kelola Perusahaan & Posisi       ▼               ▼
    • Kelola & Arsip Pegawai     [FORM MANDIRI]  [AKSES DITUTUP]
    • Blast Reminder WA & Email   Lengkapi Bio    Pemberitahuan
                                 & Rekening Bank Formulir Non-Aktif
```

---

## 🎯 Kriteria Kelengkapan Data

Agar persentase antara halaman Admin dan formulir mandiri pegawai **100% konsisten**, standar kelengkapan dinilai dari **6 Kriteria Pokok**:

| No | Kriteria | Keterangan | Bobot |
|:---:|:---|:---|:---:|
| 1 | **NIK** | 16 digit nomor induk kependudukan KTP | ~16.67% |
| 2 | **Nama Lengkap** | Nama resmi pegawai sesuai KTP | ~16.67% |
| 3 | **Nomor Telepon / WA** | Nomor seluler yang aktif | ~16.67% |
| 4 | **Alamat Domisili** | Alamat tempat tinggal saat ini | ~16.67% |
| 5 | **Perusahaan** | Unit penempatan kerja (oleh Admin) | ~16.67% |
| 6 | **Jabatan** | Posisi pekerjaan (oleh Admin) | ~16.67% |

> **Catatan:**
> - Saat Admin melakukan *Quick Onboard* (isi No Telp, Perusahaan, & Jabatan), kelengkapan awal adalah **50% (3/6)**.
> - Setelah pegawai melengkapi NIK, Nama Lengkap, dan Alamat Domisili, status otomatis menjadi **100% (LENGKAP)**.
> - Kolom BPJS Kesehatan, BPJS Ketenagakerjaan, dan Rekening Bank dicatat sebagai data administratif/payroll dan tidak menghambat pegawai mencapai status 100%.

---

## 🗄 Struktur Database Spreadsheet

Generator database otomatis akan membuat 4 sheet di Google Spreadsheet:

### 1. Sheet `Perusahaan`
`id_perusahaan`, `nama_perusahaan`, `email_perusahaan`, `telepon_perusahaan`, `alamat_perusahaan`, `website_perusahaan`, `created_at`

### 2. Sheet `Jabatan`
`id_jabatan`, `id_perusahaan`, `nama_jabatan`, `departemen`, `deskripsi`, `created_at`

### 3. Sheet `Pegawai` (34 Kolom Terstruktur)
1. `id_pegawai` (contoh: EMP-1001)
2. `nik` (16 digit)
3. `nama_lengkap` (nama KTP)
4. `nama_panggilan` (sapaan personal)
5. `nomor_telepon` (WhatsApp)
6. `email` (email pribadi/kantor)
7. `tempat_lahir`
8. `tanggal_lahir`
9. `jenis_kelamin` (Laki-laki / Perempuan)
10. `agama` (Islam, Kristen, Katolik, Hindu, Buddha, Konghucu)
11. `golongan_darah` (A, B, AB, O)
12. `pendidikan` (SMA/SMK, D3, S1, S2, S3)
13. `jurusan`
14. `alamat_domisili`
15. `bpjs_kesehatan` (Checkbox TRUE/FALSE)
16. `keterangan_bpjs_kesehatan` (Nomor Kartu / Keterangan)
17. `bpjs_tenaga_kerja` (Checkbox TRUE/FALSE)
18. `keterangan_bpjs_tenaga_kerja` (Nomor KPJ / Keterangan)
19. `nama_bank` (BRI, BNI, BTN, Mandiri, Syariah)
20. `nomor_rekening` (Nomor Rekening Payroll)
21. `id_perusahaan` (Relasi ke sheet Perusahaan)
22. `id_jabatan` (Relasi ke sheet Jabatan)
23. `status_pegawai` (Tetap, Kontrak, Magang, Probation)
24. `status_bekerja` (Aktif / Resign)
25. `tanggal_awal_bekerja`
26. `tanggal_resign` (Tercatat otomatis saat diarsipkan)
27. `keterangan_resign` (Alasan resign saat diarsipkan)
28. `is_archived` (Checkbox TRUE/FALSE)
29. `edit_token` (UUID unik tautan mandiri)
30. `status_kelengkapan` (LENGKAP / BELUM_LENGKAP)
31. `persentase_kelengkapan` (0 - 100%)
32. `kolom_belum_lengkap` (Daftar nama kolom yang masih kosong)
33. `last_self_updated_at` (Waktu terakhir pegawai update mandiri)
34. `created_at`

### 4. Sheet `Pengaturan`
Menyimpan konfigurasi kunci-nilai:
- `ADMIN_PIN`: PIN otentikasi login admin (default: `123456`).
- `APP_NAME`: Nama sistem/perusahaan yang tampil di header aplikasi.
- `WA_TEMPLATE`: Format template pesan pengingat WhatsApp kustom.

---

## 📁 Struktur Berkas Proyek

Di repositori lokal atau di Apps Script Editor, proyek terdiri dari:

```
Google Spreadsheet Employee Management System/
├── appsscript.json          # Manifest konfigurasi Google Apps Script
├── Code.js                  # Entry point GAS: doGet router & handler API
├── Database.js              # Abstraksi database CRUD & generator sheet
├── CompletenessService.js   # Audit kelengkapan data & generator pesan WA/Email
├── Index.html               # Antarmuka Admin SPA (Dashboard, Perusahaan, Pegawai)
├── SelfService.html         # Antarmuka Formulir Mandiri Pegawai (Responsive Mobile)
├── Styles.html              # Custom styling & utility classes
├── Scripts.html             # Client-side JavaScript untuk dashboard admin
├── SETUP_GUIDE.md           # Panduan teknis instalasi singkat
└── READ_ME.md               # Dokumentasi utama proyek (berkas ini)
```

---

## 🚀 Panduan Instalasi & Konfigurasi Lengkap

Ikuti langkah-langkah berikut untuk memasang aplikasi dari awal:

### Langkah 1: Buat Google Spreadsheet Baru
1. Masuk ke akun Google Anda dan buka [Google Sheets](https://sheets.new).
2. Beri nama dokumen spreadsheet, contohnya: **`Database HR Kepegawaian`**.

### Langkah 2: Buka Apps Script Editor
1. Pada menu atas spreadsheet, klik **Ekstensi (Extensions)** > **Apps Script**.
2. Beri nama proyek skrip di pojok kiri atas, misalnya: **`Web App Kepegawaian`**.

### Langkah 3: Salin File Kode ke Editor
Pada panel kiri Apps Script (*Files*), buat berkas-berkas berikut sesuai tipenya:

#### A. File Skrip (.gs)
1. **`Code.gs`** (gantikan isi file bawaan) &larr; salin dari [`Code.js`](file:///d:/Project/Google%20Spreadsheet%20Employee%20Management%20System/Code.js)
2. **`Database.gs`** (klik `+` > Script > beri nama `Database`) &larr; salin dari [`Database.js`](file:///d:/Project/Google%20Spreadsheet%20Employee%20Management%20System/Database.js)
3. **`CompletenessService.gs`** (klik `+` > Script > beri nama `CompletenessService`) &larr; salin dari [`CompletenessService.js`](file:///d:/Project/Google%20Spreadsheet%20Employee%20Management%20System/CompletenessService.js)

#### B. File Antarmuka (.html)
1. **`Index.html`** (klik `+` > HTML > beri nama `Index`) &larr; salin dari [`Index.html`](file:///d:/Project/Google%20Spreadsheet%20Employee%20Management%20System/Index.html)
2. **`SelfService.html`** (klik `+` > HTML > beri nama `SelfService`) &larr; salin dari [`SelfService.html`](file:///d:/Project/Google%20Spreadsheet%20Employee%20Management%20System/SelfService.html)
3. **`Styles.html`** (klik `+` > HTML > beri nama `Styles`) &larr; salin dari [`Styles.html`](file:///d:/Project/Google%20Spreadsheet%20Employee%20Management%20System/Styles.html)
4. **`Scripts.html`** (klik `+` > HTML > beri nama `Scripts`) &larr; salin dari [`Scripts.html`](file:///d:/Project/Google%20Spreadsheet%20Employee%20Management%20System/Scripts.html)

#### C. Manifest `appsscript.json`
1. Di panel kiri, klik **Project Settings** (ikon gerigi ⚙️).
2. Centang opsi **"Show 'appsscript.json' manifest file in editor"**.
3. Kembali ke editor (`< >`), buka file `appsscript.json`, dan pastikan isinya:
   ```json
   {
     "timeZone": "Asia/Jakarta",
     "dependencies": {},
     "exceptionLogging": "STACKDRIVER",
     "runtimeVersion": "V8",
     "webapp": {
       "executeAs": "USER_DEPLOYING",
       "access": "ANYONE"
     }
   }
   ```

### Langkah 4: Inisialisasi Database Otomatis
1. Pada toolbar atas Apps Script Editor, pilih fungsi **`initDatabase`** dari daftar dropdown fungsi.
2. Klik tombol **Run (Jalankan)** (ikon ▶️).
3. Saat pop-up otorisasi muncul:
   - Klik **Review Permissions** &rarr; Pilih akun Google Anda.
   - Klik **Advanced (Lanjutan)** &rarr; Klik **Go to Web App Kepegawaian (unsafe)**.
   - Klik **Allow (Izinkan)**.
4. Buka kembali tab Google Spreadsheet Anda:
   - Sheet `Perusahaan`, `Jabatan`, `Pegawai`, dan `Pengaturan` telah terbuat lengkap beserta sampel data awal.

### Langkah 5: Penerapan Web App (Deploy)
1. Di pojok kanan atas Apps Script Editor, klik **Deploy (Terapkan)** > **New deployment (Penerapan baru)**.
2. Klik ikon gerigi ⚙️ di samping *"Select type"* > pilih **Web app**.
3. Konfigurasikan:
   - **Description:** Versi 1.0 (atau deskripsi lain).
   - **Execute as (Jalankan sebagai):** **`Me (emailanda@gmail.com)`** *(WAJIB)*.
   - **Who has access (Siapa yang memiliki akses):** **`Anyone (Siapa saja)`** *(WAJIB agar tautan mandiri pegawai dapat diakses tanpa login akun Google)*.
4. Klik **Deploy**.
5. Salin tautan **Web App URL** yang diberikan (akhiran `/exec`). Tautan ini adalah alamat utama aplikasi Anda.

---

## 📖 Panduan Penggunaan Operasional

### 1. Masuk ke Dashboard Admin
1. Buka Web App URL di browser.
2. Masukkan PIN keamanan default: **`123456`**.
3. Anda akan melihat ringkasan KPI (Total Pegawai, Pegawai Lengkap, Belum Lengkap, Perusahaan & Jabatan) dan daftar pegawai yang membutuhkan tindak lanjut kelengkapan data.

### 2. Mendaftarkan Pegawai Baru (Onboarding Cepat)
1. Masuk ke menu **Pegawai** > Klik **"Tambah Pegawai"**.
2. Masukkan data pokok awal:
   - **Nama Panggilan** (misal: `Budi`)
   - **Nomor Telepon / WhatsApp** (misal: `081234567890`)
   - **Perusahaan** & **Jabatan**
3. Klik **Simpan Pegawai**.
4. Pegawai langsung tersimpan dengan persentase kelengkapan 50%.

### 3. Mengirimkan Tautan Pengisian Mandiri
Pada baris pegawai yang baru didaftarkan:
- **Kirim WhatsApp Langsung:** Klik ikon **WhatsApp** (hijau). WhatsApp Web atau aplikasi WA akan terbuka dengan teks pesan yang telah disiapkan otomatis beserta link mandiri ber-token.
- **Salin Tautan:** Klik ikon **Salin Link** (biru) untuk mengirimkan link via pesan pribadi atau Telegram.
- **Kirim Email:** Klik opsi email jika email pegawai telah terdata.

### 4. Pengisian oleh Pegawai
1. Pegawai membuka tautan dari ponsel atau laptop (`.../exec?token=xxx`).
2. Tampil ucapan *"Halo, [Nama Panggilan]!"* dengan indikator progress bar kelengkapan data.
3. Pegawai mengisi NIK resmi KTP, Nama Lengkap, Tempat & Tanggal Lahir, Alamat Domisili, Pendidikan, serta memilih Nama Bank (BRI/BNI/BTN/Mandiri/Syariah) dan Nomor Rekeningnya.
4. Saat mengetik, persentase kelengkapan bertambah secara interaktif (*live*).
5. Klik **"Simpan & Perbarui Data"**.
6. Data langsung tersimpan seketika di Google Spreadsheet dan progress bar berubah menjadi **100% (Data Lengkap)**.

### 5. Mengarsipkan Pegawai Resign
1. Pada menu Pegawai, cari pegawai yang telah mengundurkan diri.
2. Klik tombol **Arsip (Resign)** (ikon folder/arsip kuning).
3. Isi **Tanggal Efektif Resign** dan **Alasan / Keterangan Resign**.
4. Klik **Konfirmasi Arsipkan Pegawai**.
5. Status pegawai otomatis berubah menjadi `Resign`, masuk ke tab **"Arsip / Resign"**, dan tautan mandirinya seketika dinonaktifkan sehingga tidak dapat diubah lagi.

### 6. Memulihkan (*Restore*) Pegawai
1. Buka tab filter **"Arsip / Resign"** di menu Pegawai.
2. Cari pegawai yang bersangkutan, lalu klik tombol **"Pulihkan"**.
3. Status pegawai akan kembali aktif dan masuk kembali ke daftar pegawai aktif.

---

## 🔧 Troubleshooting & Tips

### 1. Bagaimana cara mengubah PIN Admin?
Buka Google Spreadsheet &rarr; Sheet **`Pengaturan`** &rarr; Ubah nilai pada baris **`ADMIN_PIN`** sesuai PIN baru yang Anda inginkan (misal: `889900`). Perubahan langsung berlaku secara realtime tanpa perlu redeploy.

### 2. Bagaimana cara mengubah Nama Aplikasi atau Template WhatsApp?
Buka Google Spreadsheet &rarr; Sheet **`Pengaturan`**:
- Ubah baris `APP_NAME` untuk mengganti nama sistem.
- Ubah baris `WA_TEMPLATE` untuk menyesuaikan kalimat pengingat WhatsApp. Tag yang didukung: `{NAMA}`, `{STATUS}`, `{PERSENTASE}`, `{KOLOM_KOSONG}`, dan `{LINK}`.

### 3. Tautan Mandiri Pegawai Muncul Error "Tautan Tidak Valid"
Pastikan parameter `?token=` yang disalin lengkap dan tidak terpotong. Token UUID terdiri dari 36 karakter alfanumerik. Jika pegawai berstatus Resign, sistem akan menampilkan halaman bahwa formulir telah ditutup.

### 4. Jika Ada Perubahan Kode di Apps Script
Setiap kali Anda mengubah kode di Apps Script Editor, jangan lupa untuk membuat deployment versi baru agar perubahannya aktif di publik:
- Klik **Deploy** &rarr; **Manage deployments (Kelola penerapan)**.
- Klik ikon pensil ✏️ &rarr; Pada dropdown *Version*, pilih **New version (Versi baru)** &rarr; Klik **Deploy**.

### 5. Angka Nol di Awal (Leading Zero) Terpotong di Spreadsheet
Secara default, Google Sheets memperlakukan input angka seperti `0852...` sebagai integer sehingga angka `0` terpotong menjadi `852...`. Sistem aplikasi ini telah dilengkapi proteksi otomatis:
- Semua kolom teks-numerik (Nomor Telepon, NIK 16 digit, Nomor Rekening, Nomor BPJS, dan PIN) otomatis disimpan dengan prefix petik tunggal (`'`) dan format Plain Text (`@`).
- Jika Anda memiliki data lama yang angka nolnya sudah terlanjur hilang di Google Sheets, buka Apps Script Editor &rarr; pilih fungsi **`repairNumericColumns`** pada dropdown toolbar &rarr; klik **Run (Jalankan)**. Seluruh kolom numerik akan langsung diperbaiki dan angka nol di awal akan dipulihkan secara otomatis.

---

## 📄 Lisensi & Kontribusi
Aplikasi ini dikembangkan sebagai solusi pengelolaan SDM mandiri berbasis ekosistem Google Workspace. Bebas disesuaikan dan dikembangkan sesuai kebutuhan operasional masing-masing organisasi.