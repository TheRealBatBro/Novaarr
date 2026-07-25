// Ombi's REST API (Ombi-app/Ombi on GitHub) — field names read straight from its C# view models
// (SearchMovieViewModel/SearchTvShowViewModel, BaseRequest/MovieRequests/ChildRequests), not
// guessed. Posters come back as bare TMDb-relative paths, never full URLs — always prepend
// TMDB_IMAGE yourself.
export const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w200';
export const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/w780';

export type OmbiSearchResult = {
  id: number;
  theMovieDbId?: string;
  title: string;
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  firstAired?: string;
  requested?: boolean;
  approved?: boolean;
  available?: boolean;
  denied?: boolean | null;
};

export type OmbiRequest = {
  id: number;
  title: string;
  theMovieDbId?: number;
  posterPath?: string;
  requestedDate: string;
  requestedUser?: { userName?: string; username?: string };
  approved: boolean;
  available: boolean;
  denied?: boolean | null;
  deniedReason?: string | null;
};

export type OmbiRequestList = { collection?: OmbiRequest[]; total?: number };

export type OmbiRequestCount = { pending: number; approved: number; available: number; denied: number };

export function ombiStatusLabel(r: { approved: boolean; available: boolean; denied?: boolean | null }): { label: string; tone: 'muted' | 'primary' | 'success' | 'destructive' } {
  if (r.denied) return { label: 'Denied', tone: 'destructive' };
  if (r.available) return { label: 'Available', tone: 'success' };
  if (r.approved) return { label: 'Approved', tone: 'primary' };
  return { label: 'Pending', tone: 'muted' };
}
