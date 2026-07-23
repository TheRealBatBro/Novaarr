const express = require('express');
const dgram = require('dgram');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function buildMagicPacket(mac) {
  const macBytes = mac.split(/[:-]/).map((b) => parseInt(b, 16));
  if (macBytes.length !== 6 || macBytes.some((b) => Number.isNaN(b))) {
    throw new Error('Invalid MAC address');
  }
  const packet = Buffer.alloc(6 + 16 * 6, 0xff);
  for (let i = 0; i < 16; i++) {
    Buffer.from(macBytes).copy(packet, 6 + i * 6);
  }
  return packet;
}

router.post('/', (req, res) => {
  const { mac, broadcast = '255.255.255.255', port = 9 } = req.body || {};
  if (!mac) return res.status(400).json({ error: 'mac is required' });

  let packet;
  try {
    packet = buildMagicPacket(mac);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const socket = dgram.createSocket('udp4');
  socket.once('error', (err) => {
    socket.close();
    res.status(502).json({ error: err.message });
  });
  socket.bind(() => {
    socket.setBroadcast(true);
    socket.send(packet, 0, packet.length, port, broadcast, (err) => {
      socket.close();
      if (err) return res.status(502).json({ error: err.message });
      res.json({ ok: true });
    });
  });
});

module.exports = router;
