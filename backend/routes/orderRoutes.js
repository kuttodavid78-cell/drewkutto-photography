const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  getAvailability, createOrder, getOrderStatus, listOrders, deleteOrder
} = require('../controllers/orderController');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Prevent someone from spamming STK pushes to a phone number.
const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: { success: false, message: 'Too many requests. Please wait a few minutes and try again.' }
});

// Public
router.get('/availability', getAvailability);
router.post('/', orderLimiter, createOrder);
router.get('/:orderId/status', getOrderStatus);

// Admin
router.get('/', requireAdmin, listOrders);
router.delete('/:id', requireAdmin, deleteOrder);

module.exports = router;
