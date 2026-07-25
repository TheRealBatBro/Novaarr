export type DelugeTorrent = { name: string; progress: number; state: string; download_payload_rate: number };
export type DelugeResponse = { result?: Record<string, DelugeTorrent> };

export const DELUGE_FIELDS = ['name', 'progress', 'state', 'download_payload_rate'];

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '';
  const kb = bytesPerSec / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB/s` : `${kb.toFixed(0)} KB/s`;
}
