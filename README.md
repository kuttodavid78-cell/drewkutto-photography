# Drew Kutto Photography — Full Stack Website

A Modern Tropical Minimalist photography portfolio with M-Pesa (Daraja 3.0) payment integration.

## Architecture

```
INTERNET
    │
    ├── CUSTOMER SITE (frontend/index.html)
    │       └── Book sessions, browse gallery, buy prints, reserve albums
    │
    └── ADMIN PANEL (frontend/admin.html)
            └── Manage bookings, content, M-Pesa settings, blocked dates

Both frontends talk to:

NODE / EXPRESS BACKEND (backend/server.js :5000)
    │
    ├── BOOKINGS    → /api/bookings
    ├── PAYMENTS    → /api/mpesa
    ├── AUTH        → /api/auth
    ├── CONTENT     → /api/content
    └── SETTINGS    → /api/admin
    │
    ├── MONGODB (Atlas)
    └── DARAJA 3.0 → M-PESA → CUSTOMER PHONE → PIN → CALLBACK
```

### Payment Flow

```
BOOKING created (Status: PENDING)
    │
    │ STK Push sent to customer phone
    ▼
PAYMENT created (CheckoutRequestID: ws_CO_xxxxx, Status: PENDING)
    │
    │ Customer enters PIN on phone
    ▼
DARAJA CALLBACK → /api/mpesa/callback
    │
    ├── ResultCode 0 (success)
    │       ├── PAYMENT.status = PAID
    │       ├── PAYMENT.mpesaReceipt = ABC123XYZ
    │       └── BOOKING.status = CONFIRMED
    │
    └── ResultCode ≠ 0 (cancelled/failed)
            └── PAYMENT.status = FAILED
```

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier works)
- Safaricom Daraja API account (sandbox for testing)

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Seed the admin account

```bash
npm run seed:admin
```
This creates the admin user from `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env`.
If that admin already exists, running it again **resets the password**.

You can also pass the login directly, without keeping the password in `.env`:

```bash
npm run seed:admin -- drewkutto drewkutto2025
```

Current admin login: username `drewkutto`, password `drewkutto2025`. Change the password
after first login (Settings → Change Admin Password). Every password box in the admin
panel has an eye button to show/hide what you type.

### 4. Start the backend

```bash
npm run dev    # development (auto-reload)
npm start      # production
```

### 5. Open the site

- **Customer site**: Open `frontend/index.html` in your browser
- **Admin panel**: Open `frontend/admin.html` in your browser

Default admin credentials (from .env):
- Username: `drewkutto`
- Password: `drewkutto2025`

---

## Testing M-Pesa Locally (Sandbox)

The sandbox credentials are pre-configured in `.env`. The only thing that won't work
locally is the **Safaricom callback** — Safaricom's servers cannot reach `localhost`.

### Option A: ngrok (recommended for full end-to-end testing)

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 5000

# Copy the HTTPS URL (e.g. https://abc123.ngrok.io) and set in .env:
MPESA_CALLBACK_URL=https://abc123.ngrok.io/api/mpesa/callback

# Restart the backend
npm run dev
```

After paying in the sandbox, Safaricom will POST to your ngrok URL,
which forwards to your local server — booking goes from PENDING → CONFIRMED.

### Option B: Manual status polling (no ngrok needed)

The frontend polls `/api/mpesa/status/:checkoutRequestId` every 6 seconds,
which in turn queries Safaricom directly. This works in sandbox even without
the callback, but takes a bit longer to update.

### Sandbox test phone numbers

Safaricom sandbox accepts any `2547XXXXXXXX` number format.
Use `254708374149` or `254712345678` for sandbox STK push tests.

---

## Photo uploads (admin panel)

- Accepts JPG, PNG, WebP, GIF, AVIF and **HEIC/HEIF (iPhone photos)**. HEIC files are
  converted automatically to high-quality JPG on upload so every browser can show them.
- Defaults: **100 MB per image, 40 images per upload** (hero: 5). Change with
  `MAX_UPLOAD_MB` and `MAX_UPLOAD_FILES` in `.env`.
- A progress bar shows while photos upload.
- Removing an image (or deleting a style, album or print) in the admin panel also deletes
  the file from the server, so disk space is freed.
- **Storage location:** by default photos are saved in `backend/uploads`. On hosts such as
  Render, Railway or Fly.io that folder is wiped on every restart/redeploy unless you attach
  a persistent disk. Mount one and set `UPLOAD_DIR` in your host's environment settings
  (for example `UPLOAD_DIR=/var/data/uploads`).
- **After updating, run `npm install` inside `backend/`** (once — installs the HEIC
  converter), then restart the server.
- Camera RAW files (CR2, NEF, ARW, DNG) and TIFF are not supported — export them as JPG first.

## Keeping secrets out of Git

`.gitignore` keeps `backend/.env` and `node_modules/` out of the repository. If they were
committed before, stop tracking them (this keeps the files on your computer):

```bash
git rm -r --cached backend/.env backend/node_modules
git add .gitignore
git commit -m "Stop tracking secrets and node_modules"
git push
```

Anything that was ever committed stays in Git history, so rotate those secrets (database
password, `JWT_SECRET`, M-Pesa keys) if the repository is, or ever was, public.
Set the same values in your host's *Environment Variables* settings instead of a committed `.env`.

## Production Deployment

### Environment changes for live

1. **`.env` updates:**
   ```
   NODE_ENV=production
   MPESA_ENV=production
   MPESA_CONSUMER_KEY=<live key>
   MPESA_CONSUMER_SECRET=<live secret>
   MPESA_SHORTCODE=<your paybill>
   MPESA_PASSKEY=<live passkey>
   MPESA_CALLBACK_URL=https://yourdomain.com/api/mpesa/callback
   FRONTEND_ORIGIN=https://yourdomain.com
   ```

2. **Admin panel M-Pesa settings:** After deploying, log into the admin panel and
   save your live credentials there as well (they're stored encrypted in MongoDB
   and take precedence over .env).

3. **Enable Official Launch mode:** In the admin panel → Launch Settings, toggle
   "Official Launch" ON and enter Drew's phone number. This routes STK pushes to
   Drew's phone for in-person transactions.

### Hosting options

**Railway / Render / Fly.io (recommended)**
- Set `NODE_ENV=production` in environment variables
- The server will serve `frontend/` files statically
- Single URL for everything: `https://drewkuttophotography.com`

**VPS (Ubuntu + PM2 + Nginx)**
```bash
npm install -g pm2
pm2 start backend/server.js --name dkp
pm2 save && pm2 startup
```

Nginx reverse proxy example:
```nginx
server {
    server_name drewkuttophotography.com;
    # IMPORTANT: Nginx rejects uploads over 1 MB by default. Without these lines,
    # admin photo uploads fail even for small files.
    client_max_body_size 200M;
    proxy_read_timeout 1800s;
    proxy_send_timeout 1800s;
    location / { proxy_pass http://localhost:5000; }
}
```

---

## API Reference

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/content/styles` | Photography styles |
| GET | `/api/content/prints` | Shop prints |
| GET | `/api/content/albums` | Album packages |
| GET | `/api/content/hero` | Hero images |
| GET | `/api/bookings/availability` | Booked/blocked dates |
| POST | `/api/bookings` | Create booking / purchase |
| GET | `/api/bookings/:orderId/status` | Check order status |
| GET | `/api/mpesa/status/:checkoutRequestId` | Check payment status (polls Safaricom) |
| POST | `/api/mpesa/callback` | Safaricom callback (called by Safaricom) |
| POST | `/api/auth/login` | Admin login |

### Admin Endpoints (require Bearer token)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bookings` | List all orders |
| DELETE | `/api/bookings/:id` | Delete order |
| GET/POST | `/api/admin/...` | Settings management |
| CRUD | `/api/content/...` | Content management |

---

## Order Types

| Type | accountRef | What's charged |
|------|-----------|----------------|
| `booking` | `Booking` | `depositPercent`% of session fee |
| `album_deposit` | `Album` | `depositPercent`% of album price |
| `print_purchase` | `Print` | Full print price |

---

## Troubleshooting

**"This style has no session fee configured"**
→ Go to Admin → Photography Styles → edit the style and set a price.

**"M-Pesa consumer key/secret are not configured"**
→ Check `.env` values or set them in Admin → M-Pesa Settings.

**Payment prompt sent but booking stays PENDING**
→ In sandbox, this is normal without ngrok. The frontend polls every 6s.
   In production, ensure `MPESA_CALLBACK_URL` is correct and publicly accessible.

**"Session expired" when using admin panel**
→ JWT expires after 8h. Log in again.

**MongoDB connection fails**
→ Check Atlas IP allowlist (add 0.0.0.0/0 for testing, restrict for production).

