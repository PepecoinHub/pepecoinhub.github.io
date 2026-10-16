// Wire types between client and server.

export type BoardRow = { text: string; pct: number; count: number };

export type GuessMark = 'top' | 'board' | 'miss'; // green | yellow | grey in the share card

export type GuessResult = {
  guesses: { text: string; mark: GuessMark; points: number; matched?: string }[];
  points: number;
};

export type LeaderRow = { name: string; points: number };

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
  mine?: GuessResult;
  board?: BoardRow[]; // only after the player has guessed
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
  me: {
    loggedIn: boolean;
    name?: string;
    streak: number;
    weekPoints: number;
    weekRank?: number;
    seenIntro: boolean;
  };
  nextRoundAt?: number;
};

export type AnswerResponse =
  | { ok: true; accepted: number; points: number; streak: number }
  | { ok: false; error: 'login' | 'closed' | 'already' | 'invalid' | 'busy' };

export type GuessResponse =
  | { ok: true; result: GuessResult; board: BoardRow[]; streak: number; shareText: string }
  | { ok: false; error: 'login' | 'closed' | 'already' | 'invalid' | 'void' | 'busy' };

export type SuggestResponse = { suggestions: string[] };

export const shareText = (sub: string, n: number, points: number, marks: GuessMark[]): string =>
  `Sub Says #${n} · r/${sub}\n${marks.map((m) => (m === 'top' ? '🟩' : m === 'board' ? '🟨' : '⬜')).join('')} ${points} pts`;
