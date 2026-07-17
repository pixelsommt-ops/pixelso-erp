// ============================================================================================
// PERINGATAN KERAS: seluruh tarif PPh21 (TER)/BPJS di file ini diisi sesuai pemahaman peraturan
// resmi terkini (PMK 168/2023 utk TER, aturan BPJS Kesehatan/Ketenagakerjaan terkini) TAPI BELUM
// PERNAH DIVERIFIKASI ke konsultan pajak/HR asli. JANGAN dipakai untuk penggajian riil sebelum
// dicek ulang - terutama:
//   - Batas bracket TER kategori B/C dan bracket tinggi (di atas ~Rp50 juta/bulan) confidence
//     lebih rendah dibanding bracket rendah-menengah yang lebih umum dipakai bisnis kecil.
//   - JKK_RATE diasumsikan Kelas I (risiko sangat rendah, 0.24%) - klasifikasi risiko usaha
//     sebenarnya ditentukan BPJS Ketenagakerjaan berdasarkan pendaftaran, bisa beda.
//   - JP_CAP (batas gaji Jaminan Pensiun) disesuaikan tiap tahun oleh Kemenaker - nilai di sini
//     bisa sudah kedaluwarsa, WAJIB dicek nilai terbaru.
//   - OVERTIME_MULTIPLIER 1.5x adalah SIMPLIFIKASI flat - rumus resmi Kepmenaker 102/2004 punya
//     tiering berbeda (jam pertama 1.5x, jam berikutnya 2x, hari libur/istirahat mingguan 2x-4x)
//     yang tidak bisa direpresentasikan dari input "total jam lembur" yang polos.
// Sama seperti AUTO_BONUS_RATES di finance.service.js - angka tempat, bukan kebenaran mutlak.
// ============================================================================================

// --- PPh 21 TER (Tarif Efektif Rata-rata, PMK 168/2023) ---
// Kategori ditentukan dari status PTKP (status kawin + jumlah tanggungan):
//   TER A: TK/0, TK/1, K/0
//   TER B: TK/2, TK/3, K/1, K/2
//   TER C: K/3
// Method: cari bracket pertama yang grossMonthlyIncome <= upTo, pakai rate bracket itu untuk
// SELURUH penghasilan bruto bulan itu (bukan progresif/marginal seperti PPh tahunan - ini ciri
// khas metode TER, beda dari perhitungan pasal 17 biasa).

function resolveTerCategory(maritalStatus, dependentsCount) {
  const status = maritalStatus === 'K' ? 'K' : 'TK';
  const deps = Math.max(0, Math.min(3, Number(dependentsCount) || 0));
  if (status === 'TK' && (deps === 0 || deps === 1)) return 'A';
  if (status === 'K' && deps === 0) return 'A';
  if (status === 'TK' && (deps === 2 || deps === 3)) return 'B';
  if (status === 'K' && (deps === 1 || deps === 2)) return 'B';
  if (status === 'K' && deps === 3) return 'C';
  return 'A'; // fallback aman, seharusnya tidak pernah kejadian dengan input yang divalidasi
}

const TER_BRACKETS = {
  A: [
    { upTo: 5_400_000, rate: 0 },
    { upTo: 5_650_000, rate: 0.0025 },
    { upTo: 5_950_000, rate: 0.005 },
    { upTo: 6_300_000, rate: 0.0075 },
    { upTo: 6_750_000, rate: 0.01 },
    { upTo: 7_500_000, rate: 0.0125 },
    { upTo: 8_550_000, rate: 0.015 },
    { upTo: 9_650_000, rate: 0.0175 },
    { upTo: 10_050_000, rate: 0.02 },
    { upTo: 10_350_000, rate: 0.0225 },
    { upTo: 10_700_000, rate: 0.025 },
    { upTo: 11_050_000, rate: 0.03 },
    { upTo: 11_600_000, rate: 0.035 },
    { upTo: 12_500_000, rate: 0.04 },
    { upTo: 13_750_000, rate: 0.05 },
    { upTo: 15_100_000, rate: 0.06 },
    { upTo: 16_950_000, rate: 0.07 },
    { upTo: 19_750_000, rate: 0.08 },
    { upTo: 24_150_000, rate: 0.09 },
    { upTo: 26_450_000, rate: 0.1 },
    { upTo: 28_000_000, rate: 0.11 },
    { upTo: 30_050_000, rate: 0.12 },
    { upTo: 32_400_000, rate: 0.13 },
    { upTo: 35_400_000, rate: 0.14 },
    { upTo: 39_100_000, rate: 0.15 },
    { upTo: 43_850_000, rate: 0.16 },
    { upTo: 47_800_000, rate: 0.17 },
    { upTo: 51_400_000, rate: 0.18 },
    { upTo: 56_300_000, rate: 0.19 },
    { upTo: 62_200_000, rate: 0.2 },
    { upTo: 68_600_000, rate: 0.21 },
    { upTo: 77_500_000, rate: 0.22 },
    { upTo: 89_000_000, rate: 0.23 },
    { upTo: 103_000_000, rate: 0.24 },
    { upTo: 125_000_000, rate: 0.25 },
    { upTo: 157_000_000, rate: 0.26 },
    { upTo: 206_000_000, rate: 0.27 },
    { upTo: 337_000_000, rate: 0.28 },
    { upTo: 454_000_000, rate: 0.29 },
    { upTo: 550_000_000, rate: 0.3 },
    { upTo: 695_000_000, rate: 0.31 },
    { upTo: 910_000_000, rate: 0.32 },
    { upTo: 1_400_000_000, rate: 0.33 },
    { upTo: Infinity, rate: 0.34 },
  ],
  B: [
    { upTo: 6_200_000, rate: 0 },
    { upTo: 6_500_000, rate: 0.0025 },
    { upTo: 6_850_000, rate: 0.005 },
    { upTo: 7_300_000, rate: 0.0075 },
    { upTo: 9_200_000, rate: 0.01 },
    { upTo: 10_750_000, rate: 0.015 },
    { upTo: 11_250_000, rate: 0.02 },
    { upTo: 11_600_000, rate: 0.025 },
    { upTo: 12_600_000, rate: 0.03 },
    { upTo: 13_600_000, rate: 0.04 },
    { upTo: 14_950_000, rate: 0.05 },
    { upTo: 16_400_000, rate: 0.06 },
    { upTo: 18_450_000, rate: 0.07 },
    { upTo: 21_850_000, rate: 0.08 },
    { upTo: 26_000_000, rate: 0.09 },
    { upTo: 27_700_000, rate: 0.1 },
    { upTo: 29_350_000, rate: 0.11 },
    { upTo: 31_450_000, rate: 0.12 },
    { upTo: 33_950_000, rate: 0.13 },
    { upTo: 37_100_000, rate: 0.14 },
    { upTo: 41_100_000, rate: 0.15 },
    { upTo: 45_800_000, rate: 0.16 },
    { upTo: 49_500_000, rate: 0.17 },
    { upTo: 53_800_000, rate: 0.18 },
    { upTo: 58_500_000, rate: 0.19 },
    { upTo: 64_000_000, rate: 0.2 },
    { upTo: 71_000_000, rate: 0.21 },
    { upTo: 80_000_000, rate: 0.22 },
    { upTo: 93_000_000, rate: 0.23 },
    { upTo: 109_000_000, rate: 0.24 },
    { upTo: 129_000_000, rate: 0.25 },
    { upTo: 163_000_000, rate: 0.26 },
    { upTo: 211_000_000, rate: 0.27 },
    { upTo: 374_000_000, rate: 0.28 },
    { upTo: 459_000_000, rate: 0.29 },
    { upTo: 555_000_000, rate: 0.3 },
    { upTo: 704_000_000, rate: 0.31 },
    { upTo: 957_000_000, rate: 0.32 },
    { upTo: 1_405_000_000, rate: 0.33 },
    { upTo: Infinity, rate: 0.34 },
  ],
  C: [
    { upTo: 6_600_000, rate: 0 },
    { upTo: 6_950_000, rate: 0.0025 },
    { upTo: 7_350_000, rate: 0.005 },
    { upTo: 7_800_000, rate: 0.0075 },
    { upTo: 8_850_000, rate: 0.01 },
    { upTo: 9_800_000, rate: 0.0125 },
    { upTo: 10_950_000, rate: 0.015 },
    { upTo: 11_200_000, rate: 0.0175 },
    { upTo: 12_050_000, rate: 0.02 },
    { upTo: 12_950_000, rate: 0.03 },
    { upTo: 14_150_000, rate: 0.04 },
    { upTo: 15_550_000, rate: 0.05 },
    { upTo: 17_050_000, rate: 0.06 },
    { upTo: 19_500_000, rate: 0.07 },
    { upTo: 22_700_000, rate: 0.08 },
    { upTo: 26_600_000, rate: 0.09 },
    { upTo: 28_100_000, rate: 0.1 },
    { upTo: 30_100_000, rate: 0.11 },
    { upTo: 32_600_000, rate: 0.12 },
    { upTo: 35_400_000, rate: 0.13 },
    { upTo: 38_900_000, rate: 0.14 },
    { upTo: 43_000_000, rate: 0.15 },
    { upTo: 47_400_000, rate: 0.16 },
    { upTo: 51_200_000, rate: 0.17 },
    { upTo: 55_800_000, rate: 0.18 },
    { upTo: 60_400_000, rate: 0.19 },
    { upTo: 66_700_000, rate: 0.2 },
    { upTo: 74_500_000, rate: 0.21 },
    { upTo: 83_200_000, rate: 0.22 },
    { upTo: 95_600_000, rate: 0.23 },
    { upTo: 110_000_000, rate: 0.24 },
    { upTo: 134_000_000, rate: 0.25 },
    { upTo: 169_000_000, rate: 0.26 },
    { upTo: 221_000_000, rate: 0.27 },
    { upTo: 390_000_000, rate: 0.28 },
    { upTo: 463_000_000, rate: 0.29 },
    { upTo: 561_000_000, rate: 0.3 },
    { upTo: 709_000_000, rate: 0.31 },
    { upTo: 965_000_000, rate: 0.32 },
    { upTo: 1_419_000_000, rate: 0.33 },
    { upTo: Infinity, rate: 0.34 },
  ],
};

function calculatePph21Ter(grossMonthlyIncome, terCategory) {
  const brackets = TER_BRACKETS[terCategory] || TER_BRACKETS.A;
  const bracket = brackets.find((b) => grossMonthlyIncome <= b.upTo) || brackets[brackets.length - 1];
  return Math.round(grossMonthlyIncome * bracket.rate);
}

// --- Lembur (simplifikasi flat-rate, lihat peringatan di atas) ---
const OVERTIME_MULTIPLIER = 1.5;
const OVERTIME_DIVISOR = 173; // rata-rata jam kerja sebulan, Kepmenaker 102/2004

function calculateOvertimePay(baseSalary, overtimeHours) {
  const hourlyRate = Number(baseSalary) / OVERTIME_DIVISOR;
  return Math.round(hourlyRate * OVERTIME_MULTIPLIER * Number(overtimeHours || 0));
}

// --- BPJS Kesehatan ---
const KESEHATAN_CAP = 12_000_000;
const KESEHATAN_EMPLOYER_RATE = 0.04;
const KESEHATAN_EMPLOYEE_RATE = 0.01;

function calculateBpjsKesehatan(grossMonthlyIncome) {
  const base = Math.min(Number(grossMonthlyIncome), KESEHATAN_CAP);
  return {
    employer: Math.round(base * KESEHATAN_EMPLOYER_RATE),
    employee: Math.round(base * KESEHATAN_EMPLOYEE_RATE),
  };
}

// --- BPJS Ketenagakerjaan (JHT + JKK + JKM + JP) ---
const JHT_EMPLOYER_RATE = 0.037;
const JHT_EMPLOYEE_RATE = 0.02;
const JKK_RATE = 0.0024; // asumsi Kelas I (risiko sangat rendah) - WAJIB dicek klasifikasi riil
const JKM_RATE = 0.003;
const JP_CAP = 10_547_400; // batas gaji JP - disesuaikan tahunan oleh Kemenaker, WAJIB dicek nilai terbaru
const JP_EMPLOYER_RATE = 0.02;
const JP_EMPLOYEE_RATE = 0.01;

function calculateBpjsKetenagakerjaan(grossMonthlyIncome) {
  const gross = Number(grossMonthlyIncome);
  const jpBase = Math.min(gross, JP_CAP);

  const jhtEmployer = gross * JHT_EMPLOYER_RATE;
  const jhtEmployee = gross * JHT_EMPLOYEE_RATE;
  const jkk = gross * JKK_RATE; // employer-only
  const jkm = gross * JKM_RATE; // employer-only
  const jpEmployer = jpBase * JP_EMPLOYER_RATE;
  const jpEmployee = jpBase * JP_EMPLOYEE_RATE;

  return {
    employer: Math.round(jhtEmployer + jkk + jkm + jpEmployer),
    employee: Math.round(jhtEmployee + jpEmployee),
  };
}

// --- Orkestrasi satu baris PayrollItem ---
function calculatePayrollItem({ baseSalary, overtimeHours, incentive, maritalStatus, dependentsCount }) {
  const overtimePay = calculateOvertimePay(baseSalary, overtimeHours);
  const grossPay = Number(baseSalary) + overtimePay + Number(incentive || 0);

  const terCategory = resolveTerCategory(maritalStatus, dependentsCount);
  const pph21 = calculatePph21Ter(grossPay, terCategory);
  const kesehatan = calculateBpjsKesehatan(grossPay);
  const ketenagakerjaan = calculateBpjsKetenagakerjaan(grossPay);

  const totalDeductions = pph21 + kesehatan.employee + ketenagakerjaan.employee;
  const netPay = grossPay - totalDeductions;

  return {
    overtimePay,
    grossPay,
    pph21,
    bpjsKesehatanEmployee: kesehatan.employee,
    bpjsKesehatanEmployer: kesehatan.employer,
    bpjsKetenagakerjaanEmployee: ketenagakerjaan.employee,
    bpjsKetenagakerjaanEmployer: ketenagakerjaan.employer,
    totalDeductions,
    netPay,
  };
}

module.exports = {
  resolveTerCategory,
  calculatePph21Ter,
  calculateOvertimePay,
  calculateBpjsKesehatan,
  calculateBpjsKetenagakerjaan,
  calculatePayrollItem,
  TER_BRACKETS,
};
