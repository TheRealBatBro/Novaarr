const dns = require('dns');
const net = require('net');

// Cloud metadata services and link-local addresses have no legitimate reason to be a configured
// service's target — unlike RFC1918 LAN ranges (10/8, 172.16/12, 192.168/16), which are the
// normal, intended target for a self-hosted Sonarr/Radarr/etc reached over the home network, so
// those stay allowed. Loopback is blocked outright: inside the container, 127.0.0.1/::1 is
// Remotarr's own network namespace, never another configured service's.
function isBlockedIp(address, family) {
  if (family === 6 || net.isIPv6(address)) {
    const a = address.toLowerCase();
    if (a === '::1') return true;
    if (a.startsWith('fe80:')) return true; // link-local
    if (a === 'fd00:ec2::254') return true; // AWS IMDSv2, IPv6 form
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1], 4);
    return false;
  }
  const octets = String(address).split('.').map(Number);
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n))) return false;
  const [a, b] = octets;
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. 169.254.169.254 cloud metadata
  if (a === 0) return true; // 0.0.0.0/8
  return false;
}

// Passed as the fetch dispatcher's connect.lookup — this is the SAME resolution used to open
// the real connection, so there's no gap between "checked" and "connected to" for DNS
// rebinding to exploit (a hostname resolving differently between a separate up-front check and
// the actual connect would otherwise slip through).
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err);
    if (addresses.some((a) => isBlockedIp(a.address, a.family))) {
      return callback(new Error(`Refusing to connect to ${hostname}: resolves to a blocked address`));
    }
    if (options && options.all) return callback(null, addresses);
    const first = addresses[0];
    callback(null, first.address, first.family);
  });
}

// Fast pre-check against a literal IP/hostname string, before any network call is attempted —
// a DNS-backed hostname still gets the authoritative check from safeLookup above at actual
// connect time; this just gives a cheap, immediate 400 for the common literal-IP case.
function isBlockedTarget(urlStr) {
  try {
    const u = new URL(urlStr);
    const ipFamily = net.isIP(u.hostname);
    if (ipFamily) return isBlockedIp(u.hostname, ipFamily);
    return u.hostname === 'localhost';
  } catch {
    return true;
  }
}

module.exports = { isBlockedIp, safeLookup, isBlockedTarget };
