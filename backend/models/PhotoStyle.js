const mongoose = require('mongoose');

const PhotoStyleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  desc: { type: String, default: '' },
  icon: { type: String, default: 'fa-camera' },
  price: { type: Number, default: null }, // session fee, optional
  images: [{ type: String }],             // uploaded file URLs
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('PhotoStyle', PhotoStyleSchema);
