// ==========================================
// NETWORK TOOLS: DNS Lookup, Ping, Traceroute
// Nembak ke backend Express (bukan dijalanin di browser)
// ==========================================

// PENTING: sesuaiin ini pas deploy!
// - Kalau backend di-proxy lewat Nginx di path yang sama (misal domain.com/api/...),
//   biarin string kosong "" aja, biar fetch pake relative path.
// - Kalau backend jalan di port terpisah tanpa reverse proxy (misal domain.com:3001),
//   ganti jadi "http://domain-atau-ip-server:3001"
const BACKEND_BASE_URL = "";

/**
 * Helper umum: fetch ke endpoint backend, handle loading & error state di UI
 */
async function fetchNetToolResult(endpoint, params, outputElementId, buttonElementId) {
  const outputEl = document.getElementById(outputElementId);
  const buttonEl = document.getElementById(buttonElementId);

  const originalButtonText = buttonEl.textContent;
  buttonEl.disabled = true;
  buttonEl.textContent = "MEMPROSES...";
  buttonEl.classList.add("opacity-60", "cursor-not-allowed");

  outputEl.textContent = "Ngirim request ke server, tunggu bentar...";
  outputEl.classList.remove("text-softpink");

  try {
    const url = `${BACKEND_BASE_URL}/api/${endpoint}?${new URLSearchParams(params)}`;
    const response = await fetch(url);
    const data = await response.json();

    outputEl.textContent = data.output || "(nggak ada output)";
    if (!data.success) {
      outputEl.classList.add("text-softpink");
    }
  } catch (err) {
    outputEl.textContent = `⚠ Gagal konek ke backend. Pastiin server Node.js-nya jalan dan BACKEND_BASE_URL di nettools.js udah bener.\n\nDetail error: ${err.message}`;
    outputEl.classList.add("text-softpink");
  } finally {
    buttonEl.disabled = false;
    buttonEl.textContent = originalButtonText;
    buttonEl.classList.remove("opacity-60", "cursor-not-allowed");
  }
}

function handlePingSubmit(event) {
  event.preventDefault();
  const target = document.getElementById("ping-target-input").value.trim();
  if (!target) return;
  fetchNetToolResult("ping", { target }, "ping-output", "ping-submit-btn");
}

function handleTracerouteSubmit(event) {
  event.preventDefault();
  const target = document.getElementById("traceroute-target-input").value.trim();
  if (!target) return;
  fetchNetToolResult("traceroute", { target }, "traceroute-output", "traceroute-submit-btn");
}

function handleDnsSubmit(event) {
  event.preventDefault();
  const domain = document.getElementById("dns-domain-input").value.trim();
  if (!domain) return;
  fetchNetToolResult("dns", { domain }, "dns-output", "dns-submit-btn");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("ping-form").addEventListener("submit", handlePingSubmit);
  document.getElementById("traceroute-form").addEventListener("submit", handleTracerouteSubmit);
  document.getElementById("dns-form").addEventListener("submit", handleDnsSubmit);
});
