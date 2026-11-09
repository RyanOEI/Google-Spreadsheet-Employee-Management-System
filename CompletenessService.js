/**
 * CompletenessService.js
 * Layanan untuk mengaudit kelengkapan data pegawai, membuat token unik,
 * dan menghasilkan template pengingat (WhatsApp & Email).
 */

const CompletenessService = {
  /**
   * Kolom-kolom pokok yang WAJIB terisi agar data pegawai dianggap LENGKAP:
   * 1. NIK
   * 2. Nama Lengkap
   * 3. Nomor Telepon
   * 4. Alamat Domisili
   * 5. ID Perusahaan
   * 6. ID Jabatan
   *
   * Catatan: BPJS Kesehatan, BPJS Tenaga Kerja, serta Rekening Bank bersifat catatan
   * administratif/payroll dan tidak menghalangi kelengkapan data pokok pegawai (100%).
   */
  REQUIRED_FIELDS: [
    { key: 'nik', label: 'NIK' },
    { key: 'nama_lengkap', label: 'Nama Lengkap' },
    { key: 'nomor_telepon', label: 'Nomor Telepon' },
    { key: 'alamat_domisili', label: 'Alamat Domisili' },
    { key: 'id_perusahaan', label: 'Perusahaan' },
    { key: 'id_jabatan', label: 'Jabatan' }
  ],

  /**
   * Mengaudit objek data pegawai dan menghitung status serta persentase kelengkapan
   * @param {Object} employee Objek pegawai
   * @returns {Object} { status, percentage, missingFieldsText, missingList }
   */
  audit: function(employee) {
    if (!employee) {
      return {
        status: 'BELUM_LENGKAP',
        percentage: 0,
        missingFieldsText: 'Data Kosong',
        missingList: []
      };
    }

    const missingList = [];
    let filledCount = 0;
    const totalFields = this.REQUIRED_FIELDS.length;

    this.REQUIRED_FIELDS.forEach(field => {
      const val = employee[field.key];

      if (field.isCheckbox) {
        // Untuk checkbox BPJS: harus bernilai true, 'TRUE', atau 'Ya'
        const isChecked = val === true || String(val).toUpperCase() === 'TRUE' || String(val).toLowerCase() === 'ya' || val === 1 || val === '1';
        if (isChecked) {
          filledCount++;
        } else {
          missingList.push(field.label);
        }
      } else {
        // Untuk text/id: tidak boleh null, undefined, atau string kosong setelah di-trim
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          filledCount++;
        } else {
          missingList.push(field.label);
        }
      }
    });

    const percentage = Math.round((filledCount / totalFields) * 100);
    const status = percentage === 100 ? 'LENGKAP' : 'BELUM_LENGKAP';
    const missingFieldsText = missingList.join(', ');

    return {
      status: status,
      percentage: percentage,
      missingFieldsText: missingFieldsText,
      missingList: missingList
    };
  },

  /**
   * Menghasilkan UUID unik untuk token link mandiri pegawai
   * @returns {string} UUID v4 string
   */
  generateToken: function() {
    try {
      return Utilities.getUuid();
    } catch (e) {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  },

  /**
   * Menghasilkan URL lengkap formulir mandiri pegawai
   * @param {string} token
   * @returns {string} URL Web App + parameter token
   */
  getSelfServiceUrl: function(token) {
    try {
      const baseUrl = ScriptApp.getService().getUrl();
      if (baseUrl) {
        return baseUrl + '?token=' + encodeURIComponent(token);
      }
    } catch (e) {}
    return '?token=' + encodeURIComponent(token);
  },

  /**
   * Menghasilkan teks template pesan WhatsApp untuk pengingat pegawai
   * @param {Object} employee Data pegawai
   * @param {string} customTemplate (opsional) Template dari sheet Pengaturan
   * @returns {string} Teks pesan siap kirim via wa.me
   */
  generateWhatsAppMessage: function(employee, customTemplate) {
    const tokenUrl = this.getSelfServiceUrl(employee.edit_token || '');
    const auditResult = this.audit(employee);
    
    let template = customTemplate || 
      'Halo *{NAMA}*,\n\n' +
      'Kami dari bagian HR/Personalia menginformasikan bahwa data kepegawaian Anda saat ini berstatus *{STATUS}* ({PERSENTASE}%).\n\n' +
      'Field yang masih perlu dilengkapi:\n_{KOLOM_KOSONG}_\n\n' +
      'Mohon dapat melengkapi data tersebut melalui tautan resmi berikut:\n{LINK}\n\n' +
      'Tautan ini aman dan hanya dapat diakses oleh Anda. Terima kasih atas kerja samanya!';

    return template
      .replace(/{NAMA}/g, employee.nama_panggilan || employee.nama_lengkap || 'Rekan Pegawai')
      .replace(/{STATUS}/g, auditResult.status === 'LENGKAP' ? 'Lengkap' : 'Belum Lengkap')
      .replace(/{PERSENTASE}/g, auditResult.percentage)
      .replace(/{KOLOM_KOSONG}/g, auditResult.missingFieldsText || 'Tidak ada')
      .replace(/{LINK}/g, tokenUrl);
  },

  /**
   * Mengirim email otomatis ke pegawai jika email tersedia
   * @param {Object} employee Data pegawai
   * @param {string} appName Nama aplikasi
   * @returns {Object} { success, message }
   */
  sendEmailReminder: function(employee, appName) {
    if (!employee || !employee.email || String(employee.email).trim() === '') {
      return { success: false, message: 'Pegawai tidak memiliki alamat email terdaftar.' };
    }

    try {
      const auditResult = this.audit(employee);
      const tokenUrl = this.getSelfServiceUrl(employee.edit_token || '');
      const namaPegawai = employee.nama_lengkap || employee.nama_panggilan || 'Pegawai';
      const subject = `[${appName || 'Manajemen Pegawai'}] Pengingat Kelengkapan Data Kepegawaian - ${namaPegawai}`;
      
      const bodyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e3a8a; margin-top: 0;">Pengingat Pembaruan Data Pegawai</h2>
          <p>Yth. <strong>${namaPegawai}</strong>,</p>
          <p>Sistem mencatat data kepegawaian Anda saat ini memiliki tingkat kelengkapan <strong>${auditResult.percentage}%</strong> (${auditResult.status === 'LENGKAP' ? 'Lengkap' : 'Belum Lengkap'}).</p>
          
          ${auditResult.missingList.length > 0 ? `
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0;">
              <strong style="color: #991b1b;">Data yang masih belum lengkap:</strong>
              <ul style="color: #7f1d1d; margin: 8px 0 0 20px; padding: 0;">
                ${auditResult.missingList.map(item => `<li>${item}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <p>Silakan klik tombol di bawah ini untuk melengkapi dan memperbarui biodata Anda secara mandiri:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${tokenUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Lengkapi Data Pegawai</a>
          </div>
          <p style="font-size: 13px; color: #64748b;">Atau salin tautan berikut ke browser Anda:<br><a href="${tokenUrl}">${tokenUrl}</a></p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 12px; color: #94a3b8;">Email ini dikirim otomatis oleh ${appName || 'Sistem Kepegawaian'}. Tautan di atas bersifat pribadi dan tidak boleh dibagikan kepada orang lain.</p>
        </div>
      `;

      MailApp.sendEmail({
        to: employee.email,
        subject: subject,
        htmlBody: bodyHtml
      });

      return { success: true, message: `Email pengingat berhasil dikirim ke ${employee.email}` };
    } catch (e) {
      return { success: false, message: 'Gagal mengirim email: ' + e.toString() };
    }
  }
};
