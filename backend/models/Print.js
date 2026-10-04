const mongoose = require('mongoose');

const PrintSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true },
  size: { type: String, default: '' },
  edition: { type: String, default: '10' },
  description: { type: String, default: '' },
  image: { type: String, default: null }, // uploaded file URL
  soldOut: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Print', PrintSchema);
