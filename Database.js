/**
 * Database.js
 * Abstraksi basis data menggunakan Google Spreadsheet sebagai backend penyimpanan.
 * Mengelola sheet: Perusahaan, Jabatan, Pegawai, dan Pengaturan.
 */

const DB = {
  SHEET_NAMES: {
    PERUSAHAAN: 'Perusahaan',
    JABATAN: 'Jabatan',
    PEGAWAI: 'Pegawai',
    PENGATURAN: 'Pengaturan'
  },

  /**
   * Mengambil referensi Spreadsheet aktif
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
   */
  getSpreadsheet: function() {
    try {
      const active = SpreadsheetApp.getActiveSpreadsheet();
      if (active) return active;
    } catch (e) {}

    const ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (ssId) {
      return SpreadsheetApp.openById(ssId);
    }
    throw new Error('Spreadsheet tidak ditemukan. Pastikan script ini terikat (container-bound) pada Google Spreadsheet atau telah diset SPREADSHEET_ID pada Script Properties.');
  },

  /**
   * Mengambil sheet berdasarkan nama
   * @param {string} sheetName
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getSheet: function(sheetName) {
    const ss = this.getSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    return sheet;
  },

  /**
   * Memformat nilai sebelum ditulis ke Google Sheets.
   * Mencegah pemotongan angka nol di awal (leading zero) dan konversi eksponensial (scientific)
   * untuk semua field numerik (nomor telepon, NIK, nomor rekening, nomor BPJS, PIN, dll).
   */
  formatValueForSheet: function(key, val) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'boolean') return val;

    const keyLower = String(key || '').trim().toLowerCase();
    let strVal = String(val).trim();
    if (strVal === '') return '';

    // Kolom-kolom yang wajib disimpan sebagai teks murni
    const textNumericKeys = [
      'nik',
      'nomor_telepon',
      'telepon',
      'telepon_perusahaan',
      'nomor_rekening',
      'keterangan_bpjs_kesehatan',
      'keterangan_bpjs_tenaga_kerja',
      'edit_token',
      'admin_pin'
    ];

    const isExplicitNumericKey = textNumericKeys.includes(keyLower) ||
                                keyLower.includes('telepon') ||
                                keyLower.includes('rekening') ||
                                keyLower.includes('nik') ||
                                keyLower.includes('bpjs') ||
                                keyLower.includes('pin');

    // Khusus nomor telepon Indonesia: jika diinput tanpa '0' di depan (misal: 852xxxxxx), kembalikan '0'
    if (keyLower.includes('telepon') && /^8[1-9]\d{7,11}$/.test(strVal)) {
      strVal = '0' + strVal;
    }

    // Jika field numerik atau teks yang diawali '0' diikuti angka (contoh: 0852..., 021..., 0001...)
    // atau digit murni panjang (>= 8 digit, seperti NIK / No Rekening agar tidak jadi float/scientific),
    // simpan dengan prefix petik tunggal (') agar Google Sheets selalu menyimpannya sebagai Plain Text murni.
    if (isExplicitNumericKey || /^0\d+$/.test(strVal) || /^\d{8,}$/.test(strVal)) {
      return "'" + strVal.replace(/^'+/, '');
    }

    return strVal;
  },

  /**
   * Mengonversi seluruh baris sheet menjadi array of object
   * Baris 1 dianggap sebagai header key
   */
  sheetToObjects: function(sheet) {
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const result = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0] === '' && row[1] === '') continue;

      const obj = { _rowIndex: i + 1 };
      for (let j = 0; j < headers.length; j++) {
        let val = row[j];
        const key = headers[j];

        if (val instanceof Date) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
        } else if (typeof val === 'number') {
          // Pulihkan angka yang terpotong leading zero oleh Google Sheets
          const strNum = String(val);
          if (key.includes('telepon') && /^8[1-9]\d{7,11}$/.test(strNum)) {
            val = '0' + strNum;
          } else {
            val = strNum.replace(/\.0+$/, '');
          }
        } else if (typeof val === 'string') {
          val = val.replace(/^'+/, '').trim();
          if (key.includes('telepon') && /^8[1-9]\d{7,11}$/.test(val)) {
            val = '0' + val;
          }
        }

        obj[key] = val;
      }
      result.push(obj);
    }
    return result;
  },

  // ==========================================
  // MASTER DATA: PERUSAHAAN
  // ==========================================
  getPerusahaanHeaders: function() {
    return ['id_perusahaan', 'nama_perusahaan', 'email', 'telepon', 'alamat', 'website', 'created_at'];
  },

  getPerusahaanList: function() {
    const sheet = this.getSheet(this.SHEET_NAMES.PERUSAHAAN);
    return this.sheetToObjects(sheet);
  },

  savePerusahaan: function(data) {
    const sheet = this.getSheet(this.SHEET_NAMES.PERUSAHAAN);
    const headers = this.getPerusahaanHeaders();
    const rows = this.sheetToObjects(sheet);
    const isNew = !data.id_perusahaan;
    const id = isNew ? ('COMP-' + Date.now().toString().slice(-6)) : data.id_perusahaan;
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');

    data.id_perusahaan = id;
    if (isNew) {
      data.created_at = now;
      const rowValues = headers.map(h => this.formatValueForSheet(h, data[h]));
      sheet.appendRow(rowValues);
    } else {
      const target = rows.find(r => r.id_perusahaan === id);
      if (!target) throw new Error('Data perusahaan tidak ditemukan.');
      const rowValues = headers.map(h => {
        if (h === 'created_at') return target.created_at || now;
        const raw = data[h] !== undefined ? data[h] : (target[h] || '');
        return this.formatValueForSheet(h, raw);
      });
      sheet.getRange(target._rowIndex, 1, 1, headers.length).setValues([rowValues]);
    }
    return { success: true, id_perusahaan: id };
  },

  deletePerusahaan: function(id) {
    const sheet = this.getSheet(this.SHEET_NAMES.PERUSAHAAN);
    const rows = this.sheetToObjects(sheet);
    const target = rows.find(r => r.id_perusahaan === id);
    if (!target) throw new Error('Data perusahaan tidak ditemukan.');

    const jabatanList = this.getJabatanList().filter(j => j.id_perusahaan === id);
    const pegawaiList = this.getPegawaiList().filter(p => p.id_perusahaan === id && !p.is_archived);

    if (jabatanList.length > 0 || pegawaiList.length > 0) {
      throw new Error(`Tidak dapat menghapus: Perusahaan ini memiliki ${jabatanList.length} jabatan dan ${pegawaiList.length} pegawai aktif terdaftar.`);
    }

    sheet.deleteRow(target._rowIndex);
    return { success: true };
  },

  // ==========================================
  // MASTER DATA: JABATAN
  // ==========================================
  getJabatanHeaders: function() {
    return ['id_jabatan', 'id_perusahaan', 'nama_jabatan', 'departemen', 'keterangan', 'created_at'];
  },

  getJabatanList: function() {
    const sheet = this.getSheet(this.SHEET_NAMES.JABATAN);
    const list = this.sheetToObjects(sheet);
    const compMap = {};
    this.getPerusahaanList().forEach(c => {
      compMap[c.id_perusahaan] = c.nama_perusahaan;
    });

    return list.map(j => {
      j.nama_perusahaan = compMap[j.id_perusahaan] || 'Perusahaan Tidak Dikenal';
      return j;
    });
  },

  saveJabatan: function(data) {
    const sheet = this.getSheet(this.SHEET_NAMES.JABATAN);
    const headers = this.getJabatanHeaders();
    const rows = this.sheetToObjects(sheet);
    const isNew = !data.id_jabatan;
    const id = isNew ? ('POS-' + Date.now().toString().slice(-6)) : data.id_jabatan;
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');

    data.id_jabatan = id;
    if (isNew) {
      data.created_at = now;
      const rowValues = headers.map(h => data[h] !== undefined ? data[h] : '');
      sheet.appendRow(rowValues);
    } else {
      const target = rows.find(r => r.id_jabatan === id);
      if (!target) throw new Error('Data jabatan tidak ditemukan.');
      const rowValues = headers.map(h => {
        if (h === 'created_at') return target.created_at || now;
        return data[h] !== undefined ? data[h] : (target[h] || '');
      });
      sheet.getRange(target._rowIndex, 1, 1, headers.length).setValues([rowValues]);
    }
    return { success: true, id_jabatan: id };
  },

  deleteJabatan: function(id) {
    const sheet = this.getSheet(this.SHEET_NAMES.JABATAN);
    const rows = this.sheetToObjects(sheet);
    const target = rows.find(r => r.id_jabatan === id);
    if (!target) throw new Error('Data jabatan tidak ditemukan.');

    const pegawaiList = this.getPegawaiList().filter(p => p.id_jabatan === id && !p.is_archived);
    if (pegawaiList.length > 0) {
      throw new Error(`Tidak dapat menghapus: Terdapat ${pegawaiList.length} pegawai aktif dengan jabatan ini.`);
    }

    sheet.deleteRow(target._rowIndex);
    return { success: true };
  },

  // ==========================================
  // MASTER DATA: PEGAWAI (34 KOLOM TERSTRUKTUR)
  // ==========================================
  getPegawaiHeaders: function() {
    return [
      'id_pegawai',
      'nik',
      'nama_lengkap',
      'nama_panggilan',
      'nomor_telepon',
      'email',
      'tempat_lahir',
      'tanggal_lahir',
      'jenis_kelamin',
      'agama',
      'golongan_darah',
      'pendidikan',
      'jurusan',
      'alamat_domisili',
      'bpjs_kesehatan',
      'keterangan_bpjs_kesehatan',
      'bpjs_tenaga_kerja',
      'keterangan_bpjs_tenaga_kerja',
      'nama_bank',             // Pilihan: BRI, BNI, BTN, Mandiri, Syariah
      'nomor_rekening',        // Nomor rekening bank
      'id_perusahaan',
      'id_jabatan',
      'status_pegawai',
      'status_bekerja',
      'tanggal_awal_bekerja',
      'tanggal_resign',
      'keterangan_resign',     // Alasan pengunduran diri / arsip
      'is_archived',          // Boolean: TRUE / FALSE
      'edit_token',
      'status_kelengkapan',
      'persentase_kelengkapan',
      'kolom_belum_lengkap',
      'last_self_updated_at',
      'created_at'
    ];
  },

  getPegawaiList: function() {
    const sheet = this.getSheet(this.SHEET_NAMES.PEGAWAI);
    const list = this.sheetToObjects(sheet);

    const compMap = {};
    this.getPerusahaanList().forEach(c => compMap[c.id_perusahaan] = c.nama_perusahaan);

    const jabMap = {};
    this.getJabatanList().forEach(j => jabMap[j.id_jabatan] = j.nama_jabatan);

    return list.map(p => {
      // Normalisasi nilai checkbox BPJS
      p.bpjs_kesehatan = p.bpjs_kesehatan === true || String(p.bpjs_kesehatan).toUpperCase() === 'TRUE' || p.bpjs_kesehatan === 1 || String(p.bpjs_kesehatan).toLowerCase() === 'ya';
      p.bpjs_tenaga_kerja = p.bpjs_tenaga_kerja === true || String(p.bpjs_tenaga_kerja).toUpperCase() === 'TRUE' || p.bpjs_tenaga_kerja === 1 || String(p.bpjs_tenaga_kerja).toLowerCase() === 'ya';

      // Normalisasi status arsip
      p.is_archived = p.is_archived === true || String(p.is_archived).toUpperCase() === 'TRUE' || p.is_archived === 1 || String(p.status_bekerja).toLowerCase() === 'resign';

      // Attach Relasi
      p.nama_perusahaan = compMap[p.id_perusahaan] || '-';
      p.nama_jabatan = jabMap[p.id_jabatan] || '-';

      // Audit status kelengkapan
      const audit = CompletenessService.audit(p);
      p.status_kelengkapan = audit.status;
      p.persentase_kelengkapan = audit.percentage;
      p.kolom_belum_lengkap = audit.missingFieldsText;
      p.missing_fields_list = audit.missingList;
      p.self_service_url = CompletenessService.getSelfServiceUrl(p.edit_token || '');

      return p;
    });
  },

  getPegawaiById: function(id) {
    const list = this.getPegawaiList();
    return list.find(p => p.id_pegawai === id) || null;
  },

  getPegawaiByToken: function(token) {
    if (!token) return null;
    const cleanToken = String(token).trim().replace(/^["']+|["']+$/g, '').trim().toLowerCase();
    if (!cleanToken) return null;

    const list = this.getPegawaiList();
    return list.find(p => {
      const pToken = String(p.edit_token || p['edit token'] || p.token || '').trim().replace(/^["']+|["']+$/g, '').trim().toLowerCase();
      return pToken === cleanToken;
    }) || null;
  },

  savePegawai: function(data) {
    const sheet = this.getSheet(this.SHEET_NAMES.PEGAWAI);
    const headers = this.getPegawaiHeaders();
    const rows = this.sheetToObjects(sheet);
    const isNew = !data.id_pegawai;
    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
    const id = isNew ? ('EMP-' + Date.now().toString().slice(-6)) : data.id_pegawai;

    data.id_pegawai = id;

    // Pastikan edit_token selalu ada
    if (!data.edit_token) {
      data.edit_token = CompletenessService.generateToken();
    }

    // Jika nama_lengkap kosong pada input onboarding cepat, gunakan nama_panggilan sebagai fallback
    if (!data.nama_lengkap && data.nama_panggilan) {
      data.nama_lengkap = '';
    }

    // Normalisasi boolean checkbox BPJS & is_archived
    data.bpjs_kesehatan = data.bpjs_kesehatan === true || String(data.bpjs_kesehatan).toUpperCase() === 'TRUE' || data.bpjs_kesehatan === '1' || data.bpjs_kesehatan === 1;
    data.bpjs_tenaga_kerja = data.bpjs_tenaga_kerja === true || String(data.bpjs_tenaga_kerja).toUpperCase() === 'TRUE' || data.bpjs_tenaga_kerja === '1' || data.bpjs_tenaga_kerja === 1;
    data.is_archived = data.is_archived === true || String(data.is_archived).toUpperCase() === 'TRUE' || data.is_archived === '1' || data.is_archived === 1;

    // Hitung status kelengkapan data
    const audit = CompletenessService.audit(data);
    data.status_kelengkapan = audit.status;
    data.persentase_kelengkapan = audit.percentage;
    data.kolom_belum_lengkap = audit.missingFieldsText;

    if (isNew) {
      data.created_at = now;
      const rowValues = headers.map(h => this.formatValueForSheet(h, data[h]));
      sheet.appendRow(rowValues);
    } else {
      const target = rows.find(r => r.id_pegawai === id);
      if (!target) throw new Error('Data pegawai tidak ditemukan.');
      const rowValues = headers.map(h => {
        if (h === 'created_at') return target.created_at || now;
        const raw = data[h] !== undefined ? data[h] : (target[h] || '');
        return this.formatValueForSheet(h, raw);
      });
      sheet.getRange(target._rowIndex, 1, 1, headers.length).setValues([rowValues]);
    }

    return { success: true, id_pegawai: id, edit_token: data.edit_token, audit: audit };
  },

  /**
   * Mengarsipkan data pegawai (Pengganti Hapus Data)
   * Mengubah status_bekerja ke 'Resign', mencatat tanggal dan keterangan/alasan resign.
   */
  archivePegawai: function(id, tanggalResign, keteranganResign) {
    const sheet = this.getSheet(this.SHEET_NAMES.PEGAWAI);
    const headers = this.getPegawaiHeaders();
    const rows = this.sheetToObjects(sheet);
    const target = rows.find(r => r.id_pegawai === id);
    if (!target) throw new Error('Data pegawai tidak ditemukan.');

    const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd');
    const resignDate = tanggalResign || target.tanggal_resign || now;

    target.status_bekerja = 'Resign';
    target.tanggal_resign = resignDate;
    target.keterangan_resign = keteranganResign || 'Diarsipkan (Resign)';
    target.is_archived = true;

    const rowValues = headers.map(h => this.formatValueForSheet(h, target[h]));
    sheet.getRange(target._rowIndex, 1, 1, headers.length).setValues([rowValues]);

    return { success: true, message: `Pegawai ${target.nama_lengkap || target.nama_panggilan} berhasil diarsipkan dengan status Resign.` };
  },

  /**
   * Memulihkan pegawai dari status arsip kembali ke status Aktif
   */
  restorePegawai: function(id) {
    const sheet = this.getSheet(this.SHEET_NAMES.PEGAWAI);
    const headers = this.getPegawaiHeaders();
    const rows = this.sheetToObjects(sheet);
    const target = rows.find(r => r.id_pegawai === id);
    if (!target) throw new Error('Data pegawai tidak ditemukan.');

    target.status_bekerja = 'Aktif';
    target.is_archived = false;

    const rowValues = headers.map(h => this.formatValueForSheet(h, target[h]));
    sheet.getRange(target._rowIndex, 1, 1, headers.length).setValues([rowValues]);

    return { success: true, message: `Pegawai ${target.nama_lengkap || target.nama_panggilan} berhasil dipulihkan ke status Aktif.` };
  },

  /**
   * Khusus untuk pembaruan mandiri oleh Pegawai melalui link token
   * Hanya kolom biodata pribadi, status BPJS, dan informasi Bank yang diperbolehkan diubah!
   * Data organisasi (perusahaan, jabatan, status kerja, dll) diproteksi kaku.
   */
  updatePegawaiByToken: function(token, inputData) {
    const sheet = this.getSheet(this.SHEET_NAMES.PEGAWAI);
    const dataRange = sheet.getDataRange().getValues();
    if (dataRange.length <= 1) {
      throw new Error('Data sheet pegawai kosong.');
    }
    const sheetHeaders = dataRange[0].map(h => String(h).trim().toLowerCase());
    const rows = this.sheetToObjects(sheet);

    // 1. Normalisasi token (bersihkan kutip, whitespace, case-insensitive)
    let cleanToken = String(token || '').trim().replace(/^["']+|["']+$/g, '').trim();
    if (!cleanToken && inputData && (inputData.edit_token || inputData.token)) {
      cleanToken = String(inputData.edit_token || inputData.token).trim().replace(/^["']+|["']+$/g, '').trim();
    }

    if (!cleanToken && !(inputData && inputData.id_pegawai)) {
      throw new Error('Token akses tidak valid atau kosong.');
    }

    // 2. Cari target pegawai berdasarkan edit_token
    let target = null;
    if (cleanToken) {
      target = rows.find(r => {
        const rowToken = String(r.edit_token || r['edit token'] || r.token || '').trim().replace(/^["']+|["']+$/g, '').trim();
        return rowToken.toLowerCase() === cleanToken.toLowerCase();
      });
    }

    // 3. Fallback: Cari berdasarkan id_pegawai jika dikirimkan form mandiri
    if (!target && inputData && inputData.id_pegawai) {
      const cleanId = String(inputData.id_pegawai).trim().toLowerCase();
      target = rows.find(r => String(r.id_pegawai || '').trim().toLowerCase() === cleanId);
    }

    if (!target) {
      throw new Error('Token akses tidak valid atau tidak ditemukan.');
    }

    if (target.is_archived || String(target.status_bekerja).toLowerCase() === 'resign') {
      throw new Error('Formulir telah ditutup karena status kepegawaian Anda telah Non-Aktif / Resign.');
    }

    // Kolom-kolom yang DIIZINKAN diubah oleh pegawai
    const allowedFields = [
      'nik',
      'nama_lengkap',
      'nama_panggilan',
      'nomor_telepon',
      'email',
      'tempat_lahir',
      'tanggal_lahir',
      'jenis_kelamin',
      'agama',
      'golongan_darah',
      'pendidikan',
      'jurusan',
      'alamat_domisili',
      'bpjs_kesehatan',
      'keterangan_bpjs_kesehatan',
      'bpjs_tenaga_kerja',
      'keterangan_bpjs_tenaga_kerja',
      'nama_bank',
      'nomor_rekening'
    ];

    // Gabungkan data lama dengan data baru yang diizinkan
    const merged = Object.assign({}, target);
    allowedFields.forEach(field => {
      if (inputData[field] !== undefined) {
        if (field === 'bpjs_kesehatan' || field === 'bpjs_tenaga_kerja') {
          merged[field] = inputData[field] === true || String(inputData[field]).toUpperCase() === 'TRUE' || inputData[field] === '1' || inputData[field] === 1;
        } else {
          merged[field] = inputData[field];
        }
      }
    });

    // Hitung ulang audit kelengkapan
    const audit = CompletenessService.audit(merged);
    merged.status_kelengkapan = audit.status;
    merged.persentase_kelengkapan = audit.percentage;
    merged.kolom_belum_lengkap = audit.missingFieldsText;
    merged.last_self_updated_at = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');

    // Tulis kembali ke baris yang bersangkutan sesuai urutan kolom riil pada sheet
    const rowValues = sheetHeaders.map(h => this.formatValueForSheet(h, merged[h]));
    sheet.getRange(target._rowIndex, 1, 1, sheetHeaders.length).setValues([rowValues]);

    return {
      success: true,
      audit: audit,
      message: 'Biodata Anda berhasil diperbarui dan disimpan.'
    };
  },

  // ==========================================
  // PENGATURAN (SETTINGS)
  // ==========================================
  getSettings: function() {
    const sheet = this.getSheet(this.SHEET_NAMES.PENGATURAN);
    const data = sheet.getDataRange().getValues();
    const settings = {
      ADMIN_PIN: '123456',
      APP_NAME: 'Sistem Manajemen Pegawai',
      WA_TEMPLATE: ''
    };

    if (data.length <= 1) return settings;

    for (let i = 1; i < data.length; i++) {
      const key = String(data[i][0]).trim();
      const val = data[i][1];
      if (key) {
        settings[key] = val;
      }
    }
    return settings;
  },

  getSetting: function(key, defaultValue) {
    const settings = this.getSettings();
    return settings[key] !== undefined ? settings[key] : defaultValue;
  },

  setSetting: function(key, value) {
    const sheet = this.getSheet(this.SHEET_NAMES.PENGATURAN);
    const data = sheet.getDataRange().getValues();
    let found = false;
    const formattedVal = this.formatValueForSheet(key, value);

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === key) {
        sheet.getRange(i + 1, 2).setValue(formattedVal);
        found = true;
        break;
      }
    }

    if (!found) {
      sheet.appendRow([key, formattedVal]);
    }
    return true;
  },

  // ==========================================
  // DASHBOARD METRICS SUMMARY
  // ==========================================
  getDashboardSummary: function() {
    const allPegawai = this.getPegawaiList();
    const perusahaanList = this.getPerusahaanList();
    const jabatanList = this.getJabatanList();

    // Pegawai Aktif (Bukan yang diarsipkan)
    const activePegawai = allPegawai.filter(p => !p.is_archived && (p.status_bekerja || 'Aktif').toLowerCase() !== 'resign');
    const archivedPegawai = allPegawai.filter(p => p.is_archived || (p.status_bekerja || '').toLowerCase() === 'resign');

    const totalPegawai = activePegawai.length;
    const pegawaiLengkap = activePegawai.filter(p => p.status_kelengkapan === 'LENGKAP').length;
    const pegawaiBelumLengkap = activePegawai.filter(p => p.status_kelengkapan === 'BELUM_LENGKAP');

    return {
      totalPerusahaan: perusahaanList.length,
      totalJabatan: jabatanList.length,
      totalPegawai: totalPegawai,
      pegawaiAktif: totalPegawai,
      pegawaiLengkap: pegawaiLengkap,
      pegawaiBelumLengkapCount: pegawaiBelumLengkap.length,
      totalArchivedCount: archivedPegawai.length,
      incompleteList: pegawaiBelumLengkap.map(p => ({
        id_pegawai: p.id_pegawai,
        nama_lengkap: p.nama_lengkap || p.nama_panggilan,
        nama_panggilan: p.nama_panggilan,
        nomor_telepon: p.nomor_telepon,
        email: p.email,
        nama_perusahaan: p.nama_perusahaan,
        nama_jabatan: p.nama_jabatan,
        persentase_kelengkapan: p.persentase_kelengkapan,
        kolom_belum_lengkap: p.kolom_belum_lengkap,
        missing_fields_list: p.missing_fields_list,
        edit_token: p.edit_token,
        self_service_url: p.self_service_url
      }))
    };
  },

  // ==========================================
  // AUTO-SETUP GENERATOR (INIT DATABASE)
  // ==========================================
  initDatabase: function() {
    const ss = this.getSpreadsheet();

    // 1. Setup Sheet Perusahaan
    let sPerusahaan = ss.getSheetByName(this.SHEET_NAMES.PERUSAHAAN);
    if (!sPerusahaan) sPerusahaan = ss.insertSheet(this.SHEET_NAMES.PERUSAHAAN);
    sPerusahaan.clear();
    const pHeaders = this.getPerusahaanHeaders();
    sPerusahaan.appendRow(pHeaders);
    sPerusahaan.getRange(1, 1, 1, pHeaders.length)
      .setBackground('#1e3a8a')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sPerusahaan.setFrozenRows(1);
    sPerusahaan.getRange(2, 4, 500, 1).setNumberFormat('@'); // Format kolom telepon sebagai Plain Text

    sPerusahaan.appendRow([
      'COMP-001',
      'PT Nusantara Teknologi Mandiri',
      'info@nusantaratech.id',
      "'021-5551234",
      'Jl. Sudirman No. 45, Jakarta Selatan',
      'https://nusantaratech.id',
      '2026-01-01 08:00:00'
    ]);
    sPerusahaan.appendRow([
      'COMP-002',
      'CV Solusi Digital Perkasa',
      'kontak@solusidigital.co.id',
      "'022-7778899",
      'Jl. Asia Afrika No. 12, Bandung',
      'https://solusidigital.co.id',
      '2026-01-15 09:30:00'
    ]);

    // 2. Setup Sheet Jabatan
    let sJabatan = ss.getSheetByName(this.SHEET_NAMES.JABATAN);
    if (!sJabatan) sJabatan = ss.insertSheet(this.SHEET_NAMES.JABATAN);
    sJabatan.clear();
    const jHeaders = this.getJabatanHeaders();
    sJabatan.appendRow(jHeaders);
    sJabatan.getRange(1, 1, 1, jHeaders.length)
      .setBackground('#1e3a8a')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sJabatan.setFrozenRows(1);

    sJabatan.appendRow(['POS-001', 'COMP-001', 'Senior Fullstack Engineer', 'Engineering', 'Pengembangan platform inti', '2026-01-02 08:00:00']);
    sJabatan.appendRow(['POS-002', 'COMP-001', 'HR & People Operations', 'Human Resources', 'Pengelolaan kepegawaian', '2026-01-02 08:00:00']);
    sJabatan.appendRow(['POS-003', 'COMP-002', 'UI/UX Designer', 'Product Design', 'Desain antarmuka aplikasi', '2026-01-16 09:00:00']);
    sJabatan.appendRow(['POS-004', 'COMP-002', 'Digital Marketing Specialist', 'Marketing', 'Kampanye media sosial dan ads', '2026-01-16 09:00:00']);

    // 3. Setup Sheet Pegawai (34 Kolom)
    let sPegawai = ss.getSheetByName(this.SHEET_NAMES.PEGAWAI);
    if (!sPegawai) sPegawai = ss.insertSheet(this.SHEET_NAMES.PEGAWAI);
    sPegawai.clear();
    const empHeaders = this.getPegawaiHeaders();
    sPegawai.appendRow(empHeaders);
    sPegawai.getRange(1, 1, 1, empHeaders.length)
      .setBackground('#1e3a8a')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sPegawai.setFrozenRows(1);

    // Pasang Checkbox Data Validation untuk kolom bpjs_kesehatan, bpjs_tenaga_kerja, dan is_archived
    const bpjsKesCol = empHeaders.indexOf('bpjs_kesehatan') + 1;
    const bpjsTkCol = empHeaders.indexOf('bpjs_tenaga_kerja') + 1;
    const isArchivedCol = empHeaders.indexOf('is_archived') + 1;
    const checkboxRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    sPegawai.getRange(2, bpjsKesCol, 500, 1).setDataValidation(checkboxRule);
    sPegawai.getRange(2, bpjsTkCol, 500, 1).setDataValidation(checkboxRule);
    sPegawai.getRange(2, isArchivedCol, 500, 1).setDataValidation(checkboxRule);

    // Format kolom teks-numerik sebagai Plain Text (@) agar leading zero tidak dipotong oleh Sheets
    const textNumericCols = ['nik', 'nomor_telepon', 'keterangan_bpjs_kesehatan', 'keterangan_bpjs_tenaga_kerja', 'nomor_rekening', 'edit_token'];
    textNumericCols.forEach(colName => {
      const cIdx = empHeaders.indexOf(colName) + 1;
      if (cIdx > 0) {
        sPegawai.getRange(2, cIdx, 1000, 1).setNumberFormat('@');
      }
    });

    const token1 = CompletenessService.generateToken();
    const token2 = CompletenessService.generateToken();
    const token3 = CompletenessService.generateToken();
    const token4 = CompletenessService.generateToken();

    const appendEmpRow = (row) => {
      const formatted = row.map((val, idx) => this.formatValueForSheet(empHeaders[idx], val));
      sPegawai.appendRow(formatted);
    };

    // Sample 1: Lengkap 100% Aktif
    appendEmpRow([
      'EMP-1001',
      '3171012304950001',
      'Budi Santoso',
      'Budi',
      '081234567890',
      'budi.santoso@gmail.com',
      'Jakarta',
      '1995-04-23',
      'Laki-laki',
      'Islam',
      'O',
      'S1',
      'Teknik Informatika',
      'Jl. Melati No. 10, Kebayoran Baru, Jakarta Selatan',
      true,
      '0001234567891',
      true,
      'KPJ-987654321',
      'Mandiri',
      '1370012345678',
      'COMP-001',
      'POS-001',
      'Tetap',
      'Aktif',
      '2024-01-15',
      '',
      '',
      false,
      token1,
      'LENGKAP',
      100,
      '',
      '',
      '2026-02-01 10:00:00'
    ]);

    // Sample 2: Belum Lengkap Aktif (Missing Alamat & BPJS TK)
    appendEmpRow([
      'EMP-1002',
      '3273016508980002',
      'Siti Nurhaliza',
      'Siti',
      '085678901234',
      'siti.nurhaliza@gmail.com',
      'Bandung',
      '1998-08-15',
      'Perempuan',
      'Islam',
      'A',
      'S1',
      'Psikologi',
      '',
      true,
      '0009876543210',
      false,
      '',
      'BRI',
      '012301098765501',
      'COMP-001',
      'POS-002',
      'Kontrak',
      'Aktif',
      '2025-06-01',
      '',
      '',
      false,
      token2,
      'LENGKAP',
      100,
      '',
      '',
      '2026-02-01 10:30:00'
    ]);

    // Sample 3: Onboarding Cepat (Hanya Nama Panggilan & No WA)
    appendEmpRow([
      'EMP-1003',
      '',
      '',
      'Ahmad',
      '087811223344',
      'ahmad.fauzi@gmail.com',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      false,
      '',
      false,
      '',
      '',
      '',
      'COMP-002',
      'POS-003',
      'Probation',
      'Aktif',
      '2026-02-01',
      '',
      '',
      false,
      token3,
      'BELUM_LENGKAP',
      50,
      'NIK, Nama Lengkap, Rekening Bank',
      '',
      '2026-02-02 09:15:00'
    ]);

    // Sample 4: Pegawai Resign / Diarsipkan
    appendEmpRow([
      'EMP-1004',
      '3171098765430005',
      'Rudi Hartono',
      'Rudi',
      '081399887766',
      'rudi.hartono@gmail.com',
      'Semarang',
      '1992-03-12',
      'Laki-laki',
      'Islam',
      'B',
      'S1',
      'Manajemen Bisnis',
      'Jl. Cendrawasih No. 8, Jakarta Barat',
      true,
      '0001122334455',
      true,
      'KPJ-112233445',
      'BNI',
      '0234567891',
      'COMP-002',
      'POS-004',
      'Tetap',
      'Resign',
      '2023-05-10',
      '2025-12-31',
      'Pindah domisili ke luar kota atas keinginan sendiri',
      true,
      token4,
      'LENGKAP',
      100,
      '',
      '',
      '2026-01-05 14:00:00'
    ]);

    // 4. Setup Sheet Pengaturan
    let sPengaturan = ss.getSheetByName(this.SHEET_NAMES.PENGATURAN);
    if (!sPengaturan) sPengaturan = ss.insertSheet(this.SHEET_NAMES.PENGATURAN);
    sPengaturan.clear();
    sPengaturan.appendRow(['KUNCI_PENGATURAN', 'NILAI']);
    sPengaturan.getRange(1, 1, 1, 2)
      .setBackground('#1e3a8a')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sPengaturan.setFrozenRows(1);
    sPengaturan.getRange(2, 2, 50, 1).setNumberFormat('@'); // Format kolom NILAI sebagai Plain Text

    sPengaturan.appendRow(['ADMIN_PIN', "'123456"]);
    sPengaturan.appendRow(['APP_NAME', 'Sistem Manajemen Pegawai']);
    sPengaturan.appendRow(['WA_TEMPLATE', 'Halo *{NAMA}*,\n\nKami menginformasikan bahwa data kepegawaian Anda saat ini berstatus *{STATUS}* ({PERSENTASE}%).\n\nField yang masih perlu dilengkapi:\n_{KOLOM_KOSONG}_\n\nMohon dapat melengkapi data melalui tautan resmi berikut:\n{LINK}\n\nTerima kasih!']);

    [sPerusahaan, sJabatan, sPegawai, sPengaturan].forEach(s => {
      s.autoResizeColumns(1, s.getLastColumn() || 1);
    });

    return {
      success: true,
      message: 'Inisialisasi database berhasil! 4 Sheet (Perusahaan, Jabatan, Pegawai 34 Kolom, Pengaturan) beserta data sample telah dibuat.'
    };
  },

  /**
   * Utilitas perbaikan untuk sheet yang sudah terlanjur memotong angka 0:
   * Mengatur seluruh kolom numerik ke format Plain Text (@) dan memulihkan leading zero.
   */
  repairNumericColumns: function() {
    const ss = this.getSpreadsheet();
    const sPegawai = ss.getSheetByName(this.SHEET_NAMES.PEGAWAI);
    if (sPegawai) {
      const empHeaders = this.getPegawaiHeaders();
      const textNumericCols = ['nik', 'nomor_telepon', 'keterangan_bpjs_kesehatan', 'keterangan_bpjs_tenaga_kerja', 'nomor_rekening', 'edit_token'];
      textNumericCols.forEach(colName => {
        const cIdx = empHeaders.indexOf(colName) + 1;
        if (cIdx > 0 && sPegawai.getMaxRows() > 1) {
          sPegawai.getRange(2, cIdx, sPegawai.getMaxRows() - 1, 1).setNumberFormat('@');
        }
      });

      const data = sPegawai.getDataRange().getValues();
      if (data.length > 1) {
        for (let i = 1; i < data.length; i++) {
          for (let j = 0; j < empHeaders.length; j++) {
            const h = empHeaders[j];
            let v = data[i][j];
            if (v !== '' && v !== null && v !== undefined) {
              const formatted = this.formatValueForSheet(h, v);
              if (formatted !== v) {
                sPegawai.getRange(i + 1, j + 1).setValue(formatted);
              }
            }
          }
        }
      }
    }

    const sPerusahaan = ss.getSheetByName(this.SHEET_NAMES.PERUSAHAAN);
    if (sPerusahaan && sPerusahaan.getMaxRows() > 1) {
      sPerusahaan.getRange(2, 4, sPerusahaan.getMaxRows() - 1, 1).setNumberFormat('@');
    }

    const sPengaturan = ss.getSheetByName(this.SHEET_NAMES.PENGATURAN);
    if (sPengaturan && sPengaturan.getMaxRows() > 1) {
      sPengaturan.getRange(2, 2, sPengaturan.getMaxRows() - 1, 1).setNumberFormat('@');
    }

    return {
      success: true,
      message: 'Perbaikan selesai! Seluruh kolom numerik telah diformat Plain Text (@) dan angka nol di awal berhasil dipulihkan.'
    };
  }
};
