const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ── LIMITS (override in .env) ──
// MAX_UPLOAD_MB    = biggest single image, in megabytes   (default 100)
// MAX_UPLOAD_FILES = most images in ONE upload request     (default 40)
// UPLOAD_DIR       = where photos are stored on the server  (default backend/uploads)
//                    Point this at a persistent disk/volume on your host so photos
//                    survive restarts and redeploys (e.g. /var/data/uploads).
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 100;
const MAX_UPLOAD_FILES = Number(process.env.MAX_UPLOAD_FILES) || 40;

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${unique}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const ALLOWED_MIME = /^image\/(jpe?g|pjpeg|png|webp|gif|avif|heic|heif|heic-sequence|heif-sequence)$/i;
const ALLOWED_EXT = /\.(jpe?g|jfif|png|webp|gif|avif|heic|heif)$/i;
const HEIC_MIME = /^image\/(heic|heif|heic-sequence|heif-sequence)$/i;
const HEIC_EXT = /\.(heic|heif)$/i;

// Browsers (especially on Windows / some phones) sometimes report a wrong or
// empty MIME type ("application/octet-stream") even for a normal photo, so we
// accept a file if EITHER its MIME type OR its extension is a known image type.
function fileFilter(req, file, cb) {
  if (ALLOWED_MIME.test(file.mimetype || '') || ALLOWED_EXT.test(file.originalname || '')) {
    return cb(null, true);
  }
  const err = new Error('Unsupported file type. Please upload JPG, PNG, WebP, GIF, AVIF or HEIC (iPhone) images.');
  err.status = 400;
  cb(err);
}

const base = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: MAX_UPLOAD_FILES }
});

// ── HEIC / HEIF (iPhone photos) → JPEG ──
// Browsers can't display HEIC, so convert each one to a high-quality JPEG
// right after it is received. Everything downstream just sees a normal JPG.
let heicConvert = null;
function getHeicConverter() {
  if (!heicConvert) heicConvert = require('heic-convert'); // throws if not installed
  return heicConvert;
}

async function convertHeicFiles(req, res, next) {
  try {
    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
                : req.file ? [req.file] : [];
    for (const f of files) {
      if (!(HEIC_MIME.test(f.mimetype || '') || HEIC_EXT.test(f.originalname || ''))) continue;
      let convert;
      try { convert = getHeicConverter(); }
      catch (e) {
        const err = new Error('HEIC support is not installed on the server. Run "npm install" in the backend folder and restart.');
        err.status = 500;
        throw err;
      }
      const input = await fs.promises.readFile(f.path);
      let output;
      try {
        output = await convert({ buffer: input, format: 'JPEG', quality: 0.92 });
      } catch (e) {
        const err = new Error(`Could not read "${f.originalname}". It may be corrupted — try exporting it as a JPG.`);
        err.status = 400;
        throw err;
      }
      const newName = f.filename.replace(/\.[^.]+$/, '') + '.jpg';
      const newPath = path.join(UPLOAD_DIR, newName);
      await fs.promises.writeFile(newPath, Buffer.from(output));
      await fs.promises.unlink(f.path).catch(() => {});
      f.filename = newName;
      f.path = newPath;
      f.mimetype = 'image/jpeg';
      f.size = output.length;
    }
    next();
  } catch (err) {
    // Don't leave half-processed files behind
    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
                : req.file ? [req.file] : [];
    await Promise.all(files.map(f => fs.promises.unlink(f.path).catch(() => {})));
    next(err);
  }
}

// Same API as multer (upload.array / upload.single), but each returns
// [multer, HEIC-converter] — Express runs both in order.
const upload = {
  array: (name, max) => [base.array(name, max), convertHeicFiles],
  single: (name) => [base.single(name), convertHeicFiles]
};

// Turns multer's cryptic errors ("Unexpected field", "File too large")
// into clear messages for the admin panel.
upload.errorHandler = function (err, req, res, next) {
  if (err && err.name === 'MulterError') {
    let message = err.message;
    let status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = `One of the images is larger than ${MAX_UPLOAD_MB} MB. Please compress it and try again.`;
      status = 413;
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
      message = `Too many images in one upload. Hero images: max 5 at a time; styles, albums and prints: max ${MAX_UPLOAD_FILES} at a time.`;
    }
    return res.status(status).json({ success: false, message });
  }
  next(err);
};

// ── CLEAN-UP: free disk space when images are removed in the admin panel ──
// Accepts one URL or an array of URLs like "/uploads/123-abc.jpg" and deletes the
// matching files. Only ever touches files directly inside UPLOAD_DIR, and never throws.
upload.removeUploads = async function (urls) {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(u => typeof u === 'string');
  await Promise.all(list.map(async (u) => {
    if (!u.startsWith('/uploads/')) return;
    const name = path.basename(u);
    if (!name || name === '.gitkeep') return;
    try { await fs.promises.unlink(path.join(UPLOAD_DIR, name)); } catch (e) { /* already gone */ }
  }));
};

upload.UPLOAD_DIR = UPLOAD_DIR;
upload.MAX_UPLOAD_MB = MAX_UPLOAD_MB;
upload.MAX_UPLOAD_FILES = MAX_UPLOAD_FILES;

module.exports = upload;
