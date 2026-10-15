// Wire types between client and server.

export type Mark = 'm' | 'h'; // miss | hit

export type SunkShip = { len: number; cells: number[]; by: string };

export type LeaderRow = { name: string; score: number };

export type Finish = {
  at: number;
  shots: number;
  players: number;
  finisher: string;
};

export type GameState = {
  size: number;
  shots: Record<string, Mark>; // cell index -> mark
  sunk: SunkShip[];
  remaining: number[]; // lengths of ships still afloat
  totalShots: number;
  players: number;
  leaders: LeaderRow[];
  regenSec: number;
  maxCharges: number;
  theme: 'classic' | 'pepe';
  sponsorNote: string;
  subreddit: string;
  finish?: Finish;
  me: {
    loggedIn: boolean;
    name?: string;
    charges: number;
    nextAt: number | null;
    score: number;
    shots: number;
  };
};

export type FireRequest = { cell: number };

export type FireOk = {
  ok: true;
  cell: number;
  result: Mark;
  sunk?: SunkShip;
  won?: boolean;
  points: number;
  charges: number;
  nextAt: number | null;
};

export type FireErr = {
  ok: false;
  error: 'login' | 'finished' | 'cooldown' | 'taken' | 'busy' | 'invalid';
  nextAt?: number | null;
  existing?: Mark;
};

export type FireResponse = FireOk | FireErr;

// Realtime broadcast so every open post updates live.
export type LiveMsg =
  | { t: 'shot'; cell: number; result: Mark; by: string; sunk?: SunkShip; totalShots: number }
  | { t: 'win'; by: string; shots: number; players: number };

export const liveChannel = (postId: string) => `armada_${postId}`;
