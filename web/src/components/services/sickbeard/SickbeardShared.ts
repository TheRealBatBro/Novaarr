// Sick Beard's classic webapi.py (github.com/midgetspy/Sick-Beard, frozen since 2014) — every
// cmd/field name below is read straight from that source, not guessed. Responses always come
// back as HTTP 200 JSON, even for a bad/missing API key or the API being disabled in Sick Beard's
// own config — callers must check `result` in the body, not just the HTTP status.

export type SbResponse<T> = { result: 'success' | 'failure' | 'timeout' | 'error' | 'fatal' | 'denied'; message: string; data: T };

export type SbShow = {
  show_name: string;
  tvdbid: number;
  network?: string;
  status: string;
  quality?: string;
  paused: '0' | '1' | 0 | 1;
  next_ep_airdate?: string;
  air_by_date?: '0' | '1' | 0 | 1;
};

export type SbEpisode = {
  name: string;
  airdate: string;
  status: string;
  quality?: string;
};

// show.seasons response is nested: { [season]: { [episode]: SbEpisode } }
export type SbSeasons = Record<string, Record<string, SbEpisode>>;

export type SbComingEpisode = {
  tvdbid: number;
  show_name: string;
  season: number;
  episode: number;
  ep_name?: string;
  airdate: string;
  network?: string;
  quality?: string;
};

// future's top-level buckets
export type SbComingEpisodes = {
  missed?: SbComingEpisode[];
  today?: SbComingEpisode[];
  soon?: SbComingEpisode[];
  later?: SbComingEpisode[];
};

export type SbHistoryItem = {
  tvdbid: number;
  show_name: string;
  season: number;
  episode: number;
  status: string;
  quality?: string;
  date: string;
  resource: string;
};

export function statusTone(status: string): 'muted' | 'primary' | 'success' | 'destructive' {
  if (/^Downloaded/.test(status)) return 'success';
  if (/^Snatched/.test(status)) return 'primary';
  if (status === 'Wanted') return 'destructive';
  if (status === 'Skipped' || status === 'Ignored') return 'muted';
  return 'muted';
}
