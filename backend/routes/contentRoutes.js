const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const c = require('../controllers/contentController');

const router = express.Router();

// ── Styles ──
router.get('/styles', c.getStyles);
router.post('/styles', requireAdmin, c.createStyle);
router.put('/styles/:id', requireAdmin, c.updateStyle);
router.delete('/styles/:id', requireAdmin, c.deleteStyle);
router.post('/styles/:id/images', requireAdmin, upload.array('images', upload.MAX_UPLOAD_FILES), c.addStyleImages);
router.delete('/styles/:id/images/:imgIndex', requireAdmin, c.removeStyleImage);

// ── Prints ──
router.get('/prints', c.getPrints);
router.post('/prints', requireAdmin, upload.single('image'), c.createPrint);
router.put('/prints/:id', requireAdmin, upload.single('image'), c.updatePrint);
router.delete('/prints/:id', requireAdmin, c.deletePrint);

// ── Albums ──
router.get('/albums', c.getAlbums);
router.post('/albums', requireAdmin, c.createAlbum);
router.put('/albums/:id', requireAdmin, c.updateAlbum);
router.delete('/albums/:id', requireAdmin, c.deleteAlbum);
router.post('/albums/:id/images', requireAdmin, upload.array('images', upload.MAX_UPLOAD_FILES), c.addAlbumImages);
router.delete('/albums/:id/images/:imgIndex', requireAdmin, c.removeAlbumImage);

// ── Hero images ──
router.get('/hero', c.getHeroImages);
router.post('/hero', requireAdmin, upload.array('images', 5), c.setHeroImages);
router.delete('/hero/:imgIndex', requireAdmin, c.removeHeroImage);

module.exports = router;
