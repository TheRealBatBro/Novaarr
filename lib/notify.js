const db = require('../db');

// Each sender takes (config, {title, body}) and does whatever that service's API needs. All of
// them throw on a non-OK response so dispatch() below can report per-channel failures back to
// the "send test" button rather than silently swallowing everything.
async function assertOk(res, label) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${label} returned HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
}

const SENDERS = {
  // https://core.telegram.org/bots/api#sendmessage — botToken from @BotFather, chatId from
  // e.g. @myidbot or the getUpdates API after messaging the bot once.
  telegram: async (cfg, { title, body }) => {
    const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cfg.chatId, text: `${title}\n${body}` }),
    });
    await assertOk(res, 'Telegram');
  },

  // https://docs.ntfy.sh/publish/ — serverUrl defaults to ntfy.sh itself; a self-hosted server
  // and/or an access token are both optional.
  ntfy: async (cfg, { title, body }) => {
    const base = (cfg.serverUrl || 'https://ntfy.sh').replace(/\/$/, '');
    const res = await fetch(`${base}/${cfg.topic}`, {
      method: 'POST',
      headers: {
        Title: title,
        ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
      },
      body,
    });
    await assertOk(res, 'ntfy');
  },

  // https://discord.com/developers/docs/resources/webhook#execute-webhook
  discord: async (cfg, { title, body }) => {
    const res = await fetch(cfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `**${title}**\n${body}`.slice(0, 2000) }),
    });
    await assertOk(res, 'Discord');
  },

  // https://api.slack.com/messaging/webhooks
  slack: async (cfg, { title, body }) => {
    const res = await fetch(cfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `*${title}*\n${body}` }),
    });
    await assertOk(res, 'Slack');
  },

  // https://pushover.net/api — form-encoded, not JSON, per their documented contract.
  pushover: async (cfg, { title, body }) => {
    const res = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: cfg.appToken, user: cfg.userKey, title, message: body }).toString(),
    });
    await assertOk(res, 'Pushover');
  },

  // https://gotify.net/api-docs#/message/createMessage
  gotify: async (cfg, { title, body }) => {
    const base = cfg.serverUrl.replace(/\/$/, '');
    const res = await fetch(`${base}/message?token=${encodeURIComponent(cfg.token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message: body, priority: 5 }),
    });
    await assertOk(res, 'Gotify');
  },

  // WhatsApp has no self-hostable, ToS-compliant automation API — the unofficial approach
  // (whatsapp-web.js and similar) requires a persistent QR-scanned session tied to a real
  // personal number, which isn't something to automate from a background service. Twilio's
  // WhatsApp Business API is the legitimate way in: https://www.twilio.com/docs/whatsapp/api
  whatsapp: async (cfg, { title, body }) => {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        From: `whatsapp:${cfg.fromNumber}`,
        To: `whatsapp:${cfg.toNumber}`,
        Body: `${title}\n${body}`,
      }).toString(),
    });
    await assertOk(res, 'WhatsApp (Twilio)');
  },
};

const CHANNEL_TYPES = Object.keys(SENDERS);

// Fire-and-forget from the caller's point of view — a broken webhook must never break the
// action it's alerting about. Returns per-channel results so the "send test" button can show a
// real error instead of a blind toast.
async function dispatch(eventKey, { title, body }) {
  if (db.getDisabledNotificationEvents().includes(eventKey)) return [];
  const channels = db.listNotificationChannels().filter((c) => c.enabled);
  return Promise.all(
    channels.map(async (c) => {
      try {
        await SENDERS[c.type]?.(c.config, { title, body });
        return { channelId: c.id, ok: true };
      } catch (e) {
        return { channelId: c.id, ok: false, error: e.message };
      }
    }),
  );
}

async function sendTest(channel) {
  await SENDERS[channel.type](channel.config, { title: 'Novaarr', body: 'Test notification — this channel is working.' });
}

module.exports = { dispatch, sendTest, CHANNEL_TYPES };
