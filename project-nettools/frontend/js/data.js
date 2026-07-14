// ==========================================
// DATA STATIS: Tabel Referensi CIDR & Kelas IP
// ==========================================

/**
 * Generate tabel referensi CIDR /0 sampai /32
 * Isi: prefix, subnet mask, total alamat, usable host
 */
function generateCidrTable() {
  const rows = [];
  for (let prefix = 0; prefix <= 32; prefix++) {
    const maskInt = prefixToMaskInt(prefix);
    const mask = intToIp(maskInt);
    const hostBits = 32 - prefix;
    const totalAddresses = Math.pow(2, hostBits);

    let usableHosts;
    if (prefix === 32) usableHosts = 1;
    else if (prefix === 31) usableHosts = 2;
    else usableHosts = totalAddresses - 2;

    rows.push({
      prefix: `/${prefix}`,
      mask,
      totalAddresses,
      usableHosts,
    });
  }
  return rows;
}

/**
 * Data statis tabel kelas IP (A-E)
 * Catatan: ini konsep classful lama, sekarang real-world pake classless (CIDR)
 * tapi tetep relevan buat dasar teori
 */
const IP_CLASS_TABLE = [
  {
    kelas: "A",
    range: "1.0.0.0 – 126.255.255.255",
    defaultMask: "255.0.0.0 (/8)",
    firstOctetBinary: "0xxxxxxx",
    keterangan: "Jaringan skala besar, jumlah host per network paling banyak",
    color: "blue",
  },
  {
    kelas: "B",
    range: "128.0.0.0 – 191.255.255.255",
    defaultMask: "255.255.0.0 (/16)",
    firstOctetBinary: "10xxxxxx",
    keterangan: "Jaringan skala menengah, cocok buat kampus/perusahaan besar",
    color: "pink",
  },
  {
    kelas: "C",
    range: "192.0.0.0 – 223.255.255.255",
    defaultMask: "255.255.255.0 (/24)",
    firstOctetBinary: "110xxxxx",
    keterangan: "Jaringan skala kecil, paling umum dipake di LAN kantor/rumah",
    color: "green",
  },
  {
    kelas: "D",
    range: "224.0.0.0 – 239.255.255.255",
    defaultMask: "Tidak ada (bukan buat host)",
    firstOctetBinary: "1110xxxx",
    keterangan: "Khusus multicast, bukan buat pengalamatan host biasa",
    color: "yellow",
  },
  {
    kelas: "E",
    range: "240.0.0.0 – 255.255.255.255",
    defaultMask: "Tidak ada (bukan buat host)",
    firstOctetBinary: "1111xxxx",
    keterangan: "Direservasi buat eksperimen & riset, jarang dipake publik",
    color: "blue",
  },
];
