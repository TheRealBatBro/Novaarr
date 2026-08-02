// TMDB genre IDs — movie and TV lists differ (TV uses "Action & Adventure"/10759 and
// "Sci-Fi & Fantasy"/10765 instead of separate Action/878 entries, and adds Kids/10762).
export type GenrePick = { label: string; movieId: number; tvId: number };

export const GENRE_PICKS: GenrePick[] = [
  { label: 'Action', movieId: 28, tvId: 10759 },
  { label: 'Comedy', movieId: 35, tvId: 35 },
  { label: 'Drama', movieId: 18, tvId: 18 },
  { label: 'Horror', movieId: 27, tvId: 9648 }, // TV has no Horror genre — Mystery is the closest analog.
  { label: 'Sci-Fi', movieId: 878, tvId: 10765 },
  { label: 'Thriller', movieId: 53, tvId: 10765 },
  { label: 'Romance', movieId: 10749, tvId: 18 }, // TV has no Romance genre either — Drama covers it.
  { label: 'Animation', movieId: 16, tvId: 16 },
  { label: 'Documentary', movieId: 99, tvId: 99 },
  { label: 'Fantasy', movieId: 14, tvId: 10765 },
  { label: 'Crime', movieId: 80, tvId: 80 },
  { label: 'Mystery', movieId: 9648, tvId: 9648 },
  { label: 'Family', movieId: 10751, tvId: 10751 },
];

export type Mood = {
  id: string;
  label: string;
  description: string;
  movieGenres: number[];
  tvGenres: number[];
  sortBy: string;
  voteAverageGte: number;
};

export const MOODS: Mood[] = [
  {
    id: 'fun',
    label: 'Fun & Light',
    description: 'Easy, entertaining, low commitment',
    movieGenres: [35, 10751, 16],
    tvGenres: [35, 10751, 16],
    sortBy: 'popularity.desc',
    voteAverageGte: 6,
  },
  {
    id: 'intense',
    label: 'Gripping & Intense',
    description: 'Edge-of-your-seat, high stakes',
    movieGenres: [53, 18, 80],
    tvGenres: [10765, 18, 80],
    sortBy: 'vote_average.desc',
    voteAverageGte: 7,
  },
  {
    id: 'scary',
    label: 'Something Scary',
    description: 'Horror, dread, jump scares',
    movieGenres: [27, 9648],
    tvGenres: [9648],
    sortBy: 'popularity.desc',
    voteAverageGte: 5.5,
  },
  {
    id: 'feelgood',
    label: 'Feel-Good',
    description: 'Warm, uplifting, comforting',
    movieGenres: [10749, 10751, 35],
    tvGenres: [18, 10751, 35],
    sortBy: 'vote_average.desc',
    voteAverageGte: 6.5,
  },
  {
    id: 'mindbending',
    label: 'Mind-Bending',
    description: 'Sci-fi, twists, makes you think',
    movieGenres: [878, 9648],
    tvGenres: [10765, 9648],
    sortBy: 'vote_average.desc',
    voteAverageGte: 7,
  },
  {
    id: 'nostalgic',
    label: 'Nostalgic / Classic',
    description: 'A well-loved older favorite',
    movieGenres: [],
    tvGenres: [],
    sortBy: 'vote_count.desc',
    voteAverageGte: 6,
  },
];

export type Era = 'new' | 'classic' | 'any';
export type Popularity = 'popular' | 'hidden-gem' | 'any';

// ISO 639-1 codes — what TMDB's own `original_language` filter (and Overseerr's `language`
// param, which passes it straight through) expects.
export const LANGUAGE_PICKS: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'da', label: 'Danish' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'hi', label: 'Hindi' },
];

// Genres a "family-friendly" pick should never surface, regardless of mood/explicit picks.
const MATURE_GENRE_IDS = new Set([27, 53, 80, 10752]); // Horror, Thriller, Crime, War

// A low-budget/homemade title on TMDB reliably has very few votes, regardless of genre or
// rating — a real theatrical/studio release almost always clears this within weeks of adding
// any metadata at all. Applied both as a query param attempt and a client-side backstop, since
// it's cheap either way and doesn't depend on trusting an unverified Overseerr param name.
export const MIN_VOTES_FOR_PROPER_PRODUCTION = 20;

// A narrow combination (e.g. two explicit genres + a recent-only era + a mood's high rating
// floor) can legitimately have very few or zero matching titles. Rather than just reporting
// "nothing matched," the caller retries at increasing relax levels, each one dropping the next
// most restrictive constraint — weakest signal first, strongest (what you actually asked for —
// genre and language) last:
//   0 = everything requested
//   1 = ignore era
//   2 = also ignore the vote-average floor and the "skip homemade" vote-count floor
//   3 = also ignore genre and language entirely (mood's sort order still applies)
export const MAX_RELAX_LEVEL = 3;

export function buildDiscoverParams(opts: {
  mediaType: 'movie' | 'tv';
  mood: Mood;
  explicitGenres: number[];
  era: Era;
  language: string; // ISO 639-1 code, or 'any'
  skipHomemade: boolean;
  familyFriendly: boolean;
  page: number;
  relaxLevel?: number;
}): Record<string, string> {
  const { mediaType, mood, explicitGenres, era, language, skipHomemade, familyFriendly, page, relaxLevel = 0 } = opts;
  const moodGenres = mediaType === 'movie' ? mood.movieGenres : mood.tvGenres;
  let genres = explicitGenres.length > 0 ? explicitGenres : moodGenres;
  if (familyFriendly) genres = genres.filter((g) => !MATURE_GENRE_IDS.has(g));

  const params: Record<string, string> = {
    sortBy: mood.sortBy,
    page: String(page),
  };

  if (relaxLevel < 2) {
    params.voteAverageGte = String(familyFriendly ? Math.max(mood.voteAverageGte, 6.5) : mood.voteAverageGte);
    if (skipHomemade) params.voteCountGte = String(MIN_VOTES_FOR_PROPER_PRODUCTION);
  }

  // TMDB's with_genres (which Overseerr's `genre` param passes straight through) treats a
  // comma-joined list as AND — "must match every genre" — while a pipe-joined list is OR. Two
  // explicit picks like "Action or Sci-Fi" are meant to widen the results, not narrow them down
  // to only titles tagged as both simultaneously (which is often close to nothing), so this
  // always joins with OR.
  if (relaxLevel < 3) {
    if (genres.length > 0) params.genre = genres.join('|');
    if (language !== 'any') params.language = language;
  }

  if (relaxLevel < 1) {
    const now = new Date();
    const thisYear = now.getUTCFullYear();
    const dateField = mediaType === 'movie' ? 'primaryReleaseDate' : 'firstAirDate';
    if (era === 'new') {
      params[`${dateField}Gte`] = `${thisYear - 2}-01-01`;
    } else if (era === 'classic') {
      params[`${dateField}Gte`] = `${thisYear - 40}-01-01`;
      params[`${dateField}Lte`] = `${thisYear - 10}-01-01`;
    }
  }

  return params;
}
