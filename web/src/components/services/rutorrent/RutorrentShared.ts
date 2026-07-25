// rTorrent's d.multicall2 (via ruTorrent's httprpc plugin, which forwards genuine XML-RPC to the
// rTorrent daemon — see routes/proxy.js's rutorrent-xmlrpc adapter) returns one row per torrent,
// each row a flat array of field values in the same order they were requested — positional, not
// keyed, so FIELDS' order here must exactly match parseTorrent's destructuring below.
export type RutorrentTorrent = {
  name: string;
  hash: string;
  sizeBytes: number;
  leftBytes: number;
  downRate: number;
  upRate: number;
  ratio: number;
  isOpen: boolean;
  isActive: boolean;
  complete: boolean;
  label: string;
};

export const FIELDS = [
  'd.name=',
  'd.hash=',
  'd.size_bytes=',
  'd.left_bytes=',
  'd.down.rate=',
  'd.up.rate=',
  'd.ratio=',
  'd.is_open=',
  'd.is_active=',
  'd.complete=',
  'd.custom1=', // label — not a native rTorrent concept, ruTorrent/Sonarr both repurpose this slot
];

export function multicallBody() {
  return { method: 'd.multicall2', params: ['', '', ...FIELDS] };
}

// Mirrors rtorrentXmlRpc.js's base64Value() marker shape — crosses a JSON boundary (this body is
// serialized to the backend proxy call), so it's a plain tagged object, not a shared import.
export function addTorrentFileBody(base64: string) {
  return { method: 'load.raw_start', params: ['', { __xmlrpcBase64: base64 }] };
}

export function parseTorrent(row: unknown[]): RutorrentTorrent {
  const [name, hash, sizeBytes, leftBytes, downRate, upRate, ratio, isOpen, isActive, complete, label] = row;
  return {
    name: String(name ?? ''),
    hash: String(hash ?? ''),
    sizeBytes: Number(sizeBytes) || 0,
    leftBytes: Number(leftBytes) || 0,
    downRate: Number(downRate) || 0,
    upRate: Number(upRate) || 0,
    ratio: (Number(ratio) || 0) / 1000,
    isOpen: String(isOpen) === '1',
    isActive: String(isActive) === '1',
    complete: String(complete) === '1',
    label: String(label ?? ''),
  };
}

export function isPaused(t: RutorrentTorrent): boolean {
  return !t.isOpen || !t.isActive;
}

export function statusLabel(t: RutorrentTorrent): string {
  if (isPaused(t)) return 'Paused';
  return t.complete ? 'Seeding' : 'Downloading';
}

export function progressPct(t: RutorrentTorrent): number {
  return t.sizeBytes > 0 ? ((t.sizeBytes - t.leftBytes) / t.sizeBytes) * 100 : 0;
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '';
  const kb = bytesPerSec / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB/s` : `${kb.toFixed(0)} KB/s`;
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
