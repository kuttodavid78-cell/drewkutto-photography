const mongoose = require('mongoose');

const AlbumSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'fa-book-open' },
  images: [{ type: String }]  // sample album photos
}, { timestamps: true });

module.exports = mongoose.model('Album', AlbumSchema);
