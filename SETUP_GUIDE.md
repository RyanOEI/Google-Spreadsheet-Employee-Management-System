# Panduan Setup & Deployment: Sistem Manajemen Pegawai (Google Spreadsheet & Apps Script)

Aplikasi web ini menggunakan **Google Spreadsheet** sebagai basis data (*database*) dan **Google Apps Script (GAS)** sebagai *backend API* serta *hosting antarmuka web* (Web App).

Sistem memiliki dua mode akses:
1. **Portal Admin HR (`/exec`):** Diproteksi PIN keamanan (`123456`) untuk mengelola perusahaan, jabatan, pegawai, memantau alert kelengkapan data, mencatat rekening bank, mengarsipkan pegawai resign beserta keterangannya, dan membagikan link onboarding mandiri via WhatsApp / Email.
2. **Formulir Mandiri Pegawai (`/exec?token=UUID`):** Halaman khusus terisolasi bagi pegawai untuk melengkapi biodata pribadi, konfirmasi BPJS, serta rekening bank secara mandiri tanpa akses ke data kantor/admin lainnya. Link otomatis terkunci jika pegawai berstatus Resign.

---

## Langkah 1: Buat Google Spreadsheet Baru

1. Buka browser dan kunjungi [Google Sheets](https://sheets.new) untuk membuat spreadsheet baru.
2. Beri nama spreadsheet Anda, misalnya: **`Database Manajemen Pegawai HR`**.

---

## Langkah 2: Buka Google Apps Script Editor

1. Pada menu navigasi Google Spreadsheet di atas, klik menu **Ekstensi (Extensions)** > **Apps Script**.
2. Tab baru Apps Script Editor akan terbuka. Beri judul proyek script di pojok kiri atas, misalnya **`Web App Kepegawaian`**.

---

## Langkah 3: Masukkan Seluruh File Kode

Di dalam Google Apps Script Editor sebelah kiri, klik tanda `+` di sebelah menu *Files/Berkas* untuk membuat file:

### A. File Script (.gs / .js)
1. **`Code.gs`** (atau ganti isi `Code.gs` bawaan):
   - Salin seluruh isi dari file lokal: [`Code.js`](./Code.js)
2. **`Database.gs`** (Klik `+` > Script > beri nama `Database`):
   - Salin seluruh isi dari file lokal: [`Database.js`](./Database.js)
3. **`CompletenessService.gs`** (Klik `+` > Script > beri nama `CompletenessService`):
   - Salin seluruh isi dari file lokal: [`CompletenessService.js`](./CompletenessService.js)

### B. File Antarmuka HTML (.html)
1. **`Index.html`** (Klik `+` > HTML > beri nama `Index`):
   - Salin seluruh isi dari file lokal: [`Index.html`](./Index.html)
2. **`SelfService.html`** (Klik `+` > HTML > beri nama `SelfService`):
   - Salin seluruh isi dari file lokal: [`SelfService.html`](./SelfService.html)
3. **`Styles.html`** (Klik `+` > HTML > beri nama `Styles`):
   - Salin seluruh isi dari file lokal: [`Styles.html`](./Styles.html)
4. **`Scripts.html`** (Klik `+` > HTML > beri nama `Scripts`):
   - Salin seluruh isi dari file lokal: [`Scripts.html`](./Scripts.html)

### C. Konfigurasi Manifest (`appsscript.json`)
1. Di Apps Script Editor, klik **Project Settings** (ikon roda gigi di menu sebelah kiri).
2. Centang **"Show 'appsscript.json' manifest file in editor"**.
3. Kembali ke menu editor (ikon `< >`), buka `appsscript.json`, lalu pastikan `"timeZone": "Asia/Jakarta"`.

---

## Langkah 4: Jalankan Inisialisasi Database Otomatis (`initDatabase`)

Skrip telah dilengkapi generator otomatis:
1. Di toolbar Apps Script Editor, pilih fungsi **`initDatabase`**.
2. Klik tombol **Run (Jalankan)** (ikon segitiga ▶️).
3. **Otorisasi Izin (Hanya Pertama Kali):**
   - Klik **Review Permissions** > Pilih akun Google Anda.
   - Klik **Advanced (Lanjutan)** > Klik **Go to Web App Kepegawaian (unsafe)** > Klik **Allow (Izinkan)**.
4. Periksa Google Spreadsheet Anda! 4 sheet telah otomatis terbuat dengan 34 kolom terstruktur di sheet `Pegawai`:
   - 🏢 Sheet `Perusahaan`
   - 💼 Sheet `Jabatan`
   - 👥 Sheet `Pegawai` (termasuk kolom BPJS, Rekening Bank `nama_bank` & `nomor_rekening`, serta kolom arsip `keterangan_resign` & `is_archived`)
   - ⚙️ Sheet `Pengaturan` (PIN Admin default: `123456`)

---

## Langkah 5: Deploy Menjadi Web App

1. Klik tombol **Deploy (Terapkan)** di pojok kanan atas > pilih **New deployment (Penerapan baru)**.
2. Klik ikon gerigi ⚙️ di samping *"Select type"* > pilih **Web app**.
3. Atur konfigurasi berikut:
   - **Execute as (Jalankan sebagai):** **`Me (emailanda@gmail.com)`** *(PENTING)*
   - **Who has access (Siapa yang memiliki akses):** **`Anyone (Siapa saja)`** *(PENTING agar tautan mandiri pegawai dapat dibuka tanpa kendala izin login)*
4. Klik **Deploy (Terapkan)** lalu salin **Web App URL** Anda.

---

## Langkah 6: Cara Penggunaan Fitur Baru

### 1. Onboarding Cepat (Hanya Nama Panggilan & No WA)
1. Buka Web App Admin, login dengan PIN `123456`.
2. Klik tombol **"Tambah Pegawai"**.
3. Cukup isi:
   - **Nama Panggilan** (misal: `Rian`)
   - **Nomor Telepon / WhatsApp** (misal: `081234567890`)
   - **Perusahaan** & **Jabatan**
4. Klik Simpan. Form langsung tersimpan tanpa memblokir input NIK atau Alamat!
5. Klik tombol **WhatsApp** atau **Salin Link** pada baris pegawai tersebut untuk mengirimkan link mandiri ke pegawai.

### 2. Pengisian Mandiri oleh Pegawai
1. Pegawai membuka tautan dari ponselnya.
2. Tampil sapaan hangat: *"Halo, Rian!"*.
3. Pegawai melengkapi Nama Lengkap resmi KTP, NIK, Alamat, centang BPJS, serta memilih Bank (BRI, BNI, BTN, Mandiri, atau Syariah) dan mengisi Nomor Rekeningnya.
4. Klik **Simpan Pembaruan Data**.
5. Sistem Google Sheets seketika terupdate dan status pegawai menjadi **LENGKAP (100%)**.

### 3. Mengarsipkan Pegawai Resign (Pengganti Hapus Data)
1. Ketika ada pegawai yang mengundurkan diri, klik tombol **Arsipkan** (ikon box oranye) pada tabel pegawai.
2. Masukkan tanggal resign dan keterangan/alasan pengunduran diri.
3. Klik simpan konfirmasi:
   - Pegawai berpindah ke tab filter **Arsip / Resign**.
   - Data historis tetap tersimpan utuh di Spreadsheet (tidak ada penghapusan baris).
   - Link pengisian mandiri milik pegawai tersebut otomatis **terkunci / ditutup**.
4. Jika di masa depan pegawai tersebut kembali bergabung, Admin cukup menekan tombol **"Pulihkan"** di tab Arsip untuk mengaktifkannya kembali.
