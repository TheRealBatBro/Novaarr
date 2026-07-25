// µTorrent's classic WebUI API (github.com/bittorrent/webui/wiki/Web-UI-API) returns each
// torrent as a positional JSON array, not a keyed object — field order below is taken straight
// from that doc, not guessed.
export type UtorrentRaw = [
  string, // 0 hash
  number, // 1 status bitmask
  string, // 2 name
  number, // 3 size (bytes)
  number, // 4 progress (per-mille, 0-1000)
  number, // 5 downloaded (bytes)
  number, // 6 uploaded (bytes)
  number, // 7 ratio (per-mille)
  number, // 8 upload speed (bytes/s)
  number, // 9 download speed (bytes/s)
  number, // 10 eta (seconds)
  string, // 11 label
  number, // 12 peers connected
  number, // 13 peers in swarm
  number, // 14 seeds connected
  number, // 15 seeds in swarm
  number, // 16 availability
  number, // 17 queue order
  number, // 18 remaining bytes
];

export type UtorrentListResponse = { torrents?: UtorrentRaw[]; torrentc?: string };

export type Torrent = {
  hash: string;
  name: string;
  size: number;
  progressPct: number;
  downloaded: number;
  uploaded: number;
  ratio: number;
  ulSpeed: number;
  dlSpeed: number;
  eta: number;
  label: string;
  status: number;
};

// Status bitmask, verbatim from the wiki: 1=Started 2=Checking 4=Start-after-check 8=Checked
// 16=Error 32=Paused 64=Queued 128=Loaded.
const STARTED = 1;
const CHECKING = 2;
const ERROR = 16;
const PAUSED = 32;
const QUEUED = 64;

export function parseTorrent(raw: UtorrentRaw): Torrent {
  return {
    hash: raw[0],
    status: raw[1],
    name: raw[2],
    size: raw[3],
    progressPct: raw[4] / 10,
    downloaded: raw[5],
    uploaded: raw[6],
    ratio: raw[7] / 1000,
    ulSpeed: raw[8],
    dlSpeed: raw[9],
    eta: raw[10],
    label: raw[11],
  };
}

export function isPaused(status: number): boolean {
  return !!(status & PAUSED);
}

export function statusLabel(status: number): string {
  if (status & ERROR) return 'Error';
  if (status & PAUSED) return 'Paused';
  if (status & CHECKING) return 'Checking';
  if (status & QUEUED) return 'Queued';
  if (status & STARTED) return 'Downloading';
  return 'Stopped';
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  return bytesPerSec > 0 ? `${formatBytes(bytesPerSec)}/s` : '';
}
