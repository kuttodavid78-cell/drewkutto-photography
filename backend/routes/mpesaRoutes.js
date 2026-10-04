const express = require('express');
const { callback, checkStatus } = require('../controllers/mpesaController');

const router = express.Router();

// Public — called by Safaricom's servers, not the browser. No auth (Daraja
// can't send a JWT), so keep this endpoint doing nothing except reading the
// CheckoutRequestID it already knows and updating that one order.
router.post('/callback', callback);

// Public — used by the frontend to poll for payment result.
router.get('/status/:checkoutRequestId', checkStatus);

module.exports = router;
