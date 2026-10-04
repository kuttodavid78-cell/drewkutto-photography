const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const c = require('../controllers/settingsController');

const router = express.Router();

router.get('/', requireAdmin, c.getSettings);
router.post('/mpesa', requireAdmin, c.saveMpesaSettings);
router.post('/notifications', requireAdmin, c.saveNotificationSettings);
router.post('/booking', requireAdmin, c.saveBookingSettings);
router.post('/launch', requireAdmin, c.saveLaunchSettings);
router.post('/block-date', requireAdmin, c.blockDate);
router.post('/unblock-date', requireAdmin, c.unblockDate);

module.exports = router;
