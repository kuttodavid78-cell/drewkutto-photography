const axios = require('axios');
const Settings = require('../models/Settings');

// Resolve effective M-Pesa config: admin-panel overrides (stored in Mongo)
// win over .env defaults. This is what lets the admin panel "have" M-Pesa
// settings fields without ever exposing them to the browser — the values
// are written to the database by an authenticated API call and read back
// here, server-side only.
async function getMpesaConfig() {
  const settings = await Settings.getSingleton();
  const s = settings.mpesa || {};
  return {
    environment: s.environment || process.env.MPESA_ENV || 'sandbox',
    consumerKey: s.consumerKey || process.env.MPESA_CONSUMER_KEY,
    consumerSecret: s.consumerSecret || process.env.MPESA_CONSUMER_SECRET,
    shortcode: s.shortcode || process.env.MPESA_SHORTCODE,
    passkey: s.passkey || process.env.MPESA_PASSKEY,
    callbackURL: s.callbackURL || process.env.MPESA_CALLBACK_URL
  };
}

function baseUrl(environment) {
  return environment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

// axios throws a generic "Request failed with status code NNN" for any
// non-2xx response, discarding Safaricom's actual error body. Unwrap it so
// callers get the real reason (bad credentials, malformed payload, etc.)
// and the right status code to relay to the customer.
function darajaError(err, context) {
  if (err.response) {
    const d = err.response.data || {};
    const msg = d.errorMessage || d.error_description || d.ResponseDescription || d.ResultDesc
      || `Safaricom rejected the ${context} request.`;
    const e = new Error(`M-Pesa ${context} failed: ${msg}`);
    // Safaricom 4xx (bad creds, bad request) is our fault to fix, not a
    // transient outage — surface as 400 rather than a generic gateway error.
    e.statusCode = err.response.status >= 400 && err.response.status < 500 ? 400 : 502;
    return e;
  }
  // No response at all — network/DNS/timeout talking to Safaricom.
  const e = new Error(`Could not reach M-Pesa for ${context}. Please try again.`);
  e.statusCode = 502;
  return e;
}

function timestampNow() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

// Normalizes Kenyan phone numbers to the 2547XXXXXXXX / 2541XXXXXXXX format
// Daraja requires. Accepts 07XX..., 01XX..., +254..., 254...
function normalizePhone(raw) {
  if (!raw) return null;
  let p = String(raw).replace(/[\s\-()]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (/^(7|1)\d{8}$/.test(p)) p = '254' + p;
  if (!/^254(7|1)\d{8}$/.test(p)) return null;
  return p;
}

async function getAccessToken() {
  const cfg = await getMpesaConfig();
  if (!cfg.consumerKey || !cfg.consumerSecret) {
    throw new Error('M-Pesa consumer key/secret are not configured. Set them in .env or the admin panel.');
  }
  const auth = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString('base64');
  let data;
  try {
    ({ data } = await axios.get(
      `${baseUrl(cfg.environment)}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    ));
  } catch (err) {
    throw darajaError(err, 'authentication');
  }
  return { accessToken: data.access_token, cfg };
}

/**
 * Initiates an STK Push ("Lipa na M-Pesa Online") prompt on the customer's
 * phone for the given order. Returns Safaricom's immediate response
 * (CheckoutRequestID etc). This does NOT mean payment succeeded — that only
 * happens when Safaricom later POSTs to /api/mpesa/callback.
 */
async function stkPush({ phone, amount, accountReference, transactionDesc }) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    const err = new Error('Invalid M-Pesa phone number. Use a format like 07XXXXXXXX.');
    err.statusCode = 400;
    throw err;
  }

  const { accessToken, cfg } = await getAccessToken();
  if (!cfg.shortcode || !cfg.passkey) {
    throw new Error('M-Pesa shortcode/passkey are not configured. Set them in .env or the admin panel.');
  }
  if (!cfg.callbackURL) {
    throw new Error('M-Pesa callback URL is not configured. It must be a public HTTPS URL.');
  }

  const timestamp = timestampNow();
  const password = Buffer.from(`${cfg.shortcode}${cfg.passkey}${timestamp}`).toString('base64');

  const payload = {
    BusinessShortCode: cfg.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.max(1, Math.round(amount)),
    PartyA: normalizedPhone,
    PartyB: cfg.shortcode,
    PhoneNumber: normalizedPhone,
    CallBackURL: cfg.callbackURL,
    AccountReference: accountReference.slice(0, 12),
    TransactionDesc: transactionDesc.slice(0, 100)
  };

  let data;
  try {
    ({ data } = await axios.post(
      `${baseUrl(cfg.environment)}/mpesa/stkpush/v1/processrequest`,
      payload,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ));
  } catch (err) {
    throw darajaError(err, 'STK push');
  }

  return data; // { MerchantRequestID, CheckoutRequestID, ResponseCode, ResponseDescription, CustomerMessage }
}

/**
 * Optional fallback: actively query Safaricom for the result of an STK push,
 * used if the callback hasn't arrived yet and the frontend is polling.
 */
async function stkQuery(checkoutRequestId) {
  const { accessToken, cfg } = await getAccessToken();
  const timestamp = timestampNow();
  const password = Buffer.from(`${cfg.shortcode}${cfg.passkey}${timestamp}`).toString('base64');

  let data;
  try {
    ({ data } = await axios.post(
      `${baseUrl(cfg.environment)}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: cfg.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ));
  } catch (err) {
    throw darajaError(err, 'status query');
  }
  return data;
}

module.exports = { getMpesaConfig, stkPush, stkQuery, normalizePhone };
