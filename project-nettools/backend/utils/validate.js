// ==========================================
// VALIDATOR: input sanitization buat cegah command injection
// INI BAGIAN PALING KRITIS DI SELURUH BACKEND
// ==========================================
//
// Kenapa ini penting banget:
// Endpoint ping/traceroute nerima input dari USER (target IP/domain) yang
// bakal dipake buat jalanin command system (ping/traceroute). Kalau input
// nggak divalidasi ketat, orang bisa nyuntikin karakter shell kayak `; rm -rf /`
// atau `$(whatever)` buat ngejalanin command sembarangan di server lo.
//
// Mitigasi yang dipake di sini (2 lapis):
// 1. Validasi format ketat: cuma terima karakter yang valid buat hostname/IP
//    (huruf, angka, titik, strip) - tolak SEMUA karakter shell metacharacter
// 2. Backend pake execFile() bukan exec() - artinya command dijalanin LANGSUNG
//    tanpa lewat shell interpreter, jadi meskipun ada karakter aneh lolos,
//    itu nggak akan diinterpretasi sebagai shell command terpisah

const HOSTNAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * Cek apakah string adalah IPv4 valid (tiap oktet 0-255)
 */
function isValidIPv4(str) {
  const match = str.match(IPV4_REGEX);
  if (!match) return false;
  return match.slice(1).every((octet) => {
    if (octet.length > 1 && octet[0] === "0") return false; // tolak leading zero
    const num = parseInt(octet, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Cek apakah string adalah hostname/domain valid
 */
function isValidHostname(str) {
  if (str.length > 253) return false;
  return HOSTNAME_REGEX.test(str);
}

/**
 * Validasi utama: target harus IPv4 valid ATAU hostname valid.
 * Return { valid: boolean, reason?: string }
 */
function validateTarget(target) {
  if (typeof target !== "string" || target.trim() === "") {
    return { valid: false, reason: "Target kosong." };
  }

  const trimmed = target.trim();

  // Tolak keras kalau ada karakter yang jelas-jelas shell metacharacter
  // Ini lapis pertahanan tambahan di luar regex whitelist di atas
  if (/[;&|`$(){}<>\\'"!\s]/.test(trimmed)) {
    return { valid: false, reason: "Target mengandung karakter yang nggak diizinkan." };
  }

  if (isValidIPv4(trimmed) || isValidHostname(trimmed)) {
    return { valid: true, target: trimmed };
  }

  return { valid: false, reason: "Format target nggak valid. Harus IP address atau domain yang bener." };
}

/**
 * Validasi domain khusus buat DNS lookup (nggak nerima IP, harus domain)
 */
function validateDomain(domain) {
  if (typeof domain !== "string" || domain.trim() === "") {
    return { valid: false, reason: "Domain kosong." };
  }
  const trimmed = domain.trim();

  if (/[;&|`$(){}<>\\'"!\s]/.test(trimmed)) {
    return { valid: false, reason: "Domain mengandung karakter yang nggak diizinkan." };
  }

  if (!isValidHostname(trimmed)) {
    return { valid: false, reason: "Format domain nggak valid." };
  }

  return { valid: true, domain: trimmed };
}

module.exports = { validateTarget, validateDomain, isValidIPv4, isValidHostname };
