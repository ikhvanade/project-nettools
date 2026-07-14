# Network Tools + IP Subnet Calculator

Web utilitas jaringan internal. Frontend statis (HTML/CSS/Tailwind/vanilla JS) + backend Node.js/Express buat fitur yang butuh akses system command (ping, traceroute, DNS lookup).

## Struktur Folder

```
project-nettools/
├── frontend/                  # Static site, nggak butuh Node.js buat jalan
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── data.js            # data statis tabel CIDR & kelas IP
│       ├── subnet.js          # logic kalkulator subnetting + VLSM
│       ├── render.js          # render DOM buat kalkulator subnetting
│       └── nettools.js        # fetch ke backend (ping/traceroute/dns)
└── backend/                   # Express API, WAJIB Node.js buat jalan
    ├── server.js
    ├── package.json
    └── utils/validate.js      # validasi input (anti command injection)
```

## Kenapa dipisah Frontend & Backend

Kalkulator subnetting itu pure matematika, aman dijalanin di browser client-side. Tapi **ping, traceroute, dan DNS lookup butuh akses ke system command Linux** (`ping`, `traceroute`) — ini nggak bisa dan nggak boleh dijalanin langsung di browser. Makanya butuh backend yang jalan di server, browser cuma nembak request lewat `fetch()`.

## Keamanan (WAJIB DIBACA sebelum deploy)

Endpoint `/api/ping` dan `/api/traceroute` nerima input dari user terus dipake buat jalanin command system. Ini beresiko **command injection** kalau nggak divalidasi ketat. Mitigasi yang udah diimplementasi di `backend/utils/validate.js` dan `backend/server.js`:

1. **Whitelist validasi ketat** — target cuma diterima kalau formatnya IPv4 valid atau hostname valid (regex whitelist), semua karakter shell metacharacter (`; & | \` $ ( ) < > \ ' " !` dan spasi) ditolak keras.
2. **`execFile()`, bukan `exec()`** — command dijalanin langsung tanpa lewat shell interpreter, jadi meskipun ada karakter aneh lolos validasi, itu nggak akan diinterpretasi ulang sebagai command shell terpisah.
3. **Timeout 15 detik** per command — biar server nggak keblokir kalau ada request ke target yang nggak respond.

**Yang belum ada tapi disaranin ditambahin kalau mau lebih aman lagi** (di luar scope awal, tapi worth dipikirin sebelum expose ke internet publik):
- Rate limiting (misal pake `express-rate-limit`) — biar orang nggak bisa spam ping/traceroute berkali-kali jadi beban server
- Autentikasi (misal API key sederhana) kalau tools ini bakal diakses lebih dari internal tim lo

## Cara Deploy di Ubuntu Server

### 1. Install dependency system

```bash
sudo apt update
sudo apt install -y nodejs npm traceroute
# ping biasanya udah ada bawaan Ubuntu (paket iputils-ping)
```

Cek versi Node.js minimal 18+ (`node -v`). Kalau versi Ubuntu-nya jadul dan Node bawaan `apt` kelamaan, pake NodeSource:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Copy project ke server

```bash
scp -r project-nettools/ user@ip-server-lo:/var/www/
# atau kalau lo udah push ke GitHub:
git clone https://github.com/username/project-nettools.git /var/www/project-nettools
```

### 3. Install & jalanin backend

```bash
cd /var/www/project-nettools/backend
npm install
node server.js
# harusnya keluar: "Network Tools backend jalan di port 3001"
```

Test dulu manual biar yakin jalan:
```bash
curl http://localhost:3001/api/health
curl "http://localhost:3001/api/dns?domain=google.com"
```

### 4. Bikin backend jalan permanen (systemd service)

Biar backend otomatis restart kalau server reboot / crash, jangan cuma `node server.js` doang (itu bakal mati kalau SSH session ditutup). Bikin file service:

```bash
sudo nano /etc/systemd/system/nettools-backend.service
```

Isi:
```ini
[Unit]
Description=Network Tools Backend API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/project-nettools/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

Lalu aktifin:
```bash
sudo systemctl daemon-reload
sudo systemctl enable nettools-backend
sudo systemctl start nettools-backend
sudo systemctl status nettools-backend   # pastiin "active (running)"
```

### 5. Setup Nginx (serve frontend + reverse proxy ke backend)

Ini bagian paling penting biar frontend & backend nyatu di 1 domain (jadi nggak perlu ganti `BACKEND_BASE_URL` di `nettools.js`, biarin string kosong).

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/nettools
```

Isi:
```nginx
server {
    listen 80;
    server_name domain-lo.com;  # ganti sesuai domain yang lo beli

    # Serve frontend statis
    root /var/www/project-nettools/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Reverse proxy semua request /api/* ke backend Node.js
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Aktifin config:
```bash
sudo ln -s /etc/nginx/sites-available/nettools /etc/nginx/sites-enabled/
sudo nginx -t   # test config, pastiin "syntax is ok"
sudo systemctl reload nginx
```

Karena request `/api/*` udah di-proxy sama domain yang sama, `BACKEND_BASE_URL` di `frontend/js/nettools.js` **biarin string kosong `""`** — nggak perlu diganti.

### 6. (Opsional tapi disaranin) HTTPS via Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d domain-lo.com
```

### 7. Firewall

```bash
sudo ufw allow 'Nginx Full'   # buka port 80 & 443
sudo ufw allow OpenSSH        # jangan lupa biar SSH lo nggak ke-lock
sudo ufw enable
```
Port 3001 (backend) **nggak perlu** dibuka ke publik — cukup diakses lewat `localhost` oleh Nginx aja. Ini best practice: makin dikit port yang expose ke luar, makin kecil attack surface.

## Testing Cepat Setelah Deploy

Buka `http://domain-lo.com` di browser, coba:
1. DNS Lookup domain apapun (misal `github.com`)
2. Ping ke `8.8.8.8`
3. Traceroute ke `1.1.1.1`

Kalau ada yang error "Gagal konek ke backend", cek:
- `sudo systemctl status nettools-backend` — backend jalan atau nggak
- `sudo nginx -t` — config Nginx valid atau nggak
- Buka DevTools browser (F12) → tab Network, liat request ke `/api/...` gagal di step mana
