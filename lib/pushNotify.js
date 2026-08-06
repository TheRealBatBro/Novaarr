const webpush = require('web-push');
const db = require('../db');

// VAPID keys identify this server install to push services (Chrome/Firefox/etc.) — generated
// once on first use and stored in `settings`, same pattern as the JWT secret in db.js, rather
// than baked into the image so every deployment gets its own.
function ensureVapidKeys() {
  let keys = db.getVapidKeys();
  if (!keys) {
    const generated = webpush.generateVAPIDKeys();
    db.setVapidKeys(generated.publicKey, generated.privateKey);
    keys = generated;
  }
  webpush.setVapidDetails('mailto:novaarr@localhost', keys.publicKey, keys.privateKey);
  return keys;
}

// Sends to every subscribed device, pruning any that the push service reports as gone (404/410 —
// the browser unsubscribed or the registration expired) so the table doesn't accumulate dead rows.
async function sendPushToAll(payload) {
  ensureVapidKeys();
  const subs = db.listPushSubscriptions();
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          db.removePushSubscription(sub.endpoint);
        }
      }
    }),
  );
}

module.exports = { ensureVapidKeys, sendPushToAll };
