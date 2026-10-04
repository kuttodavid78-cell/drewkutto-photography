const mongoose = require('mongoose');

// A single document holds all site-wide settings. It lives server-side only
// — the admin panel reads/writes it through authenticated API calls, and it
// is NEVER sent to the public-facing customer site (except the harmless bits
// like heroImages and depositPct, which have their own public endpoints).
const SettingsSchema = new mongoose.Schema({
  singleton: { type: String, default: 'main', unique: true },

  heroImages: [{ type: String }],
  blockedDates: [{ type: String }], // 'YYYY-MM-DD', manually blocked by admin

  notifEmail: { type: String, default: '' },
  notifPhone: { type: String, default: '' },

  // Drew's phone number used as the STK push RECIPIENT when officialLaunch is true.
  // When false, the STK push goes to the client's own phone (paybill mode).
  drewPhone: { type: String, default: '' },
  officialLaunch: { type: Boolean, default: false },

  minDaysNotice: { type: Number, default: 3 },
  depositPercent: { type: Number, default: 50 },

  // M-Pesa credential overrides. If any field is empty, the server falls
  // back to the corresponding value in .env. Consumer secret & passkey are
  // only ever returned to the admin panel masked.
  mpesa: {
    environment: { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
    consumerKey: { type: String, default: '' },
    consumerSecret: { type: String, default: '' },
    shortcode: { type: String, default: '' },
    passkey: { type: String, default: '' },
    callbackURL: { type: String, default: '' }
  }
}, { timestamps: true });

SettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ singleton: 'main' });
  if (!doc) doc = await this.create({ singleton: 'main' });
  return doc;
};

module.exports = mongoose.model('Settings', SettingsSchema);
