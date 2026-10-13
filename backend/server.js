require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const mpesaRoutes = require('./routes/mpesaRoutes');
const contentRoutes = require('./routes/contentRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const upload = require('./middleware/upload');

const app = express();

// ── CORE MIDDLEWARE ──
const allowedOrigins = (process.env.FRONTEND_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images (hero photos, gallery images, print photos)
// (filenames are unique, so browsers can safely cache them for a long time)
app.use('/uploads', express.static(upload.UPLOAD_DIR, { maxAge: '30d', immutable: true }));

// ── API ROUTES ──
app.use('/api/auth', authRoutes);
app.use('/api/bookings', orderRoutes);   // /api/bookings covers all order types (booking/deposit/purchase)
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/admin', settingsRoutes);

app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() }));

// ── SERVE FRONTEND IN PRODUCTION ──
// When NODE_ENV=production, serve the frontend HTML files so a single
// Node process handles everything (customer site + admin panel + API).
// In development the frontend is opened directly via file:// or a simple
// HTTP server on a different port, so this block is skipped.
if (process.env.NODE_ENV === 'production') {
  const frontendDir = path.join(__dirname, '..', 'frontend');
  app.use(express.static(frontendDir));

  // Admin panel
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(frontendDir, 'admin.html'));
  });
  app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(frontendDir, 'admin.html'));
  });

  // Customer site — catch-all (must be last)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendDir, 'index.html'));
    }
  });
}

// ── 404 + ERROR HANDLING ──
app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'Not found.' }));

// Friendly messages for upload problems (file too large, too many files, wrong type)
app.use(upload.errorHandler);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({ success: false, message: err.message || 'Something went wrong.' });
});

// IMPORTANT: wait for MongoDB to actually connect before accepting requests.
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`Drew Kutto Photography backend running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`API health: http://localhost:${PORT}/api/health`);
      console.log(`Admin panel: open frontend/admin.html in browser`);
      console.log(`Customer site: open frontend/index.html in browser`);
    }
  });
  // Large photos on slow connections can take several minutes to upload.
  // Node's default 5-minute request timeout would cut those off, so allow 30.
  server.requestTimeout = 30 * 60 * 1000;
  server.headersTimeout = 60 * 1000;
}).catch(err => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
