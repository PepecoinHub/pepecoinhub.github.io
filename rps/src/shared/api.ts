import type { Move, Result } from './rules.js';

export type TeamRow = { name: string; points: number; w: number; l: number; d: number; players: number };
export type Rivalry = { a: string; b: string; aw: number; bw: number; d: number };

export type DuelRow = { id: string; name: string; at: number; mine: boolean };
export type Duelist = { name: string; points: number; w: number; l: number; d: number };

export type MyThrow = {
  id: string;
  kind: 'team' | 'duel';
  move: Move;
  at: number;
  status: 'waiting' | 'done';
  result?: Result;
  oppTeam?: string;
  oppName?: string; // duels only: the opponent is a named player
  oppMove?: Move;
  resolvedAt?: number;
};

// r is from a's point of view. For duels a and b are usernames, otherwise team names.
export type Tick = { at: number; a: string; b: string; r: Result; duel?: boolean };

export type State = {
  season: string;
  seasonEndsAt: number;
  theme: 'classic' | 'pepe';
  sponsorNote: string;
  featured: string[];
  teams: TeamRow[];
  rivalries: Rivalry[];
  duels: DuelRow[]; // open duels waiting for a challenger
  duelists: Duelist[];
  ticker: Tick[];
  me: {
    loggedIn: boolean;
    team?: string;
    canChangeTeam: boolean;
    throwsLeft: number;
    dailyLimit: number;
    record: { w: number; l: number; d: number };
    pending: number;
    recent: MyThrow[];
    news: MyThrow[]; // resolved since the player last looked
  };
};

export type ThrowResponse =
  | { ok: true; status: 'matched'; id: string; result: Result; oppTeam: string; oppMove: Move; throwsLeft: number }
  | { ok: true; status: 'waiting'; id: string; throwsLeft: number }
  | { ok: false; error: 'login' | 'noteam' | 'limit' | 'pending' | 'busy' | 'invalid' };

export type TeamResponse =
  | { ok: true; team: string }
  | { ok: false; error: 'login' | 'invalid' | 'notfound' | 'nsfw' | 'locked' };

export type DuelOpenResponse =
  | { ok: true; id: string; throwsLeft: number }
  | { ok: false; error: 'login' | 'invalid' | 'limit' | 'pending' | 'busy' };

export type DuelAcceptResponse =
  | { ok: true; result: Result; oppName: string; oppMove: Move; throwsLeft: number }
  | { ok: false; error: 'login' | 'invalid' | 'limit' | 'busy' | 'gone' | 'self' };

export type LiveMsg = { t: 'match'; a: string; b: string; r: Result; at: number; duel?: boolean };
export const LIVE_CHANNEL = 'subwars_arena';
