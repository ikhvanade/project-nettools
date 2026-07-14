// ==========================================
// RENDER: nampilin hasil perhitungan ke DOM
// ==========================================

const COLOR_MAP = {
  blue: "bg-[#B8C4E8]",
  pink: "bg-[#F4B8C4]",
  green: "bg-[#C8E6C9]",
  yellow: "bg-[#FFD97D]",
};

/**
 * Render 32 kotak bit (signature element) - bedain warna bit network vs host
 */
function renderBitGrid(containerId, binaryGrouped, networkBits) {
  const container = document.getElementById(containerId);
  const bits = binaryGrouped.replace(/\./g, "").split("");

  container.innerHTML = bits
    .map((bit, i) => {
      const isNetworkBit = i < networkBits;
      const bgColor = isNetworkBit ? "bg-[#B8C4E8]" : "bg-[#FFD97D]";
      const marginRight = (i + 1) % 8 === 0 && i !== 31 ? "mr-2" : "mr-0.5";
      return `<span class="inline-flex items-center justify-center w-6 h-7 md:w-7 md:h-8 ${bgColor} border-2 border-[#1A1A1A] text-xs md:text-sm font-mono font-bold ${marginRight} mb-1">${bit}</span>`;
    })
    .join("");
}

/**
 * Render hasil perhitungan utama ke card hasil
 */
function renderResults(result) {
  document.getElementById("result-section").classList.remove("hidden");

  const fields = {
    "res-ip": result.ip,
    "res-prefix": `/${result.prefix}`,
    "res-mask": result.subnetMask,
    "res-wildcard": result.wildcardMask,
    "res-network": result.networkAddress,
    "res-broadcast": result.broadcastAddress,
    "res-first-usable": result.firstUsable,
    "res-last-usable": result.lastUsable,
    "res-total": result.totalAddresses.toLocaleString("id-ID"),
    "res-usable": result.usableHosts.toLocaleString("id-ID"),
    "res-hostbits": result.hostBits,
    "res-networkbits": result.networkBits,
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });

  renderBitGrid("bit-grid-ip", result.ipBinary, result.networkBits);
  renderBitGrid("bit-grid-mask", result.subnetMaskBinary, result.networkBits);
  renderBitGrid("bit-grid-network", result.networkBinary, result.networkBits);
}

/**
 * Render tabel referensi CIDR
 */
function renderCidrTable() {
  const tbody = document.getElementById("cidr-table-body");
  const rows = generateCidrTable();

  tbody.innerHTML = rows
    .map(
      (row, i) => `
      <tr class="${i % 2 === 0 ? "bg-[#FDF6EC]" : "bg-white"} border-b-2 border-[#1A1A1A]">
        <td class="px-3 py-2 font-mono font-bold border-r-2 border-[#1A1A1A]">${row.prefix}</td>
        <td class="px-3 py-2 font-mono border-r-2 border-[#1A1A1A]">${row.mask}</td>
        <td class="px-3 py-2 font-mono text-right border-r-2 border-[#1A1A1A]">${row.totalAddresses.toLocaleString("id-ID")}</td>
        <td class="px-3 py-2 font-mono text-right">${row.usableHosts.toLocaleString("id-ID")}</td>
      </tr>`
    )
    .join("");
}

/**
 * Render tabel kelas IP (A-E)
 */
function renderIpClassTable() {
  const container = document.getElementById("ip-class-cards");

  container.innerHTML = IP_CLASS_TABLE.map((item) => {
    const bgClass = COLOR_MAP[item.color];
    return `
      <div class="border-4 border-[#1A1A1A] ${bgClass} p-4 shadow-[6px_6px_0px_#1A1A1A]">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-2xl font-black">KELAS ${item.kelas}</h3>
          <span class="font-mono text-xs bg-[#1A1A1A] text-[#FDF6EC] px-2 py-1">${item.firstOctetBinary}</span>
        </div>
        <p class="font-mono text-sm mb-1"><span class="font-bold">Range:</span> ${item.range}</p>
        <p class="font-mono text-sm mb-1"><span class="font-bold">Default Mask:</span> ${item.defaultMask}</p>
        <p class="text-sm mt-2">${item.keterangan}</p>
      </div>`;
  }).join("");
}

/**
 * Render breakdown "cara kerja" perhitungan - versi ngajarin manual pake tabel blok
 */
function renderStepExplanation(result) {
  const steps = generateStepExplanation(result);
  const container = document.getElementById("step-explanation");
  container.classList.remove("hidden");

  let blockHtml = "";
  if (steps.blockInfo) {
    const { octetPosition, maskValue, blockSize, blocks, currentBlockStart } = steps.blockInfo;
    const blockBadges = blocks
      .map((b) => {
        const isCurrent = b === currentBlockStart;
        const cls = isCurrent
          ? "bg-softyellow border-ink shadow-brutal-sm scale-110"
          : "bg-white border-ink";
        return `<span class="inline-block border-4 ${cls} px-3 py-1.5 font-mono font-bold text-sm m-1 transition-transform">${b}</span>`;
      })
      .join("");

    blockHtml = `
      <div class="mt-4 pt-4 border-t-4 border-dashed border-ink/30">
        <p class="text-sm mb-2">
          Oktet ke-<span class="font-bold">${octetPosition}</span> dari subnet mask nilainya <span class="font-mono font-bold">${maskValue}</span>,
          jadi <span class="font-bold">Blok Size = 256 − ${maskValue} = ${blockSize}</span>.
          Ini daftar "loncatan blok"-nya, kotak kuning yang nge-highlight itu blok tempat IP lo berada:
        </p>
        <div class="flex flex-wrap">${blockBadges}</div>
      </div>`;
  } else {
    blockHtml = `
      <div class="mt-4 pt-4 border-t-4 border-dashed border-ink/30">
        <p class="text-sm">
          Prefix <span class="font-mono font-bold">/${result.prefix}</span> ini pas banget di batas oktet, jadi nggak ada "blok campuran" dalam 1 oktet buat ditabelin — host langsung ngambil satu oktet penuh (0-255).
        </p>
      </div>`;
  }

  container.innerHTML = `
    <h3 class="font-display text-lg mb-4">GIMANA CARA DAPET HASIL DI ATAS?</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      <div class="bg-cream border-2 border-ink px-3 py-2">
        <span class="font-bold">n</span> (sisa bit host) = 32 − ${result.prefix}
        <br /><span class="font-mono font-bold text-base">n = ${steps.n}</span>
      </div>
      <div class="bg-cream border-2 border-ink px-3 py-2">
        <span class="font-bold">IPtotal</span> (blok size) = 2<sup>${steps.n}</sup>
        <br /><span class="font-mono font-bold text-base">IPtotal = ${steps.ipTotal}</span>
      </div>
      <div class="bg-cream border-2 border-ink px-3 py-2">
        <span class="font-bold">Host Valid</span> = IPtotal − 2
        <br /><span class="font-mono font-bold text-base">Host Valid = ${steps.ipTotal} − 2 = ${steps.hostValid}</span>
      </div>
      <div class="bg-cream border-2 border-ink px-3 py-2">
        <span class="font-bold">Subnet Mask</span> = 255.255.255.255 − wildcard
        <br /><span class="font-mono font-bold text-base">Subnet Mask = ${steps.subnetMaskFull}</span>
      </div>
    </div>
    ${blockHtml}
    <p class="text-xs mt-4 opacity-70">
      Habis nemu blok yang pas, Network ID = angka awal blok itu, Broadcast = satu angka sebelum blok berikutnya, Host Awal/Akhir = di antara keduanya. Persis kayak yang lo tulis di catatan lo dulu, bro.
    </p>
  `;
}

// ==========================================
// VLSM: dynamic rows + handler + render tabel
// ==========================================

let vlsmRowCounter = 0;

/**
 * Nambah 1 baris input segmen (label + jumlah host) ke form VLSM
 */
function addVlsmRow(defaultLabel = "", defaultHosts = "") {
  vlsmRowCounter++;
  const rowId = `vlsm-row-${vlsmRowCounter}`;
  const wrapper = document.getElementById("vlsm-rows");

  const row = document.createElement("div");
  row.id = rowId;
  row.className = "flex gap-2 items-center";
  row.innerHTML = `
    <input type="text" placeholder="Nama segmen (misal: Cabang A)" value="${defaultLabel}"
      class="vlsm-label flex-1 border-4 border-ink px-3 py-2 font-mono text-sm bg-cream focus:outline-none focus:bg-softblue/30" />
    <input type="text" placeholder="Jml host" value="${defaultHosts}"
      class="vlsm-hosts w-28 border-4 border-ink px-3 py-2 font-mono text-sm bg-cream focus:outline-none focus:bg-softblue/30" />
    <button type="button" onclick="document.getElementById('${rowId}').remove()"
      class="bg-softpink border-4 border-ink shadow-brutal-sm px-3 py-2 font-bold text-sm active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all">
      ✕
    </button>
  `;
  wrapper.appendChild(row);
}

/**
 * Handle submit form VLSM
 */
function handleVlsmCalculate(event) {
  event.preventDefault();
  const errorEl = document.getElementById("vlsm-error-message");
  errorEl.classList.add("hidden");
  document.getElementById("vlsm-result-section").classList.add("hidden");

  const baseIp = document.getElementById("vlsm-ip-input").value.trim();
  const basePrefix = document.getElementById("vlsm-prefix-input").value.trim();

  if (!isValidIP(baseIp)) {
    errorEl.textContent = "⚠ IP Address awal nggak valid.";
    errorEl.classList.remove("hidden");
    return;
  }
  if (!isValidPrefix(basePrefix)) {
    errorEl.textContent = "⚠ Prefix awal nggak valid. Harus 0-32.";
    errorEl.classList.remove("hidden");
    return;
  }

  const rows = document.querySelectorAll("#vlsm-rows > div");
  if (rows.length === 0) {
    errorEl.textContent = "⚠ Tambahin minimal 1 segmen dulu bro.";
    errorEl.classList.remove("hidden");
    return;
  }

  const requirements = [];
  for (const row of rows) {
    const label = row.querySelector(".vlsm-label").value.trim() || "Tanpa nama";
    const hostsRaw = row.querySelector(".vlsm-hosts").value.trim();
    const hosts = parseInt(hostsRaw, 10);

    if (!hostsRaw || isNaN(hosts) || hosts < 1) {
      errorEl.textContent = `⚠ Jumlah host buat segmen "${label}" harus angka lebih dari 0.`;
      errorEl.classList.remove("hidden");
      return;
    }
    requirements.push({ label, hosts });
  }

  try {
    const allocations = calculateVLSM(baseIp, parseInt(basePrefix, 10), requirements);
    renderVlsmResults(allocations, baseIp, basePrefix);
  } catch (err) {
    errorEl.textContent = `⚠ ${err.message}`;
    errorEl.classList.remove("hidden");
  }
}

/**
 * Render tabel hasil alokasi VLSM
 */
function renderVlsmResults(allocations, baseIp, basePrefix) {
  const section = document.getElementById("vlsm-result-section");
  section.classList.remove("hidden");

  const totalUsed = allocations.reduce((sum, a) => sum + a.totalAddresses, 0);

  document.getElementById("vlsm-summary").textContent =
    `Dari ${baseIp}/${basePrefix}, total ${totalUsed.toLocaleString("id-ID")} alamat kepake buat ${allocations.length} segmen.`;

  const tbody = document.getElementById("vlsm-table-body");
  tbody.innerHTML = allocations
    .map(
      (a, i) => `
      <tr class="${i % 2 === 0 ? "bg-[#FDF6EC]" : "bg-white"} border-b-2 border-ink">
        <td class="px-3 py-2 font-bold border-r-2 border-ink">${a.label}</td>
        <td class="px-3 py-2 text-right font-mono border-r-2 border-ink">${a.hostsNeeded}</td>
        <td class="px-3 py-2 font-mono border-r-2 border-ink">/${a.prefix}</td>
        <td class="px-3 py-2 font-mono border-r-2 border-ink">${a.network}</td>
        <td class="px-3 py-2 font-mono border-r-2 border-ink">${a.broadcast}</td>
        <td class="px-3 py-2 font-mono border-r-2 border-ink">${a.firstUsable} – ${a.lastUsable}</td>
        <td class="px-3 py-2 text-right font-mono">${a.usableHosts}</td>
      </tr>`
    )
    .join("");
}

function handleCalculate(event) {
  event.preventDefault();
  const errorEl = document.getElementById("error-message");
  errorEl.classList.add("hidden");

  const ipInput = document.getElementById("ip-input").value.trim();
  const prefixInput = document.getElementById("prefix-input").value.trim();

  if (!isValidIP(ipInput)) {
    errorEl.textContent = "⚠ IP Address nggak valid. Format yang bener: 192.168.1.0";
    errorEl.classList.remove("hidden");
    document.getElementById("result-section").classList.add("hidden");
    return;
  }

  if (!isValidPrefix(prefixInput)) {
    errorEl.textContent = "⚠ Prefix CIDR nggak valid. Harus angka 0-32";
    errorEl.classList.remove("hidden");
    document.getElementById("result-section").classList.add("hidden");
    return;
  }

  const result = calculateSubnet(ipInput, parseInt(prefixInput, 10));
  renderResults(result);
  renderStepExplanation(result);
}

// Init saat halaman load
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("calculator-form").addEventListener("submit", handleCalculate);
  renderCidrTable();
  renderIpClassTable();

  const toggleBtn = document.getElementById("toggle-cidr-table");
  const cidrWrapper = document.getElementById("cidr-table-wrapper");
  toggleBtn.addEventListener("click", () => {
    cidrWrapper.classList.toggle("hidden");
    toggleBtn.textContent = cidrWrapper.classList.contains("hidden")
      ? "TAMPILKAN TABEL ▾"
      : "SEMBUNYIKAN TABEL ▴";
  });

  // VLSM init: kasih 2 baris contoh default biar user nggak bingung mulai dari mana
  document.getElementById("vlsm-form").addEventListener("submit", handleVlsmCalculate);
  document.getElementById("vlsm-add-row").addEventListener("click", () => addVlsmRow());
  addVlsmRow("Kantor Pusat", "100");
  addVlsmRow("Cabang A", "50");
});
