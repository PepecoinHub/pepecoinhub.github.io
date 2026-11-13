-- Pepe Gold Hook campaign: 20 levels, a shop between them, one score per run, stats on the player's
-- account. Run after update_gold_hook.sql. Safe to run again. NOT YET RUN on the live project.
--
-- One call per finished run (game over or after level 20), only when the player presses "Submit score":
--   public.gry_goldhook_submit_run(p_nick, p_run)
-- p_run = {"gameId":"goldhook","version":5,"levels":[{"level":1,"catches":[{"id":5,"t":4.07}],
--          "seconds":60,"dynamite":0,"bought":["strength"]}, ...]}
-- The server replays the whole run: every catch against the fastest possible hook cycle for the
-- upgrades bought for that level (they last one level only), every purchase against the wallet (only the
-- surplus above each goal goes into it), dynamite against the
-- sticks bought, level goals and times. It counts the score itself; the browser never sends a total.
-- The score (total PEP earned in the run) goes into the shared arcade table as game 'goldhook', so
-- PondOS LEADERS and public.gry_arcade_top('goldhook') keep working. Nickname, Discord, rate limits
-- and the best-300 trim are copied 1:1 from public.gry_arcade_submit, which stays unchanged.
-- Discord players also get their stats kept in games.goldhook_players (best score, best level, runs,
-- all-time PEP); public.gry_goldhook_me() reads them. No Passport stamps.
--
-- The level tables below are generated from the game code by scripts/build_gold_hook_sql.mjs;
-- tests/gold-hook.test.mjs fails if they drift.

begin;

-- the single-round function of the first version is replaced by the run function
drop function if exists public.gry_goldhook_submit(text, jsonb, integer);

create table if not exists games.goldhook_levels (
  level    smallint primary key check (level between 1 and 20),
  duration smallint not null,
  weight   numeric  not null,
  target   integer  not null
);
create table if not exists games.goldhook_objects (
  level     smallint not null references games.goldhook_levels(level) on delete cascade,
  id        smallint not null,
  points    integer  not null,
  speed_mul numeric  not null,
  travel    numeric  not null,
  primary key (level, id)
);
create table if not exists games.goldhook_players (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  best_score  integer not null default 0,
  best_level  smallint not null default 0,
  finished    integer not null default 0,
  runs        integer not null default 0,
  total_pep   bigint  not null default 0,
  updated_at  timestamptz not null default now()
);
-- read and written only by the functions below
alter table games.goldhook_levels enable row level security;
alter table games.goldhook_objects enable row level security;
alter table games.goldhook_players enable row level security;

truncate games.goldhook_objects, games.goldhook_levels;
-- BEGIN GENERATED LEVELS (scripts/build_gold_hook_sql.mjs)
insert into games.goldhook_levels (level, duration, weight, target) values
(1, 60, 1, 700),
(2, 59, 0.988, 710),
(3, 57, 0.975, 720),
(4, 56, 0.963, 720),
(5, 54, 0.95, 730),
(6, 53, 0.938, 740),
(7, 51, 0.925, 740),
(8, 50, 0.913, 750),
(9, 48, 0.9, 750),
(10, 47, 0.888, 760),
(11, 45, 0.875, 770),
(12, 45, 0.863, 770),
(13, 45, 0.85, 780),
(14, 45, 0.838, 790),
(15, 45, 0.825, 790),
(16, 45, 0.813, 800),
(17, 45, 0.8, 810),
(18, 45, 0.8, 810),
(19, 45, 0.8, 820),
(20, 50, 0.8, 820);
insert into games.goldhook_objects (level, id, points, speed_mul, travel) values
(1, 0, 250, 0.25, 345.369),
(1, 1, 120, 0.5, 319.413),
(1, 2, 120, 0.5, 215.028),
(1, 3, 120, 0.5, 358.39),
(1, 4, 100, 0.4, 107.677),
(1, 5, 75, 1, 319.53),
(1, 6, 75, 1, 194.805),
(1, 7, 50, 1, 193.744),
(1, 8, 50, 1, 111.073),
(1, 9, 50, 1, 101.639),
(1, 10, 50, 1, 204.047),
(1, 11, 10, 0.2, 192.225),
(1, 12, 10, 0.2, 206.386),
(1, 13, 10, 0.2, 111.622),
(2, 0, 250, 0.25, 216.574),
(2, 1, 250, 0.25, 206.586),
(2, 2, 120, 0.5, 366.42),
(2, 3, 120, 0.5, 313.968),
(2, 4, 120, 0.5, 210.177),
(2, 5, 100, 0.4, 190.517),
(2, 6, 75, 1, 188.297),
(2, 7, 75, 1, 333.8),
(2, 8, 50, 1, 302.769),
(2, 9, 50, 1, 181.831),
(2, 10, 50, 1, 148.171),
(2, 11, 50, 1, 301.833),
(2, 12, 10, 0.2, 162.499),
(2, 13, 10, 0.2, 293.62),
(2, 14, 10, 0.2, 283.561),
(3, 0, 250, 0.25, 226.379),
(3, 1, 250, 0.25, 360),
(3, 2, 120, 0.5, 153.372),
(3, 3, 120, 0.5, 228.054),
(3, 4, 120, 0.5, 254.97),
(3, 5, 100, 0.4, 153.146),
(3, 6, 75, 1, 234.206),
(3, 7, 75, 1, 302.06),
(3, 8, 50, 1, 79.231),
(3, 9, 50, 1, 262.846),
(3, 10, 50, 1, 290.722),
(3, 11, 50, 1, 70.799),
(3, 12, 10, 0.2, 109.699),
(3, 13, 10, 0.2, 183.27),
(3, 14, 10, 0.2, 48.646),
(3, 15, 10, 0.2, 270.421),
(4, 0, 250, 0.25, 293.166),
(4, 1, 250, 0.25, 373.085),
(4, 2, 120, 0.5, 233.627),
(4, 3, 120, 0.5, 166.712),
(4, 4, 120, 0.5, 252.203),
(4, 5, 100, 0.4, 279.079),
(4, 6, 75, 1, 347.004),
(4, 7, 75, 1, 206.766),
(4, 8, 50, 1, 170.915),
(4, 9, 50, 1, 220.064),
(4, 10, 50, 1, 151.304),
(4, 11, 50, 1, 144.295),
(4, 12, 10, 0.2, 82.23),
(4, 13, 10, 0.2, 51.769),
(4, 14, 10, 0.2, 80.031),
(4, 15, 10, 0.2, 206.408),
(4, 16, 10, 0.2, 149.875),
(5, 0, 250, 0.25, 205.174),
(5, 1, 250, 0.25, 299.817),
(5, 2, 250, 0.25, 369.318),
(5, 3, 120, 0.5, 207.933),
(5, 4, 120, 0.5, 276.814),
(5, 5, 120, 0.5, 162.639),
(5, 6, 120, 0.5, 222.047),
(5, 7, 100, 0.4, 236.953),
(5, 8, 75, 1, 371.592),
(5, 9, 75, 1, 244.66),
(5, 10, 50, 1, 182.919),
(5, 11, 50, 1, 330.683),
(5, 12, 50, 1, 171.592),
(5, 13, 50, 1, 351.599),
(5, 14, 10, 0.2, 240.585),
(5, 15, 10, 0.2, 183.148),
(5, 16, 10, 0.2, 113.954),
(5, 17, 10, 0.2, 44.837),
(5, 18, 10, 0.2, 123.472),
(6, 0, 250, 0.25, 260.8),
(6, 1, 250, 0.25, 363.202),
(6, 2, 250, 0.25, 258.635),
(6, 3, 120, 0.5, 362.23),
(6, 4, 120, 0.5, 260.817),
(6, 5, 120, 0.5, 279.235),
(6, 6, 120, 0.5, 353.01),
(6, 7, 100, 0.4, 213.517),
(6, 8, 75, 1, 153.529),
(6, 9, 75, 1, 164.617),
(6, 10, 50, 1, 161.077),
(6, 11, 50, 1, 186.668),
(6, 12, 50, 1, 223.294),
(6, 13, 50, 1, 333.917),
(6, 14, 10, 0.2, 131.858),
(6, 15, 10, 0.2, 75.405),
(6, 16, 10, 0.2, 189.16),
(6, 17, 10, 0.2, 184.202),
(6, 18, 10, 0.2, 154.83),
(6, 19, 10, 0.2, 91.353),
(7, 0, 250, 0.25, 273.176),
(7, 1, 250, 0.25, 336.059),
(7, 2, 250, 0.25, 316.374),
(7, 3, 120, 0.5, 327.082),
(7, 4, 120, 0.5, 238.325),
(7, 5, 120, 0.5, 151.032),
(7, 6, 120, 0.5, 203.174),
(7, 7, 100, 0.4, 203.742),
(7, 8, 75, 1, 58.987),
(7, 9, 75, 1, 53.8),
(7, 10, 75, 1, 56.52),
(7, 11, 50, 1, 347.281),
(7, 12, 50, 1, 289.294),
(7, 13, 50, 1, 236.651),
(7, 14, 50, 1, 181.958),
(7, 15, 10, 0.2, 198.489),
(7, 16, 10, 0.2, 142.805),
(7, 17, 10, 0.2, 305.631),
(7, 18, 10, 0.2, 89.19),
(7, 19, 10, 0.2, 231.871),
(7, 20, 10, 0.2, 95.685),
(7, 21, 10, 0.2, 58.605),
(8, 0, 250, 0.25, 307.661),
(8, 1, 250, 0.25, 351.076),
(8, 2, 250, 0.25, 247.505),
(8, 3, 250, 0.25, 279.262),
(8, 4, 120, 0.5, 267.389),
(8, 5, 120, 0.5, 252.825),
(8, 6, 120, 0.5, 226.456),
(8, 7, 120, 0.5, 171.955),
(8, 8, 100, 0.4, 119.558),
(8, 9, 100, 0.4, 346.137),
(8, 10, 75, 1, 289.694),
(8, 11, 75, 1, 242.469),
(8, 12, 75, 1, 306.624),
(8, 13, 50, 1, 158.462),
(8, 14, 50, 1, 189.887),
(8, 15, 50, 1, 219.454),
(8, 16, 50, 1, 151.297),
(8, 17, 10, 0.2, 57.747),
(8, 18, 10, 0.2, 259.49),
(8, 19, 10, 0.2, 278.247),
(8, 20, 10, 0.2, 76.23),
(8, 21, 10, 0.2, 168.572),
(8, 22, 10, 0.2, 77.616),
(8, 23, 10, 0.2, 53.297),
(9, 0, 250, 0.25, 243.21),
(9, 1, 250, 0.25, 284.606),
(9, 2, 250, 0.25, 210.722),
(9, 3, 250, 0.25, 279.675),
(9, 4, 120, 0.5, 228.015),
(9, 5, 120, 0.5, 295.949),
(9, 6, 120, 0.5, 293.13),
(9, 7, 120, 0.5, 199.931),
(9, 8, 120, 0.5, 252.356),
(9, 9, 100, 0.4, 301.396),
(9, 10, 100, 0.4, 258.779),
(9, 11, 75, 1, 201.499),
(9, 12, 75, 1, 107.291),
(9, 13, 75, 1, 321.255),
(9, 14, 50, 1, 282.005),
(9, 15, 50, 1, 163.265),
(9, 16, 50, 1, 276.44),
(9, 17, 50, 1, 320.759),
(9, 18, 10, 0.2, 42.721),
(9, 19, 10, 0.2, 109.791),
(9, 20, 10, 0.2, 178.132),
(9, 21, 10, 0.2, 217.215),
(9, 22, 10, 0.2, 144.79),
(9, 23, 10, 0.2, 263.732),
(9, 24, 10, 0.2, 133.499),
(9, 25, 10, 0.2, 180.248),
(10, 0, 250, 0.25, 368.617),
(10, 1, 250, 0.25, 329.742),
(10, 2, 250, 0.25, 341.523),
(10, 3, 250, 0.25, 213.55),
(10, 4, 120, 0.5, 216.028),
(10, 5, 120, 0.5, 213.065),
(10, 6, 120, 0.5, 158.822),
(10, 7, 120, 0.5, 241.921),
(10, 8, 120, 0.5, 330.117),
(10, 9, 100, 0.4, 187.179),
(10, 10, 100, 0.4, 319.216),
(10, 11, 75, 1, 197.632),
(10, 12, 75, 1, 97.486),
(10, 13, 75, 1, 226.047),
(10, 14, 50, 1, 92.604),
(10, 15, 50, 1, 353.625),
(10, 16, 50, 1, 162.634),
(10, 17, 50, 1, 242.532),
(10, 18, 10, 0.2, 164.668),
(10, 19, 10, 0.2, 254.447),
(10, 20, 10, 0.2, 134.587),
(10, 21, 10, 0.2, 178.223),
(10, 22, 10, 0.2, 192.431),
(10, 23, 10, 0.2, 319.472),
(10, 24, 10, 0.2, 85.556),
(10, 25, 10, 0.2, 56.201),
(10, 26, 10, 0.2, 59.196),
(11, 0, 250, 0.25, 282.88),
(11, 1, 250, 0.25, 226.651),
(11, 2, 250, 0.25, 290.455),
(11, 3, 250, 0.25, 295.016),
(11, 4, 250, 0.25, 374.599),
(11, 5, 120, 0.5, 274.928),
(11, 6, 120, 0.5, 362.282),
(11, 7, 120, 0.5, 159.353),
(11, 8, 120, 0.5, 206.875),
(11, 9, 120, 0.5, 326.082),
(11, 10, 100, 0.4, 324.59),
(11, 11, 100, 0.4, 137.423),
(11, 12, 75, 1, 338.8),
(11, 13, 75, 1, 236.771),
(11, 14, 75, 1, 102.251),
(11, 15, 50, 1, 250.079),
(11, 16, 50, 1, 117.298),
(11, 17, 50, 1, 267.81),
(11, 18, 50, 1, 132.481),
(11, 19, 10, 0.2, 127.507),
(11, 20, 10, 0.2, 72.771),
(11, 21, 10, 0.2, 88.029),
(11, 22, 10, 0.2, 269.18),
(11, 23, 10, 0.2, 217.793),
(11, 24, 10, 0.2, 128.376),
(11, 25, 10, 0.2, 92.724),
(11, 26, 10, 0.2, 180.993),
(11, 27, 10, 0.2, 298.431),
(12, 0, 250, 0.25, 248.209),
(12, 1, 250, 0.25, 259.188),
(12, 2, 250, 0.25, 322.756),
(12, 3, 250, 0.25, 253.867),
(12, 4, 250, 0.25, 227.759),
(12, 5, 120, 0.5, 326.566),
(12, 6, 120, 0.5, 234.833),
(12, 7, 120, 0.5, 285.07),
(12, 8, 120, 0.5, 184.032),
(12, 9, 120, 0.5, 168.224),
(12, 10, 100, 0.4, 191.194),
(12, 11, 100, 0.4, 274.975),
(12, 12, 75, 1, 348.682),
(12, 13, 75, 1, 362.882),
(12, 14, 75, 1, 370.815),
(12, 15, 50, 1, 289.579),
(12, 16, 50, 1, 323.545),
(12, 17, 50, 1, 358.139),
(12, 18, 50, 1, 126.601),
(12, 19, 10, 0.2, 271.498),
(12, 20, 10, 0.2, 65.763),
(12, 21, 10, 0.2, 81.045),
(12, 22, 10, 0.2, 128.603),
(12, 23, 10, 0.2, 43.282),
(12, 24, 10, 0.2, 96.665),
(12, 25, 10, 0.2, 97.461),
(12, 26, 10, 0.2, 96.511),
(12, 27, 10, 0.2, 122.526),
(12, 28, 10, 0.2, 134.914),
(13, 0, 250, 0.25, 278.209),
(13, 1, 250, 0.25, 329.671),
(13, 2, 250, 0.25, 259.661),
(13, 3, 250, 0.25, 314.516),
(13, 4, 250, 0.25, 271.55),
(13, 5, 120, 0.5, 168.905),
(13, 6, 120, 0.5, 217.912),
(13, 7, 120, 0.5, 274.551),
(13, 8, 120, 0.5, 357.837),
(13, 9, 120, 0.5, 209.426),
(13, 10, 120, 0.5, 260.694),
(13, 11, 100, 0.4, 286.835),
(13, 12, 100, 0.4, 182.203),
(13, 13, 75, 1, 74.27),
(13, 14, 75, 1, 322.418),
(13, 15, 75, 1, 295.622),
(13, 16, 50, 1, 258.775),
(13, 17, 50, 1, 290.413),
(13, 18, 50, 1, 73.981),
(13, 19, 50, 1, 191.491),
(13, 20, 10, 0.2, 313.616),
(13, 21, 10, 0.2, 133.163),
(13, 22, 10, 0.2, 220.24),
(13, 23, 10, 0.2, 134.246),
(13, 24, 10, 0.2, 201.092),
(13, 25, 10, 0.2, 167.202),
(13, 26, 10, 0.2, 228.77),
(13, 27, 10, 0.2, 194.526),
(13, 28, 10, 0.2, 251.841),
(13, 29, 10, 0.2, 203.812),
(13, 30, 10, 0.2, 142.516),
(14, 0, 250, 0.25, 284.746),
(14, 1, 250, 0.25, 242.757),
(14, 2, 250, 0.25, 252.815),
(14, 3, 250, 0.25, 287.761),
(14, 4, 250, 0.25, 374.937),
(14, 5, 250, 0.25, 374.567),
(14, 6, 120, 0.5, 171.94),
(14, 7, 120, 0.5, 333.627),
(14, 8, 120, 0.5, 303.764),
(14, 9, 120, 0.5, 301.782),
(14, 10, 120, 0.5, 237.308),
(14, 11, 120, 0.5, 285.483),
(14, 12, 100, 0.4, 363.2),
(14, 13, 100, 0.4, 355.236),
(14, 14, 75, 1, 211.142),
(14, 15, 75, 1, 335.726),
(14, 16, 75, 1, 149.369),
(14, 17, 75, 1, 283.147),
(14, 18, 50, 1, 154.775),
(14, 19, 50, 1, 303.111),
(14, 20, 50, 1, 330.597),
(14, 21, 50, 1, 203.819),
(14, 22, 10, 0.2, 182.153),
(14, 23, 10, 0.2, 254.1),
(14, 24, 10, 0.2, 55.228),
(14, 25, 10, 0.2, 65.132),
(14, 26, 10, 0.2, 104.502),
(14, 27, 10, 0.2, 251.841),
(14, 28, 10, 0.2, 288.778),
(14, 29, 10, 0.2, 168.657),
(14, 30, 10, 0.2, 223.602),
(14, 31, 10, 0.2, 258.029),
(14, 32, 10, 0.2, 287.241),
(15, 0, 250, 0.25, 292.405),
(15, 1, 250, 0.25, 301.618),
(15, 2, 250, 0.25, 324.138),
(15, 3, 250, 0.25, 280.766),
(15, 4, 250, 0.25, 268.527),
(15, 5, 250, 0.25, 313.255),
(15, 6, 120, 0.5, 270.538),
(15, 7, 120, 0.5, 313.852),
(15, 8, 120, 0.5, 372.409),
(15, 9, 120, 0.5, 352.8),
(15, 10, 120, 0.5, 201.168),
(15, 11, 120, 0.5, 206.595),
(15, 12, 100, 0.4, 141.386),
(15, 13, 100, 0.4, 217.6),
(15, 14, 75, 1, 215.754),
(15, 15, 75, 1, 237.708),
(15, 16, 75, 1, 71.698),
(15, 17, 75, 1, 375.264),
(15, 18, 50, 1, 112.572),
(15, 19, 50, 1, 273.687),
(15, 20, 50, 1, 119.664),
(15, 21, 50, 1, 157.723),
(15, 22, 10, 0.2, 243.806),
(15, 23, 10, 0.2, 79.72),
(15, 24, 10, 0.2, 219.978),
(15, 25, 10, 0.2, 206.557),
(15, 26, 10, 0.2, 138.695),
(15, 27, 10, 0.2, 86.12),
(15, 28, 10, 0.2, 153.067),
(15, 29, 10, 0.2, 164.844),
(15, 30, 10, 0.2, 82.165),
(15, 31, 10, 0.2, 59.188),
(15, 32, 10, 0.2, 187.639),
(15, 33, 10, 0.2, 126.108),
(16, 0, 250, 0.25, 341.636),
(16, 1, 250, 0.25, 296.476),
(16, 2, 250, 0.25, 279.366),
(16, 3, 250, 0.25, 244.529),
(16, 4, 250, 0.25, 330.679),
(16, 5, 250, 0.25, 258.105),
(16, 6, 120, 0.5, 203.377),
(16, 7, 120, 0.5, 354.043),
(16, 8, 120, 0.5, 249.641),
(16, 9, 120, 0.5, 280.001),
(16, 10, 120, 0.5, 289.665),
(16, 11, 120, 0.5, 320.742),
(16, 12, 100, 0.4, 106.026),
(16, 13, 100, 0.4, 113.011),
(16, 14, 100, 0.4, 202.126),
(16, 15, 75, 1, 342.603),
(16, 16, 75, 1, 294.929),
(16, 17, 75, 1, 261.22),
(16, 18, 75, 1, 297.808),
(16, 19, 50, 1, 243.378),
(16, 20, 50, 1, 138.952),
(16, 21, 50, 1, 166.568),
(16, 22, 50, 1, 327.742),
(16, 23, 10, 0.2, 186.969),
(16, 24, 10, 0.2, 170.619),
(16, 25, 10, 0.2, 260.346),
(16, 26, 10, 0.2, 178.611),
(16, 27, 10, 0.2, 158.652),
(16, 28, 10, 0.2, 37.404),
(16, 29, 10, 0.2, 190.339),
(16, 30, 10, 0.2, 291.266),
(16, 31, 10, 0.2, 151.618),
(16, 32, 10, 0.2, 230.777),
(16, 33, 10, 0.2, 107.891),
(16, 34, 10, 0.2, 226.518),
(16, 35, 10, 0.2, 228.756),
(17, 0, 250, 0.25, 265.529),
(17, 1, 250, 0.25, 311.011),
(17, 2, 250, 0.25, 270.969),
(17, 3, 250, 0.25, 354.834),
(17, 4, 250, 0.25, 353.713),
(17, 5, 250, 0.25, 318.931),
(17, 6, 250, 0.25, 252.374),
(17, 7, 120, 0.5, 214.218),
(17, 8, 120, 0.5, 334.216),
(17, 9, 120, 0.5, 375.415),
(17, 10, 120, 0.5, 267.51),
(17, 11, 120, 0.5, 229.369),
(17, 12, 120, 0.5, 367.112),
(17, 13, 120, 0.5, 300.89),
(17, 14, 100, 0.4, 298.485),
(17, 15, 100, 0.4, 151.347),
(17, 16, 100, 0.4, 142.021),
(17, 17, 75, 1, 245.909),
(17, 18, 75, 1, 311.54),
(17, 19, 75, 1, 243.279),
(17, 20, 75, 1, 163.353),
(17, 21, 50, 1, 234.061),
(17, 22, 50, 1, 300.736),
(17, 23, 50, 1, 297.618),
(17, 24, 50, 1, 259.284),
(17, 25, 10, 0.2, 61.197),
(17, 26, 10, 0.2, 247.459),
(17, 27, 10, 0.2, 291.407),
(17, 28, 10, 0.2, 155.762),
(17, 29, 10, 0.2, 101.924),
(17, 30, 10, 0.2, 261.679),
(17, 31, 10, 0.2, 182.081),
(17, 32, 10, 0.2, 162.079),
(17, 33, 10, 0.2, 203.655),
(17, 34, 10, 0.2, 133.229),
(17, 35, 10, 0.2, 96.862),
(17, 36, 10, 0.2, 153.813),
(17, 37, 10, 0.2, 103.481),
(18, 0, 250, 0.25, 254.322),
(18, 1, 250, 0.25, 358.206),
(18, 2, 250, 0.25, 290.199),
(18, 3, 250, 0.25, 328.814),
(18, 4, 250, 0.25, 297.72),
(18, 5, 250, 0.25, 262.18),
(18, 6, 250, 0.25, 355.47),
(18, 7, 120, 0.5, 279.597),
(18, 8, 120, 0.5, 223.558),
(18, 9, 120, 0.5, 347.825),
(18, 10, 120, 0.5, 274.8),
(18, 11, 120, 0.5, 325.247),
(18, 12, 120, 0.5, 194.992),
(18, 13, 120, 0.5, 246.556),
(18, 14, 100, 0.4, 264.054),
(18, 15, 100, 0.4, 322.989),
(18, 16, 100, 0.4, 134.688),
(18, 17, 75, 1, 151.544),
(18, 18, 75, 1, 233.063),
(18, 19, 75, 1, 156.058),
(18, 20, 75, 1, 365.124),
(18, 21, 50, 1, 342.453),
(18, 22, 50, 1, 258.189),
(18, 23, 50, 1, 207.54),
(18, 24, 50, 1, 186.817),
(18, 25, 10, 0.2, 51.978),
(18, 26, 10, 0.2, 305.571),
(18, 27, 10, 0.2, 233.42),
(18, 28, 10, 0.2, 276.767),
(18, 29, 10, 0.2, 280.838),
(18, 30, 10, 0.2, 70.843),
(18, 31, 10, 0.2, 81.917),
(18, 32, 10, 0.2, 126.644),
(18, 33, 10, 0.2, 108.918),
(18, 34, 10, 0.2, 49.871),
(18, 35, 10, 0.2, 189.198),
(18, 36, 10, 0.2, 80.753),
(18, 37, 10, 0.2, 157.227),
(18, 38, 10, 0.2, 279.654),
(19, 0, 250, 0.25, 269.717),
(19, 1, 250, 0.25, 271.162),
(19, 2, 250, 0.25, 298.37),
(19, 3, 250, 0.25, 319.621),
(19, 4, 250, 0.25, 290.435),
(19, 5, 250, 0.25, 339.079),
(19, 6, 250, 0.25, 363.202),
(19, 7, 120, 0.5, 215.255),
(19, 8, 120, 0.5, 264.013),
(19, 9, 120, 0.5, 314.921),
(19, 10, 120, 0.5, 279.476),
(19, 11, 120, 0.5, 292.077),
(19, 12, 120, 0.5, 238.771),
(19, 13, 120, 0.5, 326.666),
(19, 14, 100, 0.4, 123.517),
(19, 15, 100, 0.4, 159.887),
(19, 16, 100, 0.4, 217.753),
(19, 17, 75, 1, 184.402),
(19, 18, 75, 1, 188.776),
(19, 19, 75, 1, 344.886),
(19, 20, 75, 1, 220.701),
(19, 21, 50, 1, 169.98),
(19, 22, 50, 1, 257.205),
(19, 23, 50, 1, 284.512),
(19, 24, 50, 1, 328.418),
(19, 25, 10, 0.2, 121.173),
(19, 26, 10, 0.2, 229.865),
(19, 27, 10, 0.2, 224.459),
(19, 28, 10, 0.2, 244.774),
(19, 29, 10, 0.2, 244.611),
(19, 30, 10, 0.2, 93.108),
(19, 31, 10, 0.2, 272.846),
(19, 32, 10, 0.2, 46.562),
(19, 33, 10, 0.2, 196.557),
(19, 34, 10, 0.2, 168.948),
(19, 35, 10, 0.2, 300.495),
(19, 36, 10, 0.2, 173.78),
(19, 37, 10, 0.2, 76.903),
(19, 38, 10, 0.2, 95.041),
(19, 39, 10, 0.2, 215.772),
(20, 0, 250, 0.25, 342.316),
(20, 1, 250, 0.25, 361.17),
(20, 2, 250, 0.25, 356.063),
(20, 3, 250, 0.25, 273.991),
(20, 4, 250, 0.25, 329.011),
(20, 5, 250, 0.25, 311.922),
(20, 6, 250, 0.25, 280.042),
(20, 7, 250, 0.25, 267.053),
(20, 8, 120, 0.5, 226.856),
(20, 9, 120, 0.5, 280.918),
(20, 10, 120, 0.5, 324.253),
(20, 11, 120, 0.5, 203.182),
(20, 12, 120, 0.5, 252.063),
(20, 13, 120, 0.5, 330.62),
(20, 14, 120, 0.5, 331.097),
(20, 15, 100, 0.4, 166.819),
(20, 16, 100, 0.4, 117.172),
(20, 17, 100, 0.4, 261.928),
(20, 18, 75, 1, 366.822),
(20, 19, 75, 1, 360.977),
(20, 20, 75, 1, 297.025),
(20, 21, 75, 1, 358.346),
(20, 22, 50, 1, 93.069),
(20, 23, 50, 1, 159.661),
(20, 24, 50, 1, 257.734),
(20, 25, 50, 1, 306.042),
(20, 26, 10, 0.2, 89.2),
(20, 27, 10, 0.2, 136.902),
(20, 28, 10, 0.2, 190.653),
(20, 29, 10, 0.2, 302.875),
(20, 30, 10, 0.2, 249.928),
(20, 31, 10, 0.2, 50.648),
(20, 32, 10, 0.2, 182.652),
(20, 33, 10, 0.2, 159.427),
(20, 34, 10, 0.2, 51.021),
(20, 35, 10, 0.2, 125.957),
(20, 36, 10, 0.2, 251.453),
(20, 37, 10, 0.2, 193.628),
(20, 38, 10, 0.2, 59.053),
(20, 39, 10, 0.2, 70.221),
(20, 40, 10, 0.2, 288.604);
-- END GENERATED LEVELS

create or replace function public.gry_goldhook_submit_run(p_nick text, p_run jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  u      uuid := auth.uid();
  d      jsonb := case when u is null then null else games.discord_identity(u) end;
  ip     text := games.client_ip_hash();
  v_nick text := btrim(regexp_replace(coalesce(p_nick, ''), '\s+', ' ', 'g'));
  bad    constant text := 'That run does not add up';
  lv jsonb; c jsonb; it jsonb;
  i int := 0; n_levels int;
  v_dur numeric; v_weight numeric; v_target int;
  money int := 0; total int := 0; s_str int := 0; s_reel int := 0; s_dyn int := 0; s_clock int := 0;
  v_seconds numeric; v_dyn int; earned int; prev_t numeric; seen int[];
  v_id int; v_t numeric; v_points int; v_mul numeric; v_travel numeric;
  ext numeric; loaded numeric; v_min numeric;
  won boolean; v_finished boolean := false; price int; item text;
  ms_total numeric := 0; n int; place int; v_best int;
begin
  if p_run is null or jsonb_typeof(p_run) <> 'object' or p_run ->> 'gameId' is distinct from 'goldhook'
     or (p_run ->> 'version') is distinct from '5' or jsonb_typeof(p_run -> 'levels') is distinct from 'array' then
    raise exception '%', bad;
  end if;
  n_levels := jsonb_array_length(p_run -> 'levels');
  if n_levels < 1 or n_levels > 20 then raise exception '%', bad; end if;

  for lv in select e.value from jsonb_array_elements(p_run -> 'levels') with ordinality as e(value, idx) order by e.idx loop
    i := i + 1;
    if jsonb_typeof(lv) is distinct from 'object' or (lv ->> 'level') is distinct from i::text
       or jsonb_typeof(lv -> 'seconds') is distinct from 'number'
       or jsonb_typeof(lv -> 'dynamite') is distinct from 'number' or (lv ->> 'dynamite') !~ '^[0-9]{1,2}$'
       or jsonb_typeof(lv -> 'catches') is distinct from 'array' or jsonb_array_length(lv -> 'catches') > 40
       or jsonb_typeof(lv -> 'bought') is distinct from 'array' or jsonb_array_length(lv -> 'bought') > 12 then
      raise exception '%', bad;
    end if;
    select l.duration, l.weight, l.target into v_dur, v_weight, v_target from games.goldhook_levels l where l.level = i;
    if v_dur is null then raise exception '%', bad; end if;
    v_dur := v_dur + case when s_clock > 0 then 10 else 0 end;
    ext := 300 * (1 + 0.30 * s_reel);
    loaded := 220 * (1 + 0.50 * s_str);
    v_seconds := (lv ->> 'seconds')::numeric;
    v_dyn := (lv ->> 'dynamite')::int;
    if v_seconds <= 0 or v_seconds > v_dur + 0.05 or v_dyn > s_dyn then raise exception '%', bad; end if;

    earned := 0; prev_t := 0; seen := '{}';
    for c in select e.value from jsonb_array_elements(lv -> 'catches') with ordinality as e(value, idx) order by e.idx loop
      if jsonb_typeof(c -> 'id') is distinct from 'number' or jsonb_typeof(c -> 't') is distinct from 'number'
         or (c ->> 'id') !~ '^[0-9]{1,2}$' then
        raise exception '%', bad;
      end if;
      v_id := (c ->> 'id')::int;
      v_t := (c ->> 't')::numeric;
      v_points := null;
      select o.points, o.speed_mul, o.travel into v_points, v_mul, v_travel
      from games.goldhook_objects o where o.level = i and o.id = v_id;
      if v_points is null or v_id = any (seen) or v_t <= 0 or v_t > v_seconds + 0.001 or v_t < prev_t then
        raise exception '%', bad;
      end if;
      -- the fastest possible hook cycle for this object with the upgrades owned now (×0.95 − 0.02 s)
      v_min := v_travel / ext + v_travel / (loaded * v_mul * v_weight);
      if v_t - prev_t < v_min * 0.95 - 0.02 then raise exception '%', bad; end if;
      seen := seen || v_id;
      prev_t := v_t;
      earned := earned + v_points;
    end loop;

    total := total + earned;
    -- what was bought for this level is used up (unused dynamite is lost); the shop buys for the next one
    s_str := 0; s_reel := 0; s_dyn := 0; s_clock := 0;
    ms_total := ms_total + v_seconds;
    won := earned >= v_target;
    -- only the surplus above the goal goes to the wallet for the shop
    if won then money := money + earned - v_target; end if;
    if not won or i = 20 then
      if i <> n_levels or jsonb_array_length(lv -> 'bought') > 0 then raise exception '%', bad; end if;
      v_finished := won;
      exit;
    end if;
    if i = n_levels then raise exception 'Finish the run first'; end if;

    -- the shop after this level, for level i + 1: base × (19 + level) / 20, as in docs/games/js/gold-hook-campaign.mjs
    for it in select e.value from jsonb_array_elements(lv -> 'bought') with ordinality as e(value, idx) order by e.idx loop
      if jsonb_typeof(it) is distinct from 'string' then raise exception '%', bad; end if;
      item := it #>> '{}';
      price := case item
        when 'strength' then case when s_str < 1 then 200 end
        when 'reel' then case when s_reel < 1 then 160 end
        when 'dynamite' then case when s_dyn < 3 then 60 end
        when 'clock' then case when s_clock < 1 then 120 end
      end * (19 + i + 1) / 20;
      if price is null or money < price then raise exception '%', bad; end if;
      money := money - price;
      if item = 'strength' then s_str := s_str + 1;
      elsif item = 'reel' then s_reel := s_reel + 1;
      elsif item = 'dynamite' then s_dyn := s_dyn + 1;
      else s_clock := s_clock + 1;
      end if;
    end loop;
  end loop;

  if total < 1 then raise exception 'Nothing to submit'; end if;

  -- Rate limits: as in public.gry_arcade_submit.
  perform 1 from games.config where id = 1 for update;
  if (select count(*) from games.arcade_scores where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'The high score table is busy. Try again later';
  end if;
  if ip is not null then
    select count(*) into n from games.arcade_scores where ip_hash = ip and created_at > now() - interval '10 minutes';
    if n >= 6 then raise exception 'Slow down a little, fren'; end if;
  else
    select count(*) into n from games.arcade_scores where ip_hash is null and created_at > now() - interval '10 minutes';
    if n >= 40 then raise exception 'Slow down a little, fren'; end if;
  end if;
  if u is not null then
    select count(*) into n from games.arcade_scores where user_id = u and created_at > now() - interval '10 minutes';
    if n >= 6 then raise exception 'Slow down a little, fren'; end if;
  end if;

  -- Nickname: as in public.gry_arcade_submit.
  if d is not null then
    v_nick := left(d ->> 'name', 32);
  else
    if char_length(v_nick) < 2 or char_length(v_nick) > 20 or v_nick !~ '^[A-Za-z0-9 _.\-]+$' then
      raise exception 'Nickname: 2 to 20 letters, digits, spaces, _ . -';
    end if;
    if games.is_profane(v_nick) then raise exception 'Pick a different nickname'; end if;
    if exists (select 1 from games.arcade_scores s where s.verified and lower(s.nick) = lower(v_nick)) then
      raise exception 'That name belongs to a verified player. Sign in with Discord on PEP Games, or pick another';
    end if;
  end if;

  insert into games.arcade_scores (game, nick, score, verified, user_id, duration_ms, ip_hash)
  values ('goldhook', v_nick, total, d is not null, case when d is not null then u end, round(ms_total * 1000)::int, ip);

  delete from games.arcade_scores a where a.game = 'goldhook' and a.id not in (
    select id from games.arcade_scores where game = 'goldhook' order by score desc, created_at limit 300);

  select 1 + count(*) into place from (
    select max(a.score) s from games.arcade_scores a where a.game = 'goldhook'
    group by case when a.verified then a.user_id::text else 'n:' || lower(a.nick) end) t
  where t.s > total;

  -- The player's account (Discord players only).
  if d is not null then
    insert into games.goldhook_players as p (user_id, best_score, best_level, finished, runs, total_pep, updated_at)
    values (u, total, i, case when v_finished then 1 else 0 end, 1, total, now())
    on conflict (user_id) do update set
      best_score = greatest(p.best_score, excluded.best_score),
      best_level = greatest(p.best_level, excluded.best_level),
      finished   = p.finished + excluded.finished,
      runs       = p.runs + 1,
      total_pep  = p.total_pep + excluded.total_pep,
      updated_at = now()
    returning p.best_score into v_best;
  end if;

  return jsonb_build_object('nick', v_nick, 'verified', d is not null, 'place', place, 'score', total,
    'level', i, 'finished', v_finished, 'best', v_best);
end
$function$;

-- The signed-in Discord player's own stats (null for guests or before the first run).
create or replace function public.gry_goldhook_me()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select case when auth.uid() is null or games.discord_identity(auth.uid()) is null then null
         else (select jsonb_build_object('best_score', p.best_score, 'best_level', p.best_level,
                 'finished', p.finished, 'runs', p.runs, 'total_pep', p.total_pep, 'updated_at', p.updated_at)
               from games.goldhook_players p where p.user_id = auth.uid()) end
$function$;

revoke all on function public.gry_goldhook_submit_run(text, jsonb) from public;
grant execute on function public.gry_goldhook_submit_run(text, jsonb) to anon, authenticated;
revoke all on function public.gry_goldhook_me() from public;
grant execute on function public.gry_goldhook_me() to authenticated;

commit;

-- Undo (if ever needed):
--   drop function public.gry_goldhook_submit_run(text, jsonb);
--   drop function public.gry_goldhook_me();
--   drop table games.goldhook_players, games.goldhook_objects, games.goldhook_levels;
