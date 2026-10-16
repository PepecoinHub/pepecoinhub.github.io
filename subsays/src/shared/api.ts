// Wire types between client and server.

export type BoardRow = { text: string; pct: number; count: number };

export type GuessMark = 'top' | 'board' | 'miss'; // green | yellow | grey in the share card

export type GuessEntry = { text: string; mark: GuessMark; points: number; matched?: string; rank?: number };

export type GuessResult = {
  guesses: GuessEntry[];
  points: number;
};

export type LeaderRow = { name: string; points: number };

/** Points earned later because answers made the board. */
export type BonusNote = { n: number; points: number; hits: { text: string; pct: number }[] };

export type CollectView = {
  n: number;
  question: string;
  closesAt: number;
  respondents: number;
  answered: boolean;
};

export type GuessView = {
  n: number;
  question: string;
  closesAt: number;
  status: 'open' | 'void';
  voidReason?: string;
  boardSize: number;
  respondents: number;
  guessesLeft: number;
  mine?: GuessResult; // the guesses made so far; matched rows are revealed one by one
  done: boolean;
  board?: BoardRow[]; // the whole board, only once all guesses are used
};

export type ArchiveView = {
  n: number;
  question: string;
  respondents: number;
  board: BoardRow[];
  status: 'done' | 'void';
};

export type State = {
  subreddit: string;
  theme: 'classic' | 'pepe';
  sponsorNote: string;
  weekEndsAt: number;
  week: string;
  collect?: CollectView;
  guess?: GuessView;
  archive?: ArchiveView; // the post's own round once it is over, or the latest finished one
  weekly: LeaderRow[];
  allTime: LeaderRow[];
  me: {
    loggedIn: boolean;
    name?: string;
    streak: number;
    weekPoints: number;
    weekRank?: number;
    allPoints: number;
    allRank?: number;
    bonus: BonusNote[]; // crowd bonuses that were settled by this request
  };
  nextRoundAt?: number;
};

export type AnswerResponse =
  | { ok: true; accepted: number; points: number; streak: number }
  | { ok: false; error: 'login' | 'closed' | 'already' | 'invalid' | 'need3' | 'same' | 'busy' };

export type GuessResponse =
  | {
      ok: true;
      guess: GuessEntry;
      result: GuessResult;
      guessesLeft: number;
      done: boolean;
      board?: BoardRow[]; // sent once the last guess is used
      shareText?: string;
      streak: number;
    }
  | { ok: false; error: 'login' | 'closed' | 'already' | 'invalid' | 'repeat' | 'void' | 'busy' };

export type SuggestResponse = { suggestions: string[] };

export const shareText = (sub: string, n: number, points: number, marks: GuessMark[]): string =>
  `Sub Says #${n} · r/${sub}\n${marks.map((m) => (m === 'top' ? '🟩' : m === 'board' ? '🟨' : '⬜')).join('')} ${points} pts`;
