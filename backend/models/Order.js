const mongoose = require('mongoose');

// A single model covers session bookings, album deposits, and print
// purchases. They all follow the same shape: customer -> amount -> M-Pesa
// payment -> status. Keeping them in one collection makes the admin
// dashboard and the "PENDING -> PAID -> CONFIRMED" lifecycle simple to
// reason about and query.
const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['booking', 'album_deposit', 'print_purchase'], required: true },

  customer: {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true }, // M-Pesa phone, e.g. 2547XXXXXXXX
    email: { type: String, trim: true },
    address: { type: String, trim: true } // used for print deliveries
  },

  // Free-form details specific to the order type (session style/date/time,
  // album name, print name, notes, etc.)
  details: { type: mongoose.Schema.Types.Mixed, default: {} },

  amount: {
    total: { type: Number, required: true },   // full price of the item/session
    due: { type: Number, required: true },      // amount actually charged now (deposit or full)
    paid: { type: Number, default: 0 }
  },

  payment: {
    status: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED'], default: 'PENDING' },
    checkoutRequestId: { type: String, default: null },
    merchantRequestId: { type: String, default: null },
    mpesaReceipt: { type: String, default: null },
    resultDesc: { type: String, default: null },
    paidAt: { type: Date, default: null }
  },

  status: { type: String, enum: ['PENDING', 'CONFIRMED', 'CANCELLED'], default: 'PENDING' }
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
