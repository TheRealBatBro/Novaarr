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

// Genres a "family-friendly" pick should never surface, regardless of mood/explicit picks.
const MATURE_GENRE_IDS = new Set([27, 53, 80, 10752]); // Horror, Thriller, Crime, War

export function buildDiscoverParams(opts: {
  mediaType: 'movie' | 'tv';
  mood: Mood;
  explicitGenres: number[];
  era: Era;
  familyFriendly: boolean;
  page: number;
}): Record<string, string> {
  const { mediaType, mood, explicitGenres, era, familyFriendly, page } = opts;
  const moodGenres = mediaType === 'movie' ? mood.movieGenres : mood.tvGenres;
  let genres = explicitGenres.length > 0 ? explicitGenres : moodGenres;
  if (familyFriendly) genres = genres.filter((g) => !MATURE_GENRE_IDS.has(g));

  const params: Record<string, string> = {
    sortBy: mood.sortBy,
    voteAverageGte: String(familyFriendly ? Math.max(mood.voteAverageGte, 6.5) : mood.voteAverageGte),
    page: String(page),
  };
  if (genres.length > 0) params.genre = genres.join(',');

  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const dateField = mediaType === 'movie' ? 'primaryReleaseDate' : 'firstAirDate';
  if (era === 'new') {
    params[`${dateField}Gte`] = `${thisYear - 2}-01-01`;
  } else if (era === 'classic') {
    params[`${dateField}Gte`] = `${thisYear - 40}-01-01`;
    params[`${dateField}Lte`] = `${thisYear - 10}-01-01`;
  }

  return params;
}
