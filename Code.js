/**
 * Code.js
 * Entry point utama Google Apps Script Web App.
 * Menangani HTTP routing (doGet), isolasi akses admin vs pegawai,
 * dan dispatching API untuk google.script.run.
 */

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function initDatabase() {
  return DB.initDatabase();
}

/**
 * HTTP GET Router
 * Membedakan akses berdasarkan parameter `token`:
 * - Jika ada ?token=xxx:
 *    - Jika pegawai aktif: Merender formulir mandiri Pegawai (SelfService.html)
 *    - Jika pegawai resign/diarsipkan: Merender pemberitahuan bahwa akses formulir telah ditutup
 * - Jika tanpa token: Merender portal Admin (Index.html)
 */
function doGet(e) {
  try {
    let token = e && e.parameter && e.parameter.token ? String(e.parameter.token).trim() : null;
    if (token) {
      token = token.replace(/^["']+|["']+$/g, '').trim();
    }
    const appName = DB.getSetting('APP_NAME', 'Sistem Manajemen Pegawai');

    // JIKA ADA PARAMETER TOKEN: MODE PEGAWAI (SELF-SERVICE)
    if (token) {
      const pegawai = DB.getPegawaiByToken(token);
      
      if (!pegawai) {
        const errorTemplate = HtmlService.createTemplate(`
          <!DOCTYPE html>
          <html lang="id">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Akses Ditolak / Tautan Tidak Ditemukan</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-slate-50 min-h-screen flex items-center justify-center p-4 font-sans">
            <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
              <div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <h2 class="text-xl font-bold text-slate-800 mb-2">Tautan Tidak Valid</h2>
              <p class="text-sm text-slate-600 mb-6">Tautan pengisian data yang Anda gunakan tidak ditemukan atau sudah tidak berlaku. Silakan hubungi bagian HR / Personalia.</p>
              <div class="text-xs text-slate-400">Token ID: ${token.substring(0, 8)}...</div>
            </div>
          </body>
          </html>
        `);
        return errorTemplate.evaluate()
          .setTitle('Tautan Tidak Valid - ' + appName)
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
          .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
      }

      // JIKA PEGAWAI SUDAH RESIGN / DIARSIPKAN: KUNCI FORMULIR
      if (pegawai.is_archived || String(pegawai.status_bekerja).toLowerCase() === 'resign') {
        const closedTemplate = HtmlService.createTemplate(`
          <!DOCTYPE html>
          <html lang="id">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Formulir Ditutup - Status Resign</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-slate-50 min-h-screen flex items-center justify-center p-4 font-sans">
            <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
              <div class="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              </div>
              <h2 class="text-xl font-bold text-slate-800 mb-2">Formulir Telah Ditutup</h2>
              <p class="text-sm text-slate-600 mb-4">Status kepegawaian Anda atas nama <strong>${pegawai.nama_lengkap || pegawai.nama_panggilan}</strong> tercatat <strong>Non-Aktif / Resign</strong>.</p>
              <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-6 text-left">
                <div><strong>Tanggal Resign:</strong> ${pegawai.tanggal_resign || '-'}</div>
                <div><strong>Keterangan:</strong> ${pegawai.keterangan_resign || 'Diarsipkan'}</div>
              </div>
              <p class="text-xs text-slate-400">Tautan pengisian mandiri ini tidak lagi menerima pembaruan data. Jika ada kekeliruan, silakan hubungi bagian HRD.</p>
            </div>
          </body>
          </html>
        `);
        return closedTemplate.evaluate()
          .setTitle('Formulir Ditutup - ' + appName)
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
          .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
      }

      // TOKEN VALID & STATUS AKTIF: Render Formulir Mandiri Pegawai
      const template = HtmlService.createTemplateFromFile('SelfService');
      template.pegawai = pegawai;
      template.token = token;
      template.appName = appName;
      template.requiredFields = CompletenessService.REQUIRED_FIELDS;

      return template.evaluate()
        .setTitle('Lengkapi Biodata - ' + (pegawai.nama_lengkap || pegawai.nama_panggilan))
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
    }

    // JIKA TANPA TOKEN: MODE ADMIN
    const template = HtmlService.createTemplateFromFile('Index');
    template.appName = appName;

    return template.evaluate()
      .setTitle(appName)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');

  } catch (err) {
    return HtmlService.createHtmlOutput('<h3>Terjadi kesalahan sistem:</h3><p>' + err.toString() + '</p>');
  }
}

// ========================================================
// API ENDPOINTS (DIPANGGIL DARI CLIENT / FRONTEND)
// ========================================================

function apiVerifyAdminPin(pin) {
  try {
    const savedPin = DB.getSetting('ADMIN_PIN', '123456');
    if (String(pin).trim() === String(savedPin).trim()) {
      return { success: true, message: 'PIN Berhasil diverifikasi' };
    }
    return { success: false, message: 'PIN Admin yang Anda masukkan salah.' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function apiChangeAdminPin(oldPin, newPin) {
  try {
    const savedPin = DB.getSetting('ADMIN_PIN', '123456');
    if (String(oldPin).trim() !== String(savedPin).trim()) {
      return { success: false, message: 'PIN lama salah.' };
    }
    if (!newPin || String(newPin).trim().length < 4) {
      return { success: false, message: 'PIN baru minimal 4 karakter.' };
    }
    DB.setSetting('ADMIN_PIN', String(newPin).trim());
    return { success: true, message: 'PIN Admin berhasil diperbarui.' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function apiGetDashboard() {
  try {
    const summary = DB.getDashboardSummary();
    const appName = DB.getSetting('APP_NAME', 'Sistem Manajemen Pegawai');
    return { success: true, data: summary, appName: appName };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// --- API PERUSAHAAN ---
function apiGetPerusahaan() {
  try {
    const list = DB.getPerusahaanList();
    return { success: true, data: list };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function apiSavePerusahaan(data) {
  try {
    const result = DB.savePerusahaan(data);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function apiDeletePerusahaan(id) {
  try {
    const result = DB.deletePerusahaan(id);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// --- API JABATAN ---
function apiGetJabatan() {
  try {
    const list = DB.getJabatanList();
    return { success: true, data: list };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function apiSaveJabatan(data) {
  try {
    const result = DB.saveJabatan(data);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function apiDeleteJabatan(id) {
  try {
    const result = DB.deleteJabatan(id);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// --- API PEGAWAI ---
function apiGetPegawai() {
  try {
    const list = DB.getPegawaiList();
    const perusahaan = DB.getPerusahaanList();
    const jabatan = DB.getJabatanList();
    return { success: true, data: list, perusahaan: perusahaan, jabatan: jabatan };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function apiSavePegawai(data) {
  try {
    // Validasi fleksibel: minimal harus ada nama_panggilan atau nama_lengkap, nomor_telepon, perusahaan, & jabatan
    if (!data.nama_panggilan && !data.nama_lengkap) {
      throw new Error('Minimal harus mengisi Nama Panggilan atau Nama Lengkap.');
    }
    if (!data.nomor_telepon) {
      throw new Error('Nomor telepon / WhatsApp wajib diisi.');
    }
    if (!data.id_perusahaan || !data.id_jabatan) {
      throw new Error('Penempatan Perusahaan dan Jabatan wajib dipilih.');
    }

    const result = DB.savePegawai(data);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Arsipkan Pegawai (Mengubah ke status Resign dengan keterangan)
 */
function apiArchivePegawai(id, tanggalResign, keteranganResign) {
  try {
    if (!id) throw new Error('ID Pegawai tidak ditemukan.');
    const result = DB.archivePegawai(id, tanggalResign, keteranganResign);
    return result;
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Pulihkan Pegawai dari Status Arsip/Resign kembali ke Aktif
 */
function apiRestorePegawai(id) {
  try {
    if (!id) throw new Error('ID Pegawai tidak ditemukan.');
    const result = DB.restorePegawai(id);
    return result;
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// --- API NOTIFIKASI & PENGINGAT ---
function apiGetWhatsAppLink(empId) {
  try {
    const emp = DB.getPegawaiById(empId);
    if (!emp) throw new Error('Pegawai tidak ditemukan.');

    const waTemplate = DB.getSetting('WA_TEMPLATE', '');
    const message = CompletenessService.generateWhatsAppMessage(emp, waTemplate);
    
    let phone = String(emp.nomor_telepon || '').replace(/\D/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    return { success: true, url: waUrl, messageText: message, phone: phone };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function apiSendReminderEmail(empId) {
  try {
    const emp = DB.getPegawaiById(empId);
    if (!emp) throw new Error('Pegawai tidak ditemukan.');
    const appName = DB.getSetting('APP_NAME', 'Sistem Manajemen Pegawai');

    return CompletenessService.sendEmailReminder(emp, appName);
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// --- API SELF-SERVICE (DIPANGGIL DARI FORM PEGAWAI) ---
function apiSubmitSelfService(token, formData) {
  try {
    if (!token && formData && (formData.edit_token || formData.token)) {
      token = formData.edit_token || formData.token;
    }
    if (!token && !(formData && formData.id_pegawai)) {
      throw new Error('Token tidak valid.');
    }
    const result = DB.updatePegawaiByToken(token, formData);
    return result;
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
