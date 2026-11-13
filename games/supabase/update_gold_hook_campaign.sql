-- Pepe Gold Hook campaign: 20 levels, a shop between them, one score per run, stats on the player's
-- account. Run after update_gold_hook.sql. Safe to run again. NOT YET RUN on the live project.
--
-- One call per finished run (game over or after level 20), only when the player presses "Submit score":
--   public.gry_goldhook_submit_run(p_nick, p_run)
-- p_run = {"gameId":"goldhook","version":4,"levels":[{"level":1,"catches":[{"id":5,"t":4.07}],
--          "seconds":60,"dynamite":0,"bought":["strength"]}, ...]}
-- The server replays the whole run: every catch against the fastest possible hook cycle for the
-- upgrades bought for that level (they last one level only), every purchase against the money earned so far, dynamite against the
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
(1, 60, 1, 780),
(2, 59, 0.988, 830),
(3, 57, 0.975, 870),
(4, 56, 0.963, 910),
(5, 54, 0.95, 950),
(6, 53, 0.938, 990),
(7, 51, 0.925, 1030),
(8, 50, 0.913, 1040),
(9, 48, 0.9, 1040),
(10, 47, 0.888, 1040),
(11, 45, 0.875, 1040),
(12, 45, 0.863, 1040),
(13, 45, 0.85, 1040),
(14, 45, 0.838, 1040),
(15, 45, 0.825, 1040),
(16, 45, 0.813, 1040),
(17, 45, 0.8, 1040),
(18, 45, 0.8, 1040),
(19, 45, 0.8, 1090),
(20, 50, 0.8, 1090);
insert into games.goldhook_objects (level, id, points, speed_mul, travel) values
(1, 0, 250, 0.25, 237.587),
(1, 1, 120, 0.5, 266.984),
(1, 2, 120, 0.5, 204.327),
(1, 3, 120, 0.5, 285.191),
(1, 4, 100, 0.4, 241.743),
(1, 5, 75, 1, 157.674),
(1, 6, 75, 1, 95.738),
(1, 7, 50, 1, 258.586),
(1, 8, 50, 1, 79.6),
(1, 9, 50, 1, 191.391),
(1, 10, 50, 1, 353.456),
(1, 11, 10, 0.2, 294.404),
(1, 12, 10, 0.2, 114.71),
(1, 13, 10, 0.2, 126.095),
(2, 0, 250, 0.25, 223.833),
(2, 1, 250, 0.25, 294.516),
(2, 2, 120, 0.5, 220.534),
(2, 3, 120, 0.5, 239.768),
(2, 4, 120, 0.5, 134.433),
(2, 5, 100, 0.4, 171.924),
(2, 6, 75, 1, 160.658),
(2, 7, 75, 1, 162.84),
(2, 8, 50, 1, 196.143),
(2, 9, 50, 1, 217.812),
(2, 10, 50, 1, 317.198),
(2, 11, 50, 1, 296.46),
(2, 12, 10, 0.2, 290.009),
(2, 13, 10, 0.2, 73.821),
(2, 14, 10, 0.2, 108.959),
(3, 0, 250, 0.25, 192.383),
(3, 1, 250, 0.25, 285.123),
(3, 2, 120, 0.5, 299.547),
(3, 3, 120, 0.5, 129.665),
(3, 4, 120, 0.5, 202.887),
(3, 5, 100, 0.4, 302.57),
(3, 6, 75, 1, 288.07),
(3, 7, 75, 1, 255.925),
(3, 8, 50, 1, 171.243),
(3, 9, 50, 1, 251.601),
(3, 10, 50, 1, 163.728),
(3, 11, 50, 1, 249.058),
(3, 12, 10, 0.2, 276.558),
(3, 13, 10, 0.2, 112.931),
(3, 14, 10, 0.2, 162.47),
(3, 15, 10, 0.2, 205.223),
(4, 0, 250, 0.25, 347.929),
(4, 1, 250, 0.25, 269.888),
(4, 2, 120, 0.5, 141.658),
(4, 3, 120, 0.5, 366.196),
(4, 4, 120, 0.5, 291.543),
(4, 5, 100, 0.4, 328.974),
(4, 6, 75, 1, 121.005),
(4, 7, 75, 1, 68.279),
(4, 8, 50, 1, 306.952),
(4, 9, 50, 1, 221.743),
(4, 10, 50, 1, 225.987),
(4, 11, 50, 1, 284.052),
(4, 12, 10, 0.2, 201.886),
(4, 13, 10, 0.2, 69.966),
(4, 14, 10, 0.2, 206.453),
(4, 15, 10, 0.2, 122.002),
(4, 16, 10, 0.2, 248.777),
(5, 0, 250, 0.25, 352.303),
(5, 1, 250, 0.25, 257.053),
(5, 2, 250, 0.25, 299.437),
(5, 3, 120, 0.5, 263.559),
(5, 4, 120, 0.5, 211.045),
(5, 5, 120, 0.5, 372.284),
(5, 6, 120, 0.5, 235.429),
(5, 7, 100, 0.4, 146.426),
(5, 8, 75, 1, 188.018),
(5, 9, 75, 1, 265.784),
(5, 10, 50, 1, 159),
(5, 11, 50, 1, 264.445),
(5, 12, 50, 1, 126.01),
(5, 13, 50, 1, 273.182),
(5, 14, 10, 0.2, 242.004),
(5, 15, 10, 0.2, 222.721),
(5, 16, 10, 0.2, 175.321),
(5, 17, 10, 0.2, 65.132),
(5, 18, 10, 0.2, 234.321),
(6, 0, 250, 0.25, 224.39),
(6, 1, 250, 0.25, 330.465),
(6, 2, 250, 0.25, 246.077),
(6, 3, 120, 0.5, 274.502),
(6, 4, 120, 0.5, 346.213),
(6, 5, 120, 0.5, 202.926),
(6, 6, 120, 0.5, 307.417),
(6, 7, 100, 0.4, 223.338),
(6, 8, 75, 1, 97.46),
(6, 9, 75, 1, 172.812),
(6, 10, 50, 1, 247.138),
(6, 11, 50, 1, 231.621),
(6, 12, 50, 1, 185.773),
(6, 13, 50, 1, 244.488),
(6, 14, 10, 0.2, 53.4),
(6, 15, 10, 0.2, 132.064),
(6, 16, 10, 0.2, 244.299),
(6, 17, 10, 0.2, 144.238),
(6, 18, 10, 0.2, 140.629),
(6, 19, 10, 0.2, 174.018),
(7, 0, 250, 0.25, 319.082),
(7, 1, 250, 0.25, 264.834),
(7, 2, 250, 0.25, 249.33),
(7, 3, 120, 0.5, 332.642),
(7, 4, 120, 0.5, 187.049),
(7, 5, 120, 0.5, 147.705),
(7, 6, 120, 0.5, 348.655),
(7, 7, 100, 0.4, 320.974),
(7, 8, 75, 1, 270.133),
(7, 9, 75, 1, 318.465),
(7, 10, 75, 1, 268.244),
(7, 11, 50, 1, 271.218),
(7, 12, 50, 1, 228.923),
(7, 13, 50, 1, 101.654),
(7, 14, 50, 1, 205.189),
(7, 15, 10, 0.2, 230.206),
(7, 16, 10, 0.2, 144.74),
(7, 17, 10, 0.2, 214.497),
(7, 18, 10, 0.2, 145.216),
(7, 19, 10, 0.2, 130.093),
(7, 20, 10, 0.2, 108.128),
(7, 21, 10, 0.2, 91.434),
(8, 0, 250, 0.25, 293.962),
(8, 1, 250, 0.25, 266.34),
(8, 2, 250, 0.25, 236.15),
(8, 3, 250, 0.25, 272.883),
(8, 4, 120, 0.5, 281.477),
(8, 5, 120, 0.5, 220.917),
(8, 6, 120, 0.5, 254.403),
(8, 7, 120, 0.5, 158.325),
(8, 8, 100, 0.4, 255.927),
(8, 9, 100, 0.4, 322.279),
(8, 10, 75, 1, 208.029),
(8, 11, 75, 1, 216.426),
(8, 12, 75, 1, 148.711),
(8, 13, 50, 1, 266.153),
(8, 14, 50, 1, 334.02),
(8, 15, 50, 1, 190.467),
(8, 16, 50, 1, 297.545),
(8, 17, 10, 0.2, 205.531),
(8, 18, 10, 0.2, 84.146),
(8, 19, 10, 0.2, 240.199),
(8, 20, 10, 0.2, 79.088),
(8, 21, 10, 0.2, 126.528),
(8, 22, 10, 0.2, 75.841),
(8, 23, 10, 0.2, 88.611),
(9, 0, 250, 0.25, 321.904),
(9, 1, 250, 0.25, 293.329),
(9, 2, 250, 0.25, 339.469),
(9, 3, 250, 0.25, 215.028),
(9, 4, 120, 0.5, 278.316),
(9, 5, 120, 0.5, 277.969),
(9, 6, 120, 0.5, 154.706),
(9, 7, 120, 0.5, 322.624),
(9, 8, 120, 0.5, 180.895),
(9, 9, 100, 0.4, 337.536),
(9, 10, 100, 0.4, 106.803),
(9, 11, 75, 1, 166.878),
(9, 12, 75, 1, 229.646),
(9, 13, 75, 1, 304.352),
(9, 14, 50, 1, 68.047),
(9, 15, 50, 1, 150.823),
(9, 16, 50, 1, 163.865),
(9, 17, 50, 1, 209.56),
(9, 18, 10, 0.2, 107.66),
(9, 19, 10, 0.2, 153.843),
(9, 20, 10, 0.2, 201.546),
(9, 21, 10, 0.2, 64.91),
(9, 22, 10, 0.2, 259.769),
(9, 23, 10, 0.2, 105.433),
(9, 24, 10, 0.2, 61.739),
(9, 25, 10, 0.2, 220.114),
(10, 0, 250, 0.25, 296.764),
(10, 1, 250, 0.25, 316.063),
(10, 2, 250, 0.25, 368.545),
(10, 3, 250, 0.25, 311.965),
(10, 4, 120, 0.5, 275.119),
(10, 5, 120, 0.5, 278.584),
(10, 6, 120, 0.5, 203.917),
(10, 7, 120, 0.5, 178.373),
(10, 8, 120, 0.5, 194.39),
(10, 9, 100, 0.4, 157.396),
(10, 10, 100, 0.4, 307.001),
(10, 11, 75, 1, 288.506),
(10, 12, 75, 1, 324.751),
(10, 13, 75, 1, 239.971),
(10, 14, 50, 1, 78.207),
(10, 15, 50, 1, 92.211),
(10, 16, 50, 1, 335.628),
(10, 17, 50, 1, 130.391),
(10, 18, 10, 0.2, 265.123),
(10, 19, 10, 0.2, 274.338),
(10, 20, 10, 0.2, 162.222),
(10, 21, 10, 0.2, 161.118),
(10, 22, 10, 0.2, 124.949),
(10, 23, 10, 0.2, 77.071),
(10, 24, 10, 0.2, 115.899),
(10, 25, 10, 0.2, 243.184),
(10, 26, 10, 0.2, 168.458),
(11, 0, 250, 0.25, 351.427),
(11, 1, 250, 0.25, 303.226),
(11, 2, 250, 0.25, 247.568),
(11, 3, 250, 0.25, 248.554),
(11, 4, 250, 0.25, 238.954),
(11, 5, 120, 0.5, 339.75),
(11, 6, 120, 0.5, 241.962),
(11, 7, 120, 0.5, 210.029),
(11, 8, 120, 0.5, 272.936),
(11, 9, 120, 0.5, 204.301),
(11, 10, 100, 0.4, 270.431),
(11, 11, 100, 0.4, 122.854),
(11, 12, 75, 1, 292.65),
(11, 13, 75, 1, 108.919),
(11, 14, 75, 1, 236.974),
(11, 15, 50, 1, 95.055),
(11, 16, 50, 1, 241.268),
(11, 17, 50, 1, 334.071),
(11, 18, 50, 1, 327.7),
(11, 19, 10, 0.2, 224.92),
(11, 20, 10, 0.2, 149.934),
(11, 21, 10, 0.2, 73.517),
(11, 22, 10, 0.2, 251.534),
(11, 23, 10, 0.2, 239.332),
(11, 24, 10, 0.2, 287.656),
(11, 25, 10, 0.2, 46.077),
(11, 26, 10, 0.2, 286.802),
(11, 27, 10, 0.2, 281.802),
(12, 0, 250, 0.25, 344.204),
(12, 1, 250, 0.25, 312.341),
(12, 2, 250, 0.25, 262.962),
(12, 3, 250, 0.25, 255.393),
(12, 4, 250, 0.25, 279.606),
(12, 5, 120, 0.5, 286.084),
(12, 6, 120, 0.5, 194.72),
(12, 7, 120, 0.5, 285.472),
(12, 8, 120, 0.5, 256.864),
(12, 9, 120, 0.5, 265.823),
(12, 10, 100, 0.4, 149.058),
(12, 11, 100, 0.4, 223.207),
(12, 12, 75, 1, 211.662),
(12, 13, 75, 1, 260.924),
(12, 14, 75, 1, 54.406),
(12, 15, 50, 1, 298.527),
(12, 16, 50, 1, 102.969),
(12, 17, 50, 1, 215.331),
(12, 18, 50, 1, 225.2),
(12, 19, 10, 0.2, 252.006),
(12, 20, 10, 0.2, 113.011),
(12, 21, 10, 0.2, 273.885),
(12, 22, 10, 0.2, 152.522),
(12, 23, 10, 0.2, 119.101),
(12, 24, 10, 0.2, 207.416),
(12, 25, 10, 0.2, 172.212),
(12, 26, 10, 0.2, 63.889),
(12, 27, 10, 0.2, 203.242),
(12, 28, 10, 0.2, 125.063),
(13, 0, 250, 0.25, 247.157),
(13, 1, 250, 0.25, 254.234),
(13, 2, 250, 0.25, 366.986),
(13, 3, 250, 0.25, 343.859),
(13, 4, 250, 0.25, 282.665),
(13, 5, 120, 0.5, 278.005),
(13, 6, 120, 0.5, 224.341),
(13, 7, 120, 0.5, 238.385),
(13, 8, 120, 0.5, 330.97),
(13, 9, 120, 0.5, 228.358),
(13, 10, 120, 0.5, 310.186),
(13, 11, 100, 0.4, 216.681),
(13, 12, 100, 0.4, 177.657),
(13, 13, 75, 1, 378.999),
(13, 14, 75, 1, 258.447),
(13, 15, 75, 1, 51.344),
(13, 16, 50, 1, 59.27),
(13, 17, 50, 1, 296.294),
(13, 18, 50, 1, 288.896),
(13, 19, 50, 1, 194.789),
(13, 20, 10, 0.2, 107.449),
(13, 21, 10, 0.2, 152.928),
(13, 22, 10, 0.2, 211.963),
(13, 23, 10, 0.2, 60.907),
(13, 24, 10, 0.2, 220.769),
(13, 25, 10, 0.2, 146.554),
(13, 26, 10, 0.2, 139.765),
(13, 27, 10, 0.2, 182.226),
(13, 28, 10, 0.2, 227.621),
(13, 29, 10, 0.2, 213.115),
(13, 30, 10, 0.2, 81.585),
(14, 0, 250, 0.25, 340.64),
(14, 1, 250, 0.25, 253.827),
(14, 2, 250, 0.25, 255.332),
(14, 3, 250, 0.25, 315.41),
(14, 4, 250, 0.25, 367.999),
(14, 5, 250, 0.25, 259.013),
(14, 6, 120, 0.5, 323.038),
(14, 7, 120, 0.5, 178.267),
(14, 8, 120, 0.5, 202.444),
(14, 9, 120, 0.5, 240.644),
(14, 10, 120, 0.5, 331.716),
(14, 11, 120, 0.5, 319.582),
(14, 12, 100, 0.4, 280.989),
(14, 13, 100, 0.4, 362.785),
(14, 14, 75, 1, 341.224),
(14, 15, 75, 1, 317.733),
(14, 16, 75, 1, 94.834),
(14, 17, 75, 1, 245.236),
(14, 18, 50, 1, 90.883),
(14, 19, 50, 1, 337.692),
(14, 20, 50, 1, 343.315),
(14, 21, 50, 1, 277.554),
(14, 22, 10, 0.2, 97.38),
(14, 23, 10, 0.2, 274.023),
(14, 24, 10, 0.2, 138.556),
(14, 25, 10, 0.2, 235.001),
(14, 26, 10, 0.2, 143.455),
(14, 27, 10, 0.2, 97.415),
(14, 28, 10, 0.2, 252.729),
(14, 29, 10, 0.2, 194.513),
(14, 30, 10, 0.2, 199.488),
(14, 31, 10, 0.2, 140.69),
(14, 32, 10, 0.2, 122.456),
(15, 0, 250, 0.25, 267.295),
(15, 1, 250, 0.25, 264.802),
(15, 2, 250, 0.25, 238.415),
(15, 3, 250, 0.25, 303.355),
(15, 4, 250, 0.25, 368.041),
(15, 5, 250, 0.25, 252.758),
(15, 6, 120, 0.5, 276.178),
(15, 7, 120, 0.5, 342.028),
(15, 8, 120, 0.5, 262.001),
(15, 9, 120, 0.5, 308.441),
(15, 10, 120, 0.5, 227.146),
(15, 11, 120, 0.5, 211.961),
(15, 12, 100, 0.4, 343.704),
(15, 13, 100, 0.4, 191.73),
(15, 14, 75, 1, 202.816),
(15, 15, 75, 1, 172.365),
(15, 16, 75, 1, 284.11),
(15, 17, 75, 1, 243.367),
(15, 18, 50, 1, 138.648),
(15, 19, 50, 1, 282.989),
(15, 20, 50, 1, 100.254),
(15, 21, 50, 1, 170.019),
(15, 22, 10, 0.2, 238.628),
(15, 23, 10, 0.2, 292.294),
(15, 24, 10, 0.2, 93.185),
(15, 25, 10, 0.2, 269.367),
(15, 26, 10, 0.2, 50.74),
(15, 27, 10, 0.2, 204.591),
(15, 28, 10, 0.2, 95.647),
(15, 29, 10, 0.2, 244.234),
(15, 30, 10, 0.2, 265.6),
(15, 31, 10, 0.2, 199.954),
(15, 32, 10, 0.2, 135.929),
(15, 33, 10, 0.2, 245.954),
(16, 0, 250, 0.25, 300.8),
(16, 1, 250, 0.25, 302.592),
(16, 2, 250, 0.25, 333.887),
(16, 3, 250, 0.25, 254.967),
(16, 4, 250, 0.25, 244.769),
(16, 5, 250, 0.25, 306.364),
(16, 6, 120, 0.5, 217.944),
(16, 7, 120, 0.5, 255.523),
(16, 8, 120, 0.5, 210.248),
(16, 9, 120, 0.5, 323.121),
(16, 10, 120, 0.5, 263.465),
(16, 11, 120, 0.5, 177.553),
(16, 12, 100, 0.4, 178.495),
(16, 13, 100, 0.4, 179.652),
(16, 14, 100, 0.4, 325.065),
(16, 15, 75, 1, 243.423),
(16, 16, 75, 1, 84.013),
(16, 17, 75, 1, 260.915),
(16, 18, 75, 1, 246.628),
(16, 19, 50, 1, 295.515),
(16, 20, 50, 1, 316.527),
(16, 21, 50, 1, 308.034),
(16, 22, 50, 1, 350.723),
(16, 23, 10, 0.2, 123.815),
(16, 24, 10, 0.2, 250.695),
(16, 25, 10, 0.2, 214.272),
(16, 26, 10, 0.2, 241.803),
(16, 27, 10, 0.2, 46.713),
(16, 28, 10, 0.2, 209.259),
(16, 29, 10, 0.2, 88.172),
(16, 30, 10, 0.2, 60.405),
(16, 31, 10, 0.2, 43.625),
(16, 32, 10, 0.2, 286.794),
(16, 33, 10, 0.2, 154.816),
(16, 34, 10, 0.2, 186.359),
(16, 35, 10, 0.2, 160.807),
(17, 0, 250, 0.25, 260.324),
(17, 1, 250, 0.25, 343.879),
(17, 2, 250, 0.25, 304.432),
(17, 3, 250, 0.25, 255.123),
(17, 4, 250, 0.25, 326.697),
(17, 5, 250, 0.25, 259.256),
(17, 6, 250, 0.25, 307.895),
(17, 7, 120, 0.5, 262.812),
(17, 8, 120, 0.5, 301.935),
(17, 9, 120, 0.5, 374.068),
(17, 10, 120, 0.5, 220.804),
(17, 11, 120, 0.5, 279.883),
(17, 12, 120, 0.5, 348.596),
(17, 13, 120, 0.5, 362.503),
(17, 14, 100, 0.4, 121.64),
(17, 15, 100, 0.4, 283.932),
(17, 16, 100, 0.4, 243.48),
(17, 17, 75, 1, 283.242),
(17, 18, 75, 1, 213.591),
(17, 19, 75, 1, 206.324),
(17, 20, 75, 1, 116.114),
(17, 21, 50, 1, 161.771),
(17, 22, 50, 1, 281.054),
(17, 23, 50, 1, 258.119),
(17, 24, 50, 1, 245.77),
(17, 25, 10, 0.2, 174.103),
(17, 26, 10, 0.2, 127.821),
(17, 27, 10, 0.2, 183.602),
(17, 28, 10, 0.2, 316.802),
(17, 29, 10, 0.2, 229.745),
(17, 30, 10, 0.2, 294.928),
(17, 31, 10, 0.2, 64.816),
(17, 32, 10, 0.2, 134.19),
(17, 33, 10, 0.2, 241.217),
(17, 34, 10, 0.2, 162.583),
(17, 35, 10, 0.2, 143.813),
(17, 36, 10, 0.2, 154.462),
(17, 37, 10, 0.2, 143.4),
(18, 0, 250, 0.25, 260.218),
(18, 1, 250, 0.25, 324.756),
(18, 2, 250, 0.25, 254.336),
(18, 3, 250, 0.25, 326.164),
(18, 4, 250, 0.25, 261.789),
(18, 5, 250, 0.25, 271.005),
(18, 6, 250, 0.25, 301.064),
(18, 7, 120, 0.5, 249.144),
(18, 8, 120, 0.5, 331.32),
(18, 9, 120, 0.5, 228.446),
(18, 10, 120, 0.5, 195.094),
(18, 11, 120, 0.5, 284.109),
(18, 12, 120, 0.5, 294.095),
(18, 13, 120, 0.5, 230.482),
(18, 14, 100, 0.4, 166.997),
(18, 15, 100, 0.4, 265.074),
(18, 16, 100, 0.4, 293.651),
(18, 17, 75, 1, 189.276),
(18, 18, 75, 1, 243.2),
(18, 19, 75, 1, 263.055),
(18, 20, 75, 1, 213.405),
(18, 21, 50, 1, 99.596),
(18, 22, 50, 1, 134.494),
(18, 23, 50, 1, 215.167),
(18, 24, 50, 1, 98.543),
(18, 25, 10, 0.2, 221.692),
(18, 26, 10, 0.2, 198.007),
(18, 27, 10, 0.2, 97.605),
(18, 28, 10, 0.2, 289.132),
(18, 29, 10, 0.2, 161.757),
(18, 30, 10, 0.2, 54.592),
(18, 31, 10, 0.2, 179.332),
(18, 32, 10, 0.2, 177.983),
(18, 33, 10, 0.2, 70.753),
(18, 34, 10, 0.2, 62.251),
(18, 35, 10, 0.2, 146.057),
(18, 36, 10, 0.2, 264.466),
(18, 37, 10, 0.2, 210.305),
(18, 38, 10, 0.2, 57.904),
(19, 0, 250, 0.25, 292.436),
(19, 1, 250, 0.25, 339.453),
(19, 2, 250, 0.25, 319.165),
(19, 3, 250, 0.25, 282.665),
(19, 4, 250, 0.25, 271.369),
(19, 5, 250, 0.25, 319.143),
(19, 6, 250, 0.25, 271.48),
(19, 7, 120, 0.5, 355.297),
(19, 8, 120, 0.5, 352.106),
(19, 9, 120, 0.5, 243.965),
(19, 10, 120, 0.5, 251.23),
(19, 11, 120, 0.5, 287.629),
(19, 12, 120, 0.5, 257.351),
(19, 13, 120, 0.5, 206.534),
(19, 14, 100, 0.4, 141.002),
(19, 15, 100, 0.4, 222.196),
(19, 16, 100, 0.4, 180.981),
(19, 17, 75, 1, 219.648),
(19, 18, 75, 1, 236.237),
(19, 19, 75, 1, 302.353),
(19, 20, 75, 1, 158.082),
(19, 21, 50, 1, 191.185),
(19, 22, 50, 1, 99.145),
(19, 23, 50, 1, 107.003),
(19, 24, 50, 1, 145.188),
(19, 25, 10, 0.2, 184.145),
(19, 26, 10, 0.2, 121.23),
(19, 27, 10, 0.2, 90.525),
(19, 28, 10, 0.2, 169.262),
(19, 29, 10, 0.2, 108.172),
(19, 30, 10, 0.2, 320.22),
(19, 31, 10, 0.2, 240),
(19, 32, 10, 0.2, 222.716),
(19, 33, 10, 0.2, 215.095),
(19, 34, 10, 0.2, 99.496),
(19, 35, 10, 0.2, 178.058),
(19, 36, 10, 0.2, 141.355),
(19, 37, 10, 0.2, 143.089),
(19, 38, 10, 0.2, 51.017),
(19, 39, 10, 0.2, 77.089),
(20, 0, 250, 0.25, 277.355),
(20, 1, 250, 0.25, 293.848),
(20, 2, 250, 0.25, 358.626),
(20, 3, 250, 0.25, 295.656),
(20, 4, 250, 0.25, 271.855),
(20, 5, 250, 0.25, 368.001),
(20, 6, 250, 0.25, 317.331),
(20, 7, 250, 0.25, 323.153),
(20, 8, 120, 0.5, 320.157),
(20, 9, 120, 0.5, 367.215),
(20, 10, 120, 0.5, 361.445),
(20, 11, 120, 0.5, 270.929),
(20, 12, 120, 0.5, 217.13),
(20, 13, 120, 0.5, 236.481),
(20, 14, 120, 0.5, 202.65),
(20, 15, 100, 0.4, 293.112),
(20, 16, 100, 0.4, 326.77),
(20, 17, 100, 0.4, 135.159),
(20, 18, 75, 1, 90.053),
(20, 19, 75, 1, 159.819),
(20, 20, 75, 1, 321.573),
(20, 21, 75, 1, 379.882),
(20, 22, 50, 1, 302.366),
(20, 23, 50, 1, 244.585),
(20, 24, 50, 1, 84.209),
(20, 25, 50, 1, 336.126),
(20, 26, 10, 0.2, 45.706),
(20, 27, 10, 0.2, 94.613),
(20, 28, 10, 0.2, 110.046),
(20, 29, 10, 0.2, 67.049),
(20, 30, 10, 0.2, 106),
(20, 31, 10, 0.2, 221.344),
(20, 32, 10, 0.2, 80.013),
(20, 33, 10, 0.2, 190.031),
(20, 34, 10, 0.2, 61.02),
(20, 35, 10, 0.2, 153.205),
(20, 36, 10, 0.2, 191.436),
(20, 37, 10, 0.2, 107.557),
(20, 38, 10, 0.2, 177.759),
(20, 39, 10, 0.2, 213.463),
(20, 40, 10, 0.2, 159.497);
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
     or (p_run ->> 'version') is distinct from '4' or jsonb_typeof(p_run -> 'levels') is distinct from 'array' then
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

    money := money + earned;
    total := total + earned;
    -- what was bought for this level is used up (unused dynamite is lost); the shop buys for the next one
    s_str := 0; s_reel := 0; s_dyn := 0; s_clock := 0;
    ms_total := ms_total + v_seconds;
    won := earned >= v_target;
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
        when 'clock' then case when s_clock < 1 then 160 end
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
