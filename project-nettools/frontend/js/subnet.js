// ==========================================
// LOGIC PERHITUNGAN SUBNETTING
// Semua operasi pake bitwise, bukan cuma matematika desimal biasa
// ==========================================

/**
 * Validasi format IP address (4 oktet, masing-masing 0-255)
 */
function isValidIP(ip) {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    if (part.length > 1 && part[0] === "0") return false; // tolak leading zero kayak "01"
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * Validasi prefix CIDR (0-32)
 */
function isValidPrefix(prefix) {
  const num = parseInt(prefix, 10);
  return !isNaN(num) && num >= 0 && num <= 32;
}

/**
 * Ubah IP string ("192.168.1.1") jadi integer 32-bit unsigned
 */
function ipToInt(ip) {
  return (
    ip.split(".").reduce((acc, octet) => acc * 256 + parseInt(octet, 10), 0) >>> 0
  );
}

/**
 * Ubah integer 32-bit jadi IP string
 */
function intToIp(int) {
  return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join(".");
}

/**
 * Ubah integer 32-bit jadi string biner (32 karakter, dikelompokkan per oktet)
 * Contoh output: "11000000.10101000.00000001.00000000"
 */
function intToBinaryGrouped(int) {
  const binary = (int >>> 0).toString(2).padStart(32, "0");
  return binary.match(/.{1,8}/g).join(".");
}

/**
 * Hitung subnet mask (integer) dari prefix
 * /26 -> 11111111.11111111.11111111.11000000
 */
function prefixToMaskInt(prefix) {
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/**
 * Fungsi utama: hitung semua hasil subnetting dari IP + prefix
 */
function calculateSubnet(ip, prefix) {
  const ipInt = ipToInt(ip);
  const maskInt = prefixToMaskInt(prefix);
  const wildcardInt = ~maskInt >>> 0;

  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;

  const hostBits = 32 - prefix;
  const totalAddresses = Math.pow(2, hostBits);

  let usableHosts, firstUsableInt, lastUsableInt;

  if (prefix === 32) {
    // /32 = 1 host tunggal, nggak ada network/broadcast concept
    usableHosts = 1;
    firstUsableInt = networkInt;
    lastUsableInt = networkInt;
  } else if (prefix === 31) {
    // /31 = point-to-point link (RFC 3021), 2 alamat dipake semua
    usableHosts = 2;
    firstUsableInt = networkInt;
    lastUsableInt = broadcastInt;
  } else {
    usableHosts = totalAddresses - 2;
    firstUsableInt = networkInt + 1;
    lastUsableInt = broadcastInt - 1;
  }

  return {
    ip,
    prefix,
    ipBinary: intToBinaryGrouped(ipInt),
    subnetMask: intToIp(maskInt),
    subnetMaskBinary: intToBinaryGrouped(maskInt),
    wildcardMask: intToIp(wildcardInt),
    networkAddress: intToIp(networkInt),
    networkBinary: intToBinaryGrouped(networkInt),
    broadcastAddress: intToIp(broadcastInt),
    broadcastBinary: intToBinaryGrouped(broadcastInt),
    firstUsable: intToIp(firstUsableInt),
    lastUsable: intToIp(lastUsableInt),
    totalAddresses,
    usableHosts,
    hostBits,
    networkBits: prefix,
  };
}

// ==========================================
// STEP-BY-STEP EXPLANATION (rumus manual ala "trik oktet")
// Ini generate breakdown ala cara ngitung manual pake tabel blok,
// biar orang paham DARI MANA angka network/broadcast itu muncul
// ==========================================

function generateStepExplanation(result) {
  const n = result.hostBits;
  const ipTotal = result.totalAddresses;
  const hostValid = result.usableHosts;
  const maskOctets = result.subnetMask.split(".").map(Number);

  // Cari oktet "menarik" - oktet pertama yang nilainya bukan 255
  const interestingIndex = maskOctets.findIndex((o) => o !== 255);

  let blockInfo = null;

  // Blok cuma masuk akal kalau prefix-nya motong DI TENGAH satu oktet
  // (bukan pas di batas /8, /16, /24, /32 - itu nggak ada "blok campuran")
  if (interestingIndex !== -1 && maskOctets[interestingIndex] !== 0) {
    const maskValue = maskOctets[interestingIndex];
    const blockSize = 256 - maskValue;
    const blocks = [];
    for (let start = 0; start < 256; start += blockSize) {
      blocks.push(start);
    }

    const ipOctets = result.ip.split(".").map(Number);
    const currentValue = ipOctets[interestingIndex];
    const currentBlockStart = Math.floor(currentValue / blockSize) * blockSize;

    blockInfo = {
      octetPosition: interestingIndex + 1, // 1-indexed biar gampang dibaca orang awam
      maskValue,
      blockSize,
      blocks,
      currentBlockStart,
    };
  }

  return {
    n,
    ipTotal,
    hostValid,
    subnetMaskFull: result.subnetMask,
    blockInfo,
  };
}

// ==========================================
// VLSM (Variable Length Subnet Mask) CALCULATOR
// Bagi 1 network besar jadi beberapa subnet ukuran BEDA-BEDA
// sesuai kebutuhan host tiap segmen, biar nggak ada IP kebuang percuma
// ==========================================

/**
 * Cari jumlah host bit (n) minimal yang cukup buat nampung `hostsNeeded`
 * Formula: 2^n - 2 >= hostsNeeded
 */
function findMinimalHostBits(hostsNeeded) {
  let n = 2; // minimal /30 (2 usable host), biar tetep ada network+broadcast
  while (Math.pow(2, n) - 2 < hostsNeeded) {
    n++;
    if (n > 30) throw new Error("Jumlah host yang diminta kegedean, nggak masuk akal buat 1 subnet.");
  }
  return n;
}

/**
 * requirements: [{ label: string, hosts: number }, ...]
 * Return array alokasi subnet, diurutin dari kebutuhan host TERBESAR ke TERKECIL
 * (ini aturan wajib VLSM biar alokasi nggak bentrok/nggak boros)
 */
function calculateVLSM(baseIp, basePrefix, requirements) {
  const baseMaskInt = prefixToMaskInt(basePrefix);
  const baseNetworkInt = (ipToInt(baseIp) & baseMaskInt) >>> 0;
  const baseTotal = Math.pow(2, 32 - basePrefix);
  const baseEndInt = baseNetworkInt + baseTotal - 1;

  const sorted = requirements
    .map((r, idx) => ({ ...r, idx }))
    .sort((a, b) => b.hosts - a.hosts);

  let cursor = baseNetworkInt;
  const allocations = [];

  for (const req of sorted) {
    const n = findMinimalHostBits(req.hosts);
    const blockSize = Math.pow(2, n);

    // Ratain cursor ke kelipatan blockSize terdekat (biar subnet align dengan bener)
    const networkInt = Math.ceil(cursor / blockSize) * blockSize;
    const broadcastInt = networkInt + blockSize - 1;

    if (broadcastInt > baseEndInt) {
      throw new Error(
        `Kapasitas ${baseIp}/${basePrefix} nggak cukup. Segmen "${req.label}" butuh ${req.hosts} host tapi udah kehabisan alamat.`
      );
    }

    const prefix = 32 - n;
    allocations.push({
      label: req.label,
      hostsNeeded: req.hosts,
      prefix,
      mask: intToIp(prefixToMaskInt(prefix)),
      network: intToIp(networkInt),
      broadcast: intToIp(broadcastInt),
      firstUsable: intToIp(networkInt + 1),
      lastUsable: intToIp(broadcastInt - 1),
      totalAddresses: blockSize,
      usableHosts: blockSize - 2,
    });

    cursor = broadcastInt + 1;
  }

  return allocations;
}
