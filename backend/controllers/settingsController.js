const Settings = require('../models/Settings');

function maskSecret(value) {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return '•'.repeat(value.length - 4) + value.slice(-4);
}

// Returns settings for the admin panel with secrets masked — the admin sees
// that a value is set (and its last few characters) without the real
// secret round-tripping through the browser on every page load.
async function getSettings(req, res) {
  try {
    const s = await Settings.getSingleton();
    res.json({
      success: true,
      settings: {
        notifEmail: s.notifEmail,
        notifPhone: s.notifPhone,
        drewPhone: s.drewPhone,
        officialLaunch: s.officialLaunch,
        minDaysNotice: s.minDaysNotice,
        depositPercent: s.depositPercent,
        blockedDates: s.blockedDates,
        mpesa: {
          environment: s.mpesa.environment,
          shortcode: s.mpesa.shortcode,
          callbackURL: s.mpesa.callbackURL,
          consumerKey: maskSecret(s.mpesa.consumerKey),
          consumerSecret: maskSecret(s.mpesa.consumerSecret),
          passkey: maskSecret(s.mpesa.passkey),
          configured: Boolean(s.mpesa.consumerKey && s.mpesa.consumerSecret && s.mpesa.shortcode && s.mpesa.passkey)
        }
      }
    });
  } catch (err) {
    console.error('getSettings error:', err);
    res.status(500).json({ success: false, message: 'Could not load settings.' });
  }
}

async function saveMpesaSettings(req, res) {
  try {
    const { environment, consumerKey, consumerSecret, shortcode, passkey, callbackURL } = req.body;
    const s = await Settings.getSingleton();
    if (environment) s.mpesa.environment = environment;
    if (shortcode) s.mpesa.shortcode = shortcode;
    if (callbackURL !== undefined) s.mpesa.callbackURL = callbackURL;
    // Only overwrite secrets if a new, non-masked value was actually typed.
    if (consumerKey && !consumerKey.includes('•')) s.mpesa.consumerKey = consumerKey;
    if (consumerSecret && !consumerSecret.includes('•')) s.mpesa.consumerSecret = consumerSecret;
    if (passkey && !passkey.includes('•')) s.mpesa.passkey = passkey;
    await s.save();
    res.json({ success: true, message: 'M-Pesa settings saved.' });
  } catch (err) {
    console.error('saveMpesaSettings error:', err);
    res.status(500).json({ success: false, message: 'Could not save M-Pesa settings.' });
  }
}

async function saveNotificationSettings(req, res) {
  try {
    const { notifEmail, notifPhone } = req.body;
    const s = await Settings.getSingleton();
    s.notifEmail = notifEmail || '';
    s.notifPhone = notifPhone || '';
    await s.save();
    res.json({ success: true, message: 'Notification settings saved.' });
  } catch (err) {
    console.error('saveNotificationSettings error:', err);
    res.status(500).json({ success: false, message: 'Could not save notification settings.' });
  }
}

async function saveBookingSettings(req, res) {
  try {
    const { minDaysNotice, depositPercent } = req.body;
    const s = await Settings.getSingleton();
    if (minDaysNotice !== undefined) s.minDaysNotice = Number(minDaysNotice);
    if (depositPercent !== undefined) s.depositPercent = Number(depositPercent);
    await s.save();
    res.json({ success: true, message: 'Booking settings saved.' });
  } catch (err) {
    console.error('saveBookingSettings error:', err);
    res.status(500).json({ success: false, message: 'Could not save booking settings.' });
  }
}

// Saves Drew's phone number and the officialLaunch toggle.
// When officialLaunch=true the STK push goes to drewPhone instead of the client.
async function saveLaunchSettings(req, res) {
  try {
    const { drewPhone, officialLaunch } = req.body;
    const s = await Settings.getSingleton();
    if (drewPhone !== undefined) s.drewPhone = drewPhone;
    if (officialLaunch !== undefined) s.officialLaunch = Boolean(officialLaunch);
    await s.save();
    res.json({ success: true, message: 'Launch settings saved.' });
  } catch (err) {
    console.error('saveLaunchSettings error:', err);
    res.status(500).json({ success: false, message: 'Could not save launch settings.' });
  }
}

async function blockDate(req, res) {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ success: false, message: 'Date is required.' });
    const s = await Settings.getSingleton();
    if (!s.blockedDates.includes(date)) s.blockedDates.push(date);
    await s.save();
    res.json({ success: true, blockedDates: s.blockedDates });
  } catch (err) {
    console.error('blockDate error:', err);
    res.status(500).json({ success: false, message: 'Could not block date.' });
  }
}

async function unblockDate(req, res) {
  try {
    const { date } = req.body;
    const s = await Settings.getSingleton();
    s.blockedDates = s.blockedDates.filter(d => d !== date);
    await s.save();
    res.json({ success: true, blockedDates: s.blockedDates });
  } catch (err) {
    console.error('unblockDate error:', err);
    res.status(500).json({ success: false, message: 'Could not unblock date.' });
  }
}

module.exports = {
  getSettings, saveMpesaSettings, saveNotificationSettings,
  saveBookingSettings, saveLaunchSettings, blockDate, unblockDate
};
