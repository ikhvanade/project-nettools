// ==========================================
// BACKEND: Express server buat Network Tools
// (Ping, Traceroute, DNS Lookup)
// ==========================================

const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const dns = require("dns").promises;
const { validateTarget, validateDomain } = require("./utils/validate");

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors()); // biar bisa ditembak dari frontend (beda origin/port)
app.use(express.json());

// Timeout buat command yang jalan kelamaan (traceroute paling rawan nge-hang)
const COMMAND_TIMEOUT_MS = 15000;

/**
 * Wrapper buat execFile jadi Promise, plus timeout handling.
 * PENTING: pake execFile (bukan exec), artinya command dijalanin LANGSUNG
 * tanpa lewat shell (/bin/sh -c "..."), jadi argumen nggak akan diinterpretasi
 * ulang sebagai shell syntax meskipun ada karakter aneh yang lolos validasi.
 */
function runCommand(command, args) {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { timeout: COMMAND_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          // Command gagal / timeout / exit code non-zero - tetep return stdout
          // parsial kalau ada, biar user liat progress-nya sampe mana
          resolve({
            success: false,
            output: stdout || stderr || error.message,
          });
        } else {
          resolve({ success: true, output: stdout });
        }
      }
    );
  });
}

// --- ENDPOINT: PING ---
// GET /api/ping?target=8.8.8.8
app.get("/api/ping", async (req, res) => {
  const { target } = req.query;
  const validation = validateTarget(target);

  if (!validation.valid) {
    return res.status(400).json({ success: false, output: `⚠ ${validation.reason}` });
  }

  // -c 4 = kirim 4 paket (Linux). -W 3 = timeout 3 detik per paket.
  const result = await runCommand("ping", ["-c", "4", "-W", "3", validation.target]);
  res.json(result);
});

// --- ENDPOINT: TRACEROUTE ---
// GET /api/traceroute?target=google.com
app.get("/api/traceroute", async (req, res) => {
  const { target } = req.query;
  const validation = validateTarget(target);

  if (!validation.valid) {
    return res.status(400).json({ success: false, output: `⚠ ${validation.reason}` });
  }

  // -m 15 = maksimal 15 hop, biar nggak nunggu lama banget
  const result = await runCommand("traceroute", ["-m", "15", validation.target]);
  res.json(result);
});

// --- ENDPOINT: DNS LOOKUP ---
// GET /api/dns?domain=google.com
app.get("/api/dns", async (req, res) => {
  const { domain } = req.query;
  const validation = validateDomain(domain);

  if (!validation.valid) {
    return res.status(400).json({ success: false, output: `⚠ ${validation.reason}` });
  }

  const target = validation.domain;

  // Jalanin semua jenis record secara paralel, masing-masing boleh gagal
  // sendiri-sendiri tanpa bikin request lain ikut gagal (Promise.allSettled)
  const [aResult, cnameResult, mxResult] = await Promise.allSettled([
    dns.resolve4(target),
    dns.resolveCname(target),
    dns.resolveMx(target),
  ]);

  const formatRecord = (result, formatter) => {
    if (result.status === "fulfilled") return result.value.map(formatter);
    return []; // ENODATA / ENOTFOUND / dll - domain emang nggak punya record jenis ini
  };

  const aRecords = formatRecord(aResult, (ip) => ip);
  const cnameRecords = formatRecord(cnameResult, (name) => name);
  const mxRecords = formatRecord(mxResult, (mx) => `${mx.exchange} (priority: ${mx.priority})`);

  // Build output ala teks command line, biar konsisten sama ping/traceroute
  let output = `DNS Lookup buat: ${target}\n\n`;
  output += `A Record:\n${aRecords.length ? aRecords.map((r) => `  ${r}`).join("\n") : "  (nggak ada)"}\n\n`;
  output += `CNAME Record:\n${cnameRecords.length ? cnameRecords.map((r) => `  ${r}`).join("\n") : "  (nggak ada)"}\n\n`;
  output += `MX Record:\n${mxRecords.length ? mxRecords.map((r) => `  ${r}`).join("\n") : "  (nggak ada)"}`;

  const hasAnyRecord = aRecords.length || cnameRecords.length || mxRecords.length;
  res.json({ success: Boolean(hasAnyRecord), output });
});

// --- Health check (buat cek backend hidup atau nggak, berguna pas setup Nginx) ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Network Tools backend jalan di port ${PORT}`);
});
