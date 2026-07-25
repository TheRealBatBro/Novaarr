export type DelugeTorrent = { name: string; progress: number; state: string; download_payload_rate: number };
export type DelugeResponse = { result?: Record<string, DelugeTorrent> };

export const DELUGE_FIELDS = ['name', 'progress', 'state', 'download_payload_rate'];

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '';
  const kb = bytesPerSec / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB/s` : `${kb.toFixed(0)} KB/s`;
}

// core.add_torrent_url fetches the .torrent file server-side itself — the client only ever sends
// the URL/magnet string, never file bytes. `{}` for options means "use Deluge's own defaults."
export function addTorrentBody(uri: string) {
  const method = uri.trim().toLowerCase().startsWith('magnet:') ? 'core.add_torrent_magnet' : 'core.add_torrent_url';
  return { method, params: [uri, {}] };
}

// add_torrent_file_async (not the plain add_torrent_file) is what Deluge's own WebUI calls for
// uploads — the plain version blocks the daemon on session.add_torrent() while the file is
// registered; the _async variant returns immediately and was restored specifically for
// single-file, backward-compatible third-party use after the manager moved to async-by-default.
export function addTorrentFileBody(filename: string, base64: string) {
  return { method: 'core.add_torrent_file_async', params: [filename, base64, {}] };
}
