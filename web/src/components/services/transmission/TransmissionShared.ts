export type TrTorrent = {
  id: number;
  name: string;
  percentDone: number;
  status: number; // 0=stopped, 4=downloading, 6=seeding, others=waiting/checking
  rateDownload: number;
};

export type TrResponse = { arguments?: { torrents?: TrTorrent[] } };

export const TR_FIELDS = ['id', 'name', 'percentDone', 'status', 'rateDownload'];

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '';
  const kb = bytesPerSec / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB/s` : `${kb.toFixed(0)} KB/s`;
}

export function rpc(method: string, ids?: number[], extraArgs?: Record<string, unknown>) {
  return { method, arguments: { fields: TR_FIELDS, ids, ...extraArgs } };
}
