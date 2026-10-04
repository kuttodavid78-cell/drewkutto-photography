const PhotoStyle = require('../models/PhotoStyle');
const Print = require('../models/Print');
const Album = require('../models/Album');
const Settings = require('../models/Settings');

// ── PHOTO STYLES ──
async function getStyles(req, res) {
  try {
    const styles = await PhotoStyle.find().sort({ order: 1, createdAt: 1 });
    res.json({ success: true, styles });
  } catch (err) {
    console.error('getStyles error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch styles.' });
  }
}
async function createStyle(req, res) {
  try {
    const style = await PhotoStyle.create(req.body);
    res.status(201).json({ success: true, style });
  } catch (err) {
    console.error('createStyle error:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not create style.' });
  }
}
async function updateStyle(req, res) {
  try {
    const style = await PhotoStyle.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!style) return res.status(404).json({ success: false, message: 'Style not found.' });
    res.json({ success: true, style });
  } catch (err) {
    console.error('updateStyle error:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not update style.' });
  }
}
async function deleteStyle(req, res) {
  try {
    await PhotoStyle.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteStyle error:', err);
    res.status(500).json({ success: false, message: 'Could not delete style.' });
  }
}
async function addStyleImages(req, res) {
  try {
    const style = await PhotoStyle.findById(req.params.id);
    if (!style) return res.status(404).json({ success: false, message: 'Style not found.' });
    const urls = (req.files || []).map(f => `/uploads/${f.filename}`);
    style.images.push(...urls);
    await style.save();
    res.json({ success: true, style });
  } catch (err) {
    console.error('addStyleImages error:', err);
    res.status(500).json({ success: false, message: 'Could not add images.' });
  }
}
async function removeStyleImage(req, res) {
  try {
    const style = await PhotoStyle.findById(req.params.id);
    if (!style) return res.status(404).json({ success: false, message: 'Style not found.' });
    style.images = style.images.filter((_, i) => i !== Number(req.params.imgIndex));
    await style.save();
    res.json({ success: true, style });
  } catch (err) {
    console.error('removeStyleImage error:', err);
    res.status(500).json({ success: false, message: 'Could not remove image.' });
  }
}

// ── PRINTS ──
async function getPrints(req, res) {
  try {
    const prints = await Print.find().sort({ createdAt: -1 });
    res.json({ success: true, prints });
  } catch (err) {
    console.error('getPrints error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch prints.' });
  }
}
async function createPrint(req, res) {
  try {
    const body = { ...req.body };
    if (req.file) body.image = `/uploads/${req.file.filename}`;
    if (typeof body.soldOut === 'string') body.soldOut = body.soldOut === 'true';
    const print = await Print.create(body);
    res.status(201).json({ success: true, print });
  } catch (err) {
    console.error('createPrint error:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not create print.' });
  }
}
async function updatePrint(req, res) {
  try {
    const body = { ...req.body };
    if (req.file) body.image = `/uploads/${req.file.filename}`;
    if (typeof body.soldOut === 'string') body.soldOut = body.soldOut === 'true';
    const print = await Print.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!print) return res.status(404).json({ success: false, message: 'Print not found.' });
    res.json({ success: true, print });
  } catch (err) {
    console.error('updatePrint error:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not update print.' });
  }
}
async function deletePrint(req, res) {
  try {
    await Print.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('deletePrint error:', err);
    res.status(500).json({ success: false, message: 'Could not delete print.' });
  }
}

// ── ALBUMS ──
async function getAlbums(req, res) {
  try {
    const albums = await Album.find().sort({ createdAt: -1 });
    res.json({ success: true, albums });
  } catch (err) {
    console.error('getAlbums error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch albums.' });
  }
}
async function createAlbum(req, res) {
  try {
    const album = await Album.create(req.body);
    res.status(201).json({ success: true, album });
  } catch (err) {
    console.error('createAlbum error:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not create album.' });
  }
}
async function updateAlbum(req, res) {
  try {
    const album = await Album.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!album) return res.status(404).json({ success: false, message: 'Album not found.' });
    res.json({ success: true, album });
  } catch (err) {
    console.error('updateAlbum error:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not update album.' });
  }
}
async function deleteAlbum(req, res) {
  try {
    await Album.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteAlbum error:', err);
    res.status(500).json({ success: false, message: 'Could not delete album.' });
  }
}
async function addAlbumImages(req, res) {
  try {
    const album = await Album.findById(req.params.id);
    if (!album) return res.status(404).json({ success: false, message: 'Album not found.' });
    const urls = (req.files || []).map(f => `/uploads/${f.filename}`);
    album.images.push(...urls);
    await album.save();
    res.json({ success: true, album });
  } catch (err) {
    console.error('addAlbumImages error:', err);
    res.status(500).json({ success: false, message: 'Could not add images.' });
  }
}
async function removeAlbumImage(req, res) {
  try {
    const album = await Album.findById(req.params.id);
    if (!album) return res.status(404).json({ success: false, message: 'Album not found.' });
    album.images = album.images.filter((_, i) => i !== Number(req.params.imgIndex));
    await album.save();
    res.json({ success: true, album });
  } catch (err) {
    console.error('removeAlbumImage error:', err);
    res.status(500).json({ success: false, message: 'Could not remove image.' });
  }
}

// ── HERO IMAGES ──
async function getHeroImages(req, res) {
  try {
    const settings = await Settings.getSingleton();
    res.json({ success: true, heroImages: settings.heroImages });
  } catch (err) {
    console.error('getHeroImages error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch hero images.' });
  }
}
async function setHeroImages(req, res) {
  try {
    const settings = await Settings.getSingleton();
    const urls = (req.files || []).map(f => `/uploads/${f.filename}`);
    settings.heroImages = urls.length ? urls.slice(0, 5) : settings.heroImages;
    await settings.save();
    res.json({ success: true, heroImages: settings.heroImages });
  } catch (err) {
    console.error('setHeroImages error:', err);
    res.status(500).json({ success: false, message: 'Could not save hero images.' });
  }
}
async function removeHeroImage(req, res) {
  try {
    const settings = await Settings.getSingleton();
    settings.heroImages = settings.heroImages.filter((_, i) => i !== Number(req.params.imgIndex));
    await settings.save();
    res.json({ success: true, heroImages: settings.heroImages });
  } catch (err) {
    console.error('removeHeroImage error:', err);
    res.status(500).json({ success: false, message: 'Could not remove hero image.' });
  }
}

module.exports = {
  getStyles, createStyle, updateStyle, deleteStyle, addStyleImages, removeStyleImage,
  getPrints, createPrint, updatePrint, deletePrint,
  getAlbums, createAlbum, updateAlbum, deleteAlbum, addAlbumImages, removeAlbumImage,
  getHeroImages, setHeroImages, removeHeroImage
};
