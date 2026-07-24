// Jackett's aggregate "all configured indexers" Torznab endpoint — used for both search and caps.
export const JACKETT_SEARCH_PATH = '/api/v2.0/indexers/all/results/torznab/api';

// The REST indexer-management endpoint (source: Jackett.Common/Models/DTO/Indexer.cs on GitHub —
// this exact field list is straight from Jackett's own DTO class, not a guess). Confirmed via
// public issue reports that this only works with a bare API key when Jackett has NO admin
// password set; with a password set it requires a cookie session Jackett's login flow isn't
// documented well enough to safely reverse-engineer here, so that case is left as a clear error
// rather than guessed at.
export const JACKETT_INDEXERS_PATH = '/api/v2.0/indexers';

export type JackettIndexer = {
  id: string;
  name: string;
  description?: string;
  type?: string;
  configured: boolean;
  site_link?: string;
  language?: string;
  tags?: string[];
  last_error?: string;
};
