// NZBGet's JSON-RPC 1.0 API (docs at github.com/nzbgetcom/nzbget/blob/develop/docs/api) — every
// field/method name below is taken straight from that doc, not guessed, but hasn't been checked
// against a live instance.

export type NzbGroup = {
  NZBID: number;
  NZBName: string;
  FileSizeMB: number;
  RemainingSizeMB: number;
  DownloadedSizeMB: number;
  Status: string;
  Category?: string;
};

export type NzbStatus = {
  RemainingSizeMB?: number;
  DownloadRate?: number;
  DownloadLimit?: number;
  DownloadPaused?: boolean;
};

export type NzbHistoryItem = {
  NZBID: number;
  Name?: string;
  NZBName?: string;
  Status: string;
  FileSizeMB: number;
  DownloadedSizeMB: number;
  HistoryTime: number;
  Category?: string;
  DestDir?: string;
  DownloadTimeSec?: number;
  ParStatus?: string;
  UnpackStatus?: string;
};

export function rpcBody(method: string, params: unknown[] = []) {
  return { method, params, id: 1 };
}

/** Command is one of NZBGet's editqueue Command values (GroupPause, GroupResume, GroupDelete,
 * HistoryFinalDelete, ...) — signature per v18.0+: editqueue(Command, Param, IDs). */
export function editQueueBody(command: string, ids: number[], param = '') {
  return rpcBody('editqueue', [command, param, ids]);
}

export function statusLabel(status?: string): string {
  if (!status) return 'Unknown';
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/** append(Filename, Content, Category, Priority, AddToTop, AddPaused, DupeKey, DupeScore,
 * DupeMode, AutoCategory, PPParameters) — positional per NZBGet's API, defaults matching
 * NZBGet's own normal-priority, auto-categorized, unpaused add. */
export function appendBody(filename: string, content: string) {
  return rpcBody('append', [filename, content, '', 0, false, false, '', 0, 'SCORE', true, []]);
}
