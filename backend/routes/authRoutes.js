const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, changePassword } = require('../controllers/authController');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Slow brute-force attempts against the admin login.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

router.post('/login', loginLimiter, login);
router.post('/change-password', requireAdmin, changePassword);

module.exports = router;
