const Order = require('../models/Order');
const Settings = require('../models/Settings');
const PhotoStyle = require('../models/PhotoStyle');
const Album = require('../models/Album');
const Print = require('../models/Print');
const generateOrderId = require('../utils/generateOrderId');
const { stkPush, normalizePhone } = require('../utils/daraja');

// Minutes a PENDING order "holds" a booking date so two customers can't
// both get an STK prompt for the same slot at the same time.
const PENDING_HOLD_MINUTES = 10;

async function getAvailability(req, res) {
  try {
    const settings = await Settings.getSingleton();
    const holdCutoff = new Date(Date.now() - PENDING_HOLD_MINUTES * 60 * 1000);

    const activeBookings = await Order.find({
      type: 'booking',
      'details.date': { $exists: true },
      $or: [
        { status: 'CONFIRMED' },
        { status: 'PENDING', createdAt: { $gte: holdCutoff } }
      ]
    }).select('details.date -_id');

    const bookedDates = Array.from(new Set([
      ...activeBookings.map(b => b.details && b.details.date).filter(Boolean),
      ...(settings.blockedDates || [])
    ]));

    res.json({
      success: true,
      bookedDates,
      minDaysNotice: settings.minDaysNotice,
      depositPercent: settings.depositPercent
    });
  } catch (err) {
    console.error('getAvailability error:', err);
    res.status(500).json({ success: false, message: 'Could not fetch availability.' });
  }
}

async function createOrder(req, res) {
  try {
    const { type } = req.body;
    if (!['booking', 'album_deposit', 'print_purchase'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid order type.' });
    }

    // notes/specifications are ALWAYS optional — never block payment for them
    const { name, phone, email, address, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and M-Pesa phone number are required.' });
    }

    const settings = await Settings.getSingleton();
    let total = 0, due = 0, details = { notes: notes || '' }, accountRef, desc;

    if (type === 'booking') {
      const { date, time, style } = req.body;
      if (!date || !style) {
        return res.status(400).json({ success: false, message: 'Date and photography style are required.' });
      }

      // Enforce minimum notice server-side (never trust the frontend calendar).
      const minDate = new Date();
      minDate.setDate(minDate.getDate() + (settings.minDaysNotice || 3));
      minDate.setHours(0, 0, 0, 0);
      if (new Date(date) < minDate) {
        return res.status(400).json({ success: false, message: `Bookings require at least ${settings.minDaysNotice} days' notice.` });
      }

      // Prevent double-booking: re-check availability at write time.
      const holdCutoff = new Date(Date.now() - PENDING_HOLD_MINUTES * 60 * 1000);
      const clash = await Order.findOne({
        type: 'booking',
        'details.date': date,
        $or: [{ status: 'CONFIRMED' }, { status: 'PENDING', createdAt: { $gte: holdCutoff } }]
      });
      if (clash || (settings.blockedDates || []).includes(date)) {
        return res.status(409).json({ success: false, message: 'Sorry, this date has just been booked. Please choose another date.' });
      }

      const styleDoc = await PhotoStyle.findOne({ name: style });
      total = styleDoc && styleDoc.price ? Number(styleDoc.price) : 0;
      due = total > 0 ? Math.ceil(total * (settings.depositPercent || 50) / 100) : Math.ceil((req.body.fallbackAmount || 0));
      if (due <= 0) {
        return res.status(400).json({ success: false, message: 'This style has no session fee configured yet — please contact Drew directly.' });
      }
      // notes is optional — store whatever was provided (including empty string)
      details = { date, time: time || '', style, notes: notes || '' };
      accountRef = 'Booking';
      desc = `Session booking deposit`;
    }

    if (type === 'album_deposit') {
      const { albumId } = req.body;
      const album = await Album.findById(albumId).catch(() => null);
      if (!album) return res.status(404).json({ success: false, message: 'Album style not found.' });
      total = Number(album.price);
      due = Math.ceil(total * (settings.depositPercent || 50) / 100);
      details = { albumName: album.name, notes: notes || '' };
      accountRef = 'Album';
      desc = `Album deposit — ${album.name}`;
    }

    if (type === 'print_purchase') {
      const { printId } = req.body;
      const print = await Print.findById(printId).catch(() => null);
      if (!print) return res.status(404).json({ success: false, message: 'Print not found.' });
      if (print.soldOut) return res.status(409).json({ success: false, message: 'Sorry, this print just sold out.' });
      total = Number(print.price);
      due = total;
      // address is optional for print purchases
      details = { printName: print.name, address: address || '', notes: notes || '' };
      accountRef = 'Print';
      desc = `Print purchase — ${print.name}`;
    }

    const orderId = generateOrderId(type);
    const order = await Order.create({
      orderId,
      type,
      customer: { name, phone, email: email || '', address: address || '' },
      details,
      amount: { total, due, paid: 0 },
      payment: { status: 'PENDING' },
      status: 'PENDING'
    });

    // ── Official Launch mode ──
    // When officialLaunch is enabled and drewPhone is set, the STK push is sent
    // to Drew's phone instead of the customer's. This means Drew receives the
    // M-Pesa prompt and pays on behalf of the client — useful for in-person
    // transactions or situations where the customer is not set up for STK.
    // When officialLaunch is false (sandbox / testing), the push goes to the
    // customer's own phone as normal.
    let pushPhone = phone;
    if (settings.officialLaunch && settings.drewPhone) {
      const normalized = normalizePhone(settings.drewPhone);
      if (normalized) pushPhone = settings.drewPhone;
    }

    try {
      const stkResponse = await stkPush({
        phone: pushPhone,
        amount: due,
        accountReference: accountRef,
        transactionDesc: desc
      });

      order.payment.checkoutRequestId = stkResponse.CheckoutRequestID;
      order.payment.merchantRequestId = stkResponse.MerchantRequestID;
      await order.save();

      res.status(201).json({
        success: true,
        orderId: order.orderId,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        message: stkResponse.CustomerMessage || 'M-Pesa prompt sent to your phone.'
      });
    } catch (err) {
      // The STK push never reached the customer's phone, so nothing should
      // hold this date. Cancel the order immediately (not just mark payment
      // FAILED) so it stops counting toward availability right away instead
      // of silently blocking the date for the full 10-minute hold window,
      // and so it shows up in the admin panel as a clearly-resolved failed
      // attempt rather than a lingering PENDING record.
      order.payment.status = 'FAILED';
      order.payment.resultDesc = err.message;
      order.status = 'CANCELLED';
      await order.save();
      const status = err.statusCode || 502;
      res.status(status).json({ success: false, message: err.message || 'Could not reach M-Pesa. Please try again.' });
    }
  } catch (err) {
    console.error('createOrder error:', err);
    res.status(500).json({ success: false, message: err.message || 'Something went wrong. Please try again.' });
  }
}

async function getOrderStatus(req, res) {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.json({
      success: true,
      orderId: order.orderId,
      status: order.status,
      paymentStatus: order.payment.status,
      mpesaReceipt: order.payment.mpesaReceipt,
      resultDesc: order.payment.resultDesc
    });
  } catch (err) {
    console.error('getOrderStatus error:', err);
    res.status(500).json({ success: false, message: 'Could not retrieve order status.' });
  }
}

// ── ADMIN ──
async function listOrders(req, res) {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, orders });
  } catch (err) {
    console.error('listOrders error:', err);
    res.status(500).json({ success: false, message: 'Could not retrieve orders.' });
  }
}

async function deleteOrder(req, res) {
  try {
    const deleted = await Order.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteOrder error:', err);
    res.status(500).json({ success: false, message: 'Could not delete order.' });
  }
}

module.exports = { getAvailability, createOrder, getOrderStatus, listOrders, deleteOrder };
