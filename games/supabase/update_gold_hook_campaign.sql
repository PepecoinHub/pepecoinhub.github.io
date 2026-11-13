-- Pepe Gold Hook campaign: 20 levels, a shop between them, one score per run, stats on the player's
-- account. Run after update_gold_hook.sql. Safe to run again. NOT YET RUN on the live project.
--
-- One call per finished run (game over or after level 20), only when the player presses "Submit score":
--   public.gry_goldhook_submit_run(p_nick, p_run)
-- p_run = {"gameId":"goldhook","version":3,"levels":[{"level":1,"catches":[{"id":5,"t":4.07}],
--          "seconds":60,"dynamite":0,"bought":["strength"]}, ...]}
-- The server replays the whole run: every catch against the fastest possible hook cycle for the
-- upgrades owned at that moment, every purchase against the money earned so far, dynamite against the
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
(1, 60, 1, 650),
(2, 58, 0.983, 680),
(3, 56, 0.965, 710),
(4, 54, 0.948, 760),
(5, 52, 0.93, 800),
(6, 50, 0.913, 850),
(7, 48, 0.895, 900),
(8, 46, 0.878, 950),
(9, 44, 0.86, 1000),
(10, 42, 0.843, 1040),
(11, 40, 0.825, 1080),
(12, 40, 0.808, 1100),
(13, 40, 0.79, 1110),
(14, 40, 0.773, 1120),
(15, 40, 0.755, 1130),
(16, 40, 0.738, 1140),
(17, 40, 0.72, 1140),
(18, 40, 0.702, 1140),
(19, 40, 0.7, 1140),
(20, 40, 0.7, 1140);
insert into games.goldhook_objects (level, id, points, speed_mul, travel) values
(1, 0, 50, 1, 90.803),
(1, 1, 50, 1, 51.353),
(1, 2, 50, 1, 141.302),
(1, 3, 120, 0.5, 116.847),
(1, 4, 120, 0.5, 166.956),
(1, 5, 250, 0.25, 144.841),
(1, 6, 75, 1, 160.544),
(1, 7, 75, 1, 81.47),
(1, 8, 10, 0.2, 56.854),
(1, 9, 10, 0.2, 107),
(1, 10, 100, 0.4, 173.941),
(2, 0, 250, 0.25, 125.563),
(2, 1, 120, 0.5, 147.679),
(2, 2, 120, 0.5, 119.877),
(2, 3, 100, 0.4, 124.766),
(2, 4, 75, 1, 45.35),
(2, 5, 75, 1, 66.872),
(2, 6, 50, 1, 76.506),
(2, 7, 50, 1, 87.659),
(2, 8, 50, 1, 88.597),
(2, 9, 10, 0.2, 95.268),
(2, 10, 10, 0.2, 150.908),
(3, 0, 250, 0.25, 108.932),
(3, 1, 120, 0.5, 141.004),
(3, 2, 120, 0.5, 74.992),
(3, 3, 100, 0.4, 153.968),
(3, 4, 75, 1, 38.744),
(3, 5, 75, 1, 78.767),
(3, 6, 50, 1, 84.558),
(3, 7, 50, 1, 132.436),
(3, 8, 50, 1, 96.08),
(3, 9, 10, 0.2, 79.667),
(3, 10, 10, 0.2, 120.024),
(3, 11, 10, 0.2, 31.021),
(4, 0, 250, 0.25, 190.946),
(4, 1, 250, 0.25, 149.92),
(4, 2, 120, 0.5, 78.523),
(4, 3, 120, 0.5, 195.853),
(4, 4, 100, 0.4, 150.004),
(4, 5, 75, 1, 182.478),
(4, 6, 75, 1, 164.45),
(4, 7, 50, 1, 69.14),
(4, 8, 50, 1, 44.097),
(4, 9, 50, 1, 164.486),
(4, 10, 10, 0.2, 107.425),
(4, 11, 10, 0.2, 108.723),
(4, 12, 10, 0.2, 135.436),
(5, 0, 250, 0.25, 192.773),
(5, 1, 250, 0.25, 143.506),
(5, 2, 120, 0.5, 150.037),
(5, 3, 120, 0.5, 143.021),
(5, 4, 100, 0.4, 105.968),
(5, 5, 75, 1, 202.451),
(5, 6, 75, 1, 108.323),
(5, 7, 50, 1, 57.249),
(5, 8, 50, 1, 60.854),
(5, 9, 50, 1, 136.816),
(5, 10, 10, 0.2, 77),
(5, 11, 10, 0.2, 155.979),
(5, 12, 10, 0.2, 131.126),
(5, 13, 10, 0.2, 129.961),
(6, 0, 250, 0.25, 126.939),
(6, 1, 250, 0.25, 181.644),
(6, 2, 120, 0.5, 112.65),
(6, 3, 120, 0.5, 148.702),
(6, 4, 120, 0.5, 185.652),
(6, 5, 100, 0.4, 100.388),
(6, 6, 75, 1, 185.393),
(6, 7, 75, 1, 114.184),
(6, 8, 50, 1, 152.009),
(6, 9, 50, 1, 74.454),
(6, 10, 50, 1, 126.388),
(6, 11, 10, 0.2, 90.473),
(6, 12, 10, 0.2, 152.837),
(6, 13, 10, 0.2, 35.152),
(6, 14, 10, 0.2, 74.437),
(7, 0, 250, 0.25, 175.904),
(7, 1, 250, 0.25, 148.449),
(7, 2, 250, 0.25, 140.202),
(7, 3, 120, 0.5, 84.851),
(7, 4, 120, 0.5, 178.629),
(7, 5, 120, 0.5, 121.664),
(7, 6, 100, 0.4, 68.647),
(7, 7, 75, 1, 185.773),
(7, 8, 75, 1, 83.635),
(7, 9, 50, 1, 138.585),
(7, 10, 50, 1, 138.625),
(7, 11, 50, 1, 146.411),
(7, 12, 10, 0.2, 110.643),
(7, 13, 10, 0.2, 50.529),
(7, 14, 10, 0.2, 99.111),
(7, 15, 10, 0.2, 62.642),
(7, 16, 10, 0.2, 54.098),
(8, 0, 250, 0.25, 163.42),
(8, 1, 250, 0.25, 149.494),
(8, 2, 250, 0.25, 133.364),
(8, 3, 120, 0.5, 122.52),
(8, 4, 120, 0.5, 82.619),
(8, 5, 120, 0.5, 121.067),
(8, 6, 100, 0.4, 72.592),
(8, 7, 75, 1, 135.833),
(8, 8, 75, 1, 177.932),
(8, 9, 50, 1, 119.518),
(8, 10, 50, 1, 110.026),
(8, 11, 50, 1, 64.036),
(8, 12, 10, 0.2, 99.889),
(8, 13, 10, 0.2, 96.812),
(8, 14, 10, 0.2, 32.9),
(8, 15, 10, 0.2, 92.563),
(8, 16, 10, 0.2, 161.153),
(9, 0, 250, 0.25, 178.068),
(9, 1, 250, 0.25, 163.529),
(9, 2, 250, 0.25, 186.85),
(9, 3, 120, 0.5, 88.013),
(9, 4, 120, 0.5, 150.845),
(9, 5, 120, 0.5, 150.063),
(9, 6, 100, 0.4, 80.372),
(9, 7, 75, 1, 42.237),
(9, 8, 75, 1, 36.462),
(9, 9, 50, 1, 82.421),
(9, 10, 50, 1, 155.084),
(9, 11, 50, 1, 118.89),
(9, 12, 10, 0.2, 49.8),
(9, 13, 10, 0.2, 48.892),
(9, 14, 10, 0.2, 52),
(9, 15, 10, 0.2, 157.165),
(9, 16, 10, 0.2, 126.62),
(9, 17, 10, 0.2, 37.179),
(10, 0, 250, 0.25, 165.535),
(10, 1, 250, 0.25, 174.826),
(10, 2, 250, 0.25, 201.83),
(10, 3, 250, 0.25, 141.69),
(10, 4, 120, 0.5, 98.969),
(10, 5, 120, 0.5, 107.985),
(10, 6, 120, 0.5, 160.573),
(10, 7, 100, 0.4, 90.668),
(10, 8, 75, 1, 169.002),
(10, 9, 75, 1, 91.332),
(10, 10, 75, 1, 177.239),
(10, 11, 50, 1, 125.024),
(10, 12, 50, 1, 49.931),
(10, 13, 50, 1, 56.87),
(10, 14, 10, 0.2, 64.577),
(10, 15, 10, 0.2, 141.088),
(10, 16, 10, 0.2, 145.542),
(10, 17, 10, 0.2, 89.751),
(10, 18, 10, 0.2, 71.35),
(10, 19, 10, 0.2, 92.241),
(11, 0, 250, 0.25, 193.21),
(11, 1, 250, 0.25, 168.767),
(11, 2, 250, 0.25, 140.401),
(11, 3, 250, 0.25, 140.717),
(11, 4, 120, 0.5, 103.192),
(11, 5, 120, 0.5, 132.473),
(11, 6, 120, 0.5, 116.011),
(11, 7, 120, 0.5, 148.482),
(11, 8, 100, 0.4, 93.113),
(11, 9, 75, 1, 78.295),
(11, 10, 75, 1, 47.775),
(11, 11, 75, 1, 38.349),
(11, 12, 50, 1, 119.44),
(11, 13, 50, 1, 85.585),
(11, 14, 50, 1, 188.951),
(11, 15, 10, 0.2, 52.52),
(11, 16, 10, 0.2, 109.261),
(11, 17, 10, 0.2, 47.765),
(11, 18, 10, 0.2, 159.75),
(11, 19, 10, 0.2, 79.411),
(11, 20, 10, 0.2, 74.058),
(11, 21, 10, 0.2, 45.245),
(12, 0, 250, 0.25, 189.942),
(12, 1, 250, 0.25, 173.889),
(12, 2, 250, 0.25, 148.835),
(12, 3, 250, 0.25, 144.282),
(12, 4, 120, 0.5, 90.834),
(12, 5, 120, 0.5, 131.879),
(12, 6, 120, 0.5, 154.958),
(12, 7, 120, 0.5, 107.906),
(12, 8, 100, 0.4, 123.38),
(12, 9, 100, 0.4, 136.743),
(12, 10, 75, 1, 128.448),
(12, 11, 75, 1, 65.919),
(12, 12, 75, 1, 68.251),
(12, 13, 50, 1, 107.171),
(12, 14, 50, 1, 134.932),
(12, 15, 50, 1, 38.005),
(12, 16, 10, 0.2, 51.477),
(12, 17, 10, 0.2, 103.868),
(12, 18, 10, 0.2, 62.227),
(12, 19, 10, 0.2, 154.412),
(12, 20, 10, 0.2, 134.716),
(12, 21, 10, 0.2, 65.003),
(12, 22, 10, 0.2, 84.339),
(13, 0, 250, 0.25, 140.753),
(13, 1, 250, 0.25, 144.671),
(13, 2, 250, 0.25, 200.562),
(13, 3, 250, 0.25, 170.204),
(13, 4, 250, 0.25, 157.059),
(13, 5, 120, 0.5, 145.568),
(13, 6, 120, 0.5, 125.533),
(13, 7, 120, 0.5, 139.871),
(13, 8, 120, 0.5, 91.207),
(13, 9, 100, 0.4, 67.304),
(13, 10, 100, 0.4, 102.549),
(13, 11, 75, 1, 36.524),
(13, 12, 75, 1, 53.271),
(13, 13, 75, 1, 165.859),
(13, 14, 50, 1, 175.776),
(13, 15, 50, 1, 40.126),
(13, 16, 50, 1, 98.098),
(13, 17, 10, 0.2, 114.552),
(13, 18, 10, 0.2, 78.439),
(13, 19, 10, 0.2, 99.609),
(13, 20, 10, 0.2, 83.812),
(13, 21, 10, 0.2, 108.563),
(13, 22, 10, 0.2, 73.418),
(13, 23, 10, 0.2, 126.169),
(13, 24, 10, 0.2, 48.664),
(14, 0, 250, 0.25, 188.031),
(14, 1, 250, 0.25, 144.238),
(14, 2, 250, 0.25, 174.609),
(14, 3, 250, 0.25, 147.407),
(14, 4, 250, 0.25, 145.796),
(14, 5, 120, 0.5, 111.656),
(14, 6, 120, 0.5, 202.149),
(14, 7, 120, 0.5, 96.665),
(14, 8, 120, 0.5, 116.627),
(14, 9, 100, 0.4, 98.984),
(14, 10, 100, 0.4, 81.763),
(14, 11, 75, 1, 74.206),
(14, 12, 75, 1, 193.8),
(14, 13, 75, 1, 160.317),
(14, 14, 50, 1, 68.141),
(14, 15, 50, 1, 163.02),
(14, 16, 50, 1, 67.822),
(14, 17, 10, 0.2, 135.116),
(14, 18, 10, 0.2, 32.015),
(14, 19, 10, 0.2, 66.849),
(14, 20, 10, 0.2, 59.09),
(14, 21, 10, 0.2, 29.347),
(14, 22, 10, 0.2, 33.4),
(14, 23, 10, 0.2, 125.138),
(14, 24, 10, 0.2, 90.323),
(15, 0, 250, 0.25, 151.882),
(15, 1, 250, 0.25, 150.601),
(15, 2, 250, 0.25, 136.98),
(15, 3, 250, 0.25, 169.71),
(15, 4, 250, 0.25, 201.221),
(15, 5, 120, 0.5, 112.419),
(15, 6, 120, 0.5, 172.637),
(15, 7, 120, 0.5, 145.837),
(15, 8, 120, 0.5, 108.918),
(15, 9, 100, 0.4, 131.19),
(15, 10, 100, 0.4, 89.425),
(15, 11, 75, 1, 113.002),
(15, 12, 75, 1, 83.635),
(15, 13, 75, 1, 71.418),
(15, 14, 50, 1, 178.17),
(15, 15, 50, 1, 90.966),
(15, 16, 50, 1, 99.927),
(15, 17, 10, 0.2, 52.108),
(15, 18, 10, 0.2, 45.706),
(15, 19, 10, 0.2, 29.612),
(15, 20, 10, 0.2, 80.223),
(15, 21, 10, 0.2, 106.917),
(15, 22, 10, 0.2, 111.942),
(15, 23, 10, 0.2, 50.463),
(15, 24, 10, 0.2, 38.079),
(15, 25, 10, 0.2, 154.451),
(16, 0, 250, 0.25, 168.6),
(16, 1, 250, 0.25, 169.175),
(16, 2, 250, 0.25, 185.368),
(16, 3, 250, 0.25, 145.406),
(16, 4, 250, 0.25, 140.535),
(16, 5, 250, 0.25, 171.571),
(16, 6, 120, 0.5, 121.564),
(16, 7, 120, 0.5, 117.546),
(16, 8, 120, 0.5, 109.351),
(16, 9, 120, 0.5, 128.157),
(16, 10, 120, 0.5, 126.994),
(16, 11, 100, 0.4, 86.226),
(16, 12, 100, 0.4, 77.013),
(16, 13, 75, 1, 143.529),
(16, 14, 75, 1, 78.244),
(16, 15, 75, 1, 156.675),
(16, 16, 50, 1, 130.707),
(16, 17, 50, 1, 60.281),
(16, 18, 50, 1, 51.308),
(16, 19, 10, 0.2, 158.442),
(16, 20, 10, 0.2, 40.232),
(16, 21, 10, 0.2, 69.966),
(16, 22, 10, 0.2, 31.847),
(16, 23, 10, 0.2, 169.725),
(16, 24, 10, 0.2, 113.082),
(16, 25, 10, 0.2, 30.984),
(16, 26, 10, 0.2, 150.974),
(16, 27, 10, 0.2, 72.059),
(17, 0, 250, 0.25, 149.184),
(17, 1, 250, 0.25, 190.192),
(17, 2, 250, 0.25, 143.3),
(17, 3, 250, 0.25, 170.47),
(17, 4, 250, 0.25, 146.748),
(17, 5, 250, 0.25, 181.453),
(17, 6, 120, 0.5, 110.925),
(17, 7, 120, 0.5, 132.028),
(17, 8, 120, 0.5, 134.625),
(17, 9, 120, 0.5, 179.621),
(17, 10, 120, 0.5, 138.34),
(17, 11, 100, 0.4, 166.312),
(17, 12, 100, 0.4, 81.339),
(17, 13, 75, 1, 123.258),
(17, 14, 75, 1, 129.09),
(17, 15, 75, 1, 74.364),
(17, 16, 50, 1, 109.68),
(17, 17, 50, 1, 169.422),
(17, 18, 50, 1, 53.645),
(17, 19, 10, 0.2, 40.406),
(17, 20, 10, 0.2, 34.59),
(17, 21, 10, 0.2, 73.945),
(17, 22, 10, 0.2, 71.848),
(17, 23, 10, 0.2, 33.083),
(17, 24, 10, 0.2, 30.471),
(17, 25, 10, 0.2, 37),
(17, 26, 10, 0.2, 151.401),
(17, 27, 10, 0.2, 127.394),
(17, 28, 10, 0.2, 104.72),
(18, 0, 250, 0.25, 179.953),
(18, 1, 250, 0.25, 146.688),
(18, 2, 250, 0.25, 181.246),
(18, 3, 250, 0.25, 149.428),
(18, 4, 250, 0.25, 154.008),
(18, 5, 250, 0.25, 186.204),
(18, 6, 120, 0.5, 128.125),
(18, 7, 120, 0.5, 125.854),
(18, 8, 120, 0.5, 105.077),
(18, 9, 120, 0.5, 158.711),
(18, 10, 120, 0.5, 155.403),
(18, 11, 100, 0.4, 97.453),
(18, 12, 100, 0.4, 66.378),
(18, 13, 75, 1, 40.035),
(18, 14, 75, 1, 134.6),
(18, 15, 75, 1, 144.828),
(18, 16, 50, 1, 112.405),
(18, 17, 50, 1, 78.058),
(18, 18, 50, 1, 121.8),
(18, 19, 10, 0.2, 57.108),
(18, 20, 10, 0.2, 97.704),
(18, 21, 10, 0.2, 44.28),
(18, 22, 10, 0.2, 39.449),
(18, 23, 10, 0.2, 81.402),
(18, 24, 10, 0.2, 37.657),
(18, 25, 10, 0.2, 72.83),
(18, 26, 10, 0.2, 112),
(18, 27, 10, 0.2, 160.635),
(18, 28, 10, 0.2, 71.629),
(19, 0, 250, 0.25, 165.031),
(19, 1, 250, 0.25, 187.73),
(19, 2, 250, 0.25, 177.426),
(19, 3, 250, 0.25, 160.841),
(19, 4, 250, 0.25, 155.568),
(19, 5, 250, 0.25, 154.722),
(19, 6, 250, 0.25, 171.074),
(19, 7, 120, 0.5, 134.84),
(19, 8, 120, 0.5, 142.197),
(19, 9, 120, 0.5, 125.915),
(19, 10, 120, 0.5, 133.657),
(19, 11, 120, 0.5, 131.609),
(19, 12, 100, 0.4, 79.499),
(19, 13, 100, 0.4, 83),
(19, 14, 75, 1, 113.455),
(19, 15, 75, 1, 118.673),
(19, 16, 75, 1, 71),
(19, 17, 50, 1, 101.181),
(19, 18, 50, 1, 120.354),
(19, 19, 50, 1, 79.061),
(19, 20, 10, 0.2, 32.801),
(19, 21, 10, 0.2, 128.942),
(19, 22, 10, 0.2, 94.165),
(19, 23, 10, 0.2, 137.8),
(19, 24, 10, 0.2, 29.195),
(19, 25, 10, 0.2, 35.081),
(19, 26, 10, 0.2, 74.178),
(19, 27, 10, 0.2, 106.838),
(19, 28, 10, 0.2, 100.6),
(19, 29, 10, 0.2, 93.236),
(19, 30, 10, 0.2, 37.801),
(20, 0, 250, 0.25, 158.319),
(20, 1, 250, 0.25, 166.444),
(20, 2, 250, 0.25, 197.419),
(20, 3, 250, 0.25, 201.709),
(20, 4, 250, 0.25, 196.443),
(20, 5, 250, 0.25, 154.848),
(20, 6, 250, 0.25, 197.675),
(20, 7, 120, 0.5, 126.718),
(20, 8, 120, 0.5, 118.135),
(20, 9, 120, 0.5, 117.834),
(20, 10, 120, 0.5, 155.819),
(20, 11, 120, 0.5, 112.285),
(20, 12, 100, 0.4, 91.098),
(20, 13, 100, 0.4, 168.65),
(20, 14, 75, 1, 142.188),
(20, 15, 75, 1, 69.405),
(20, 16, 75, 1, 94.209),
(20, 17, 75, 1, 70.189),
(20, 18, 50, 1, 51.819),
(20, 19, 50, 1, 134.103),
(20, 20, 50, 1, 58.834),
(20, 21, 10, 0.2, 82.499),
(20, 22, 10, 0.2, 38.548),
(20, 23, 10, 0.2, 97.605),
(20, 24, 10, 0.2, 87.096),
(20, 25, 10, 0.2, 115.756),
(20, 26, 10, 0.2, 76.785),
(20, 27, 10, 0.2, 125.732),
(20, 28, 10, 0.2, 60.405),
(20, 29, 10, 0.2, 38.355),
(20, 30, 10, 0.2, 144.511),
(20, 31, 10, 0.2, 147.924);
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
     or (p_run ->> 'version') is distinct from '3' or jsonb_typeof(p_run -> 'levels') is distinct from 'array' then
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
    ext := 220 * (1 + 0.15 * s_reel);
    loaded := 170 * (1 + 0.20 * s_str);
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
    s_dyn := s_dyn - v_dyn;
    s_clock := 0;
    ms_total := ms_total + v_seconds;
    won := earned >= v_target;
    if not won or i = 20 then
      if i <> n_levels or jsonb_array_length(lv -> 'bought') > 0 then raise exception '%', bad; end if;
      v_finished := won;
      exit;
    end if;
    if i = n_levels then raise exception 'Finish the run first'; end if;

    -- the shop after this level: prices as in docs/games/js/gold-hook-campaign.mjs
    for it in select e.value from jsonb_array_elements(lv -> 'bought') with ordinality as e(value, idx) order by e.idx loop
      if jsonb_typeof(it) is distinct from 'string' then raise exception '%', bad; end if;
      item := it #>> '{}';
      price := case item
        when 'strength' then case s_str when 0 then 400 when 1 then 900 when 2 then 1600 end
        when 'reel' then case s_reel when 0 then 350 when 1 then 800 end
        when 'dynamite' then case when s_dyn < 3 then 150 end
        when 'clock' then case when s_clock < 1 then 250 end
      end;
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
