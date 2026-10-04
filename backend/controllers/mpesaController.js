const Order = require('../models/Order');
const { stkQuery } = require('../utils/daraja');

// Safaricom POSTs here after the customer enters their M-Pesa PIN (or
// cancels/times out). This is the ONLY place a booking/deposit/purchase is
// ever marked PAID — never on the initial STK push response.
async function callback(req, res) {
  // Always acknowledge Safaricom immediately so it doesn't retry.
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    const stkCallback = req.body && req.body.Body && req.body.Body.stkCallback;
    if (!stkCallback) return;

    const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;
    const order = await Order.findOne({ 'payment.checkoutRequestId': CheckoutRequestID });
    if (!order) {
      console.warn('M-Pesa callback for unknown CheckoutRequestID:', CheckoutRequestID);
      return;
    }

    if (Number(ResultCode) === 0) {
      const items = (stkCallback.CallbackMetadata && stkCallback.CallbackMetadata.Item) || [];
      const get = name => {
        const item = items.find(i => i.Name === name);
        return item ? item.Value : null;
      };

      order.payment.status = 'PAID';
      order.payment.mpesaReceipt = get('MpesaReceiptNumber');
      order.payment.resultDesc = ResultDesc;
      order.payment.paidAt = new Date();
      order.amount.paid = get('Amount') || order.amount.due;
      order.status = 'CONFIRMED';

      console.log(`✅ Payment CONFIRMED — Order: ${order.orderId}, Receipt: ${order.payment.mpesaReceipt}`);
    } else {
      // ResultCode !== 0: customer cancelled, entered wrong PIN, timed out, etc.
      order.payment.status = 'FAILED';
      order.payment.resultDesc = ResultDesc;
      console.log(`❌ Payment FAILED — Order: ${order.orderId}, Reason: ${ResultDesc}`);
    }

    await order.save();
  } catch (err) {
    console.error('Error processing M-Pesa callback:', err);
  }
}

// Fallback for the frontend to poll if the callback is slow to arrive (or
// for local dev where Safaricom can't reach localhost). Also actively
// queries Safaricom and syncs the result if our own record is still PENDING.
async function checkStatus(req, res) {
  try {
    const { checkoutRequestId } = req.params;
    const order = await Order.findOne({ 'payment.checkoutRequestId': checkoutRequestId });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (order.payment.status === 'PENDING') {
      try {
        const result = await stkQuery(checkoutRequestId);
        if (String(result.ResultCode) === '0') {
          order.payment.status = 'PAID';
          order.status = 'CONFIRMED';
          order.payment.resultDesc = result.ResultDesc;
          order.amount.paid = order.amount.due;
          await order.save();
          console.log(`✅ Payment confirmed via query poll — Order: ${order.orderId}`);
        } else if (result.ResultCode !== undefined && String(result.ResultCode) !== '1032') {
          // 1032 == request still being processed by Safaricom
          order.payment.status = 'FAILED';
          order.payment.resultDesc = result.ResultDesc;
          await order.save();
        }
      } catch (err) {
        // Query can legitimately fail while the push is still in flight; ignore.
      }
    }

    res.json({
      success: true,
      orderId: order.orderId,
      status: order.status,
      paymentStatus: order.payment.status,
      mpesaReceipt: order.payment.mpesaReceipt,
      resultDesc: order.payment.resultDesc
    });
  } catch (err) {
    console.error('checkStatus error:', err);
    res.status(500).json({ success: false, message: 'Could not check payment status.' });
  }
}

module.exports = { callback, checkStatus };
