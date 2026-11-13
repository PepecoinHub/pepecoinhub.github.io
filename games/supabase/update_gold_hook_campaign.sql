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
-- position and blast radius (powder barrels, art pack P4); added later, so also for an existing table
alter table games.goldhook_objects add column if not exists x numeric not null default 0;
alter table games.goldhook_objects add column if not exists y numeric not null default 0;
alter table games.goldhook_objects add column if not exists blast numeric not null default 0;
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
insert into games.goldhook_objects (level, id, points, speed_mul, travel, x, y, blast) values
(1, 0, 250, 0.25, 345.369, 124, 494, 0),
(1, 1, 120, 0.5, 319.413, 712, 584, 0),
(1, 2, 120, 0.5, 215.028, 484, 558, 0),
(1, 3, 120, 0.5, 358.39, 801, 553, 0),
(1, 4, 100, 0.4, 107.677, 580, 422, 0),
(1, 5, 75, 1, 319.53, 679, 602, 0),
(1, 6, 75, 1, 194.805, 689, 424, 0),
(1, 7, 50, 1, 193.744, 286, 442, 0),
(1, 8, 50, 1, 111.073, 517, 446, 0),
(1, 9, 50, 1, 101.639, 547, 426, 0),
(1, 10, 50, 1, 204.047, 665, 467, 0),
(1, 11, 10, 0.2, 192.225, 636, 482, 0),
(1, 12, 10, 0.2, 206.386, 592, 525, 0),
(1, 13, 10, 0.2, 111.622, 618, 387, 0),
(2, 0, 250, 0.25, 216.574, 510, 565, 0),
(2, 1, 250, 0.25, 206.586, 420, 550, 0),
(2, 2, 120, 0.5, 366.42, 821, 541, 0),
(2, 3, 120, 0.5, 313.968, 684, 597, 0),
(2, 4, 120, 0.5, 210.177, 681, 465, 0),
(2, 5, 100, 0.4, 190.517, 355, 504, 0),
(2, 6, 75, 1, 188.297, 400, 514, 0),
(2, 7, 75, 1, 333.8, 794, 516, 0),
(2, 8, 50, 1, 302.769, 626, 611, 0),
(2, 9, 50, 1, 181.831, 320, 460, 0),
(2, 10, 50, 1, 148.171, 614, 438, 0),
(2, 11, 50, 1, 301.833, 795, 456, 0),
(2, 12, 10, 0.2, 162.499, 291, 403, 0),
(2, 13, 10, 0.2, 293.62, 763, 497, 0),
(2, 14, 10, 0.2, 283.561, 552, 619, 0),
(3, 0, 250, 0.25, 226.379, 684, 495, 0),
(3, 1, 250, 0.25, 360, 824, 538, 0),
(3, 2, 120, 0.5, 153.372, 536, 489, 0),
(3, 3, 120, 0.5, 228.054, 412, 563, 0),
(3, 4, 120, 0.5, 254.97, 281, 528, 0),
(3, 5, 100, 0.4, 153.146, 488, 499, 0),
(3, 6, 75, 1, 234.206, 647, 521, 0),
(3, 7, 75, 1, 302.06, 162, 451, 0),
(3, 8, 50, 1, 79.231, 488, 418, 0),
(3, 9, 50, 1, 262.846, 401, 592, 0),
(3, 10, 50, 1, 290.722, 221, 515, 0),
(3, 11, 50, 1, 70.799, 372, 352, 0),
(3, 12, 10, 0.2, 109.699, 415, 440, 0),
(3, 13, 10, 0.2, 183.27, 440, 523, 0),
(3, 14, 10, 0.2, 48.646, 468, 391, 0),
(3, 15, 10, 0.2, 270.421, 677, 549, 0),
(4, 0, 250, 0.25, 293.166, 777, 489, 0),
(4, 1, 250, 0.25, 373.085, 190, 615, 0),
(4, 2, 120, 0.5, 233.627, 572, 562, 0),
(4, 3, 120, 0.5, 166.712, 452, 508, 0),
(4, 4, 120, 0.5, 252.203, 413, 588, 0),
(4, 5, 100, 0.4, 279.079, 654, 578, 0),
(4, 6, 75, 1, 347.004, 806, 522, 0),
(4, 7, 75, 1, 206.766, 354, 514, 0),
(4, 8, 50, 1, 170.915, 550, 499, 0),
(4, 9, 50, 1, 220.064, 486, 559, 0),
(4, 10, 50, 1, 151.304, 368, 458, 0),
(4, 11, 50, 1, 144.295, 615, 432, 0),
(4, 12, 10, 0.2, 82.23, 424, 414, 0),
(4, 13, 10, 0.2, 51.769, 436, 386, 0),
(4, 14, 10, 0.2, 80.031, 483, 423, 0),
(4, 15, 10, 0.2, 206.408, 650, 489, 0),
(4, 16, 10, 0.2, 149.875, 576, 470, 0),
(5, 0, 250, 0.25, 205.174, 280, 469, 0),
(5, 1, 250, 0.25, 299.817, 219, 542, 0),
(5, 2, 250, 0.25, 369.318, 781, 600, 0),
(5, 3, 120, 0.5, 207.933, 434, 547, 0),
(5, 4, 120, 0.5, 276.814, 423, 615, 0),
(5, 5, 120, 0.5, 162.639, 663, 412, 0),
(5, 6, 120, 0.5, 222.047, 696, 466, 0),
(5, 7, 100, 0.4, 236.953, 625, 546, 0),
(5, 8, 75, 1, 371.592, 159, 567, 0),
(5, 9, 75, 1, 244.66, 427, 579, 0),
(5, 10, 50, 1, 182.919, 405, 510, 0),
(5, 11, 50, 1, 330.683, 803, 498, 0),
(5, 12, 50, 1, 171.592, 558, 497, 0),
(5, 13, 50, 1, 351.599, 144, 516, 0),
(5, 14, 10, 0.2, 240.585, 320, 538, 0),
(5, 15, 10, 0.2, 183.148, 525, 522, 0),
(5, 16, 10, 0.2, 113.954, 592, 417, 0),
(5, 17, 10, 0.2, 44.837, 525, 378, 0),
(5, 18, 10, 0.2, 123.472, 626, 396, 0),
(6, 0, 250, 0.25, 260.8, 215, 478, 0),
(6, 1, 250, 0.25, 363.202, 188, 600, 0),
(6, 2, 250, 0.25, 258.635, 535, 604, 0),
(6, 3, 120, 0.5, 362.23, 770, 591, 0),
(6, 4, 120, 0.5, 260.817, 677, 537, 0),
(6, 5, 120, 0.5, 279.235, 737, 506, 0),
(6, 6, 120, 0.5, 353.01, 811, 532, 0),
(6, 7, 100, 0.4, 213.517, 693, 461, 0),
(6, 8, 75, 1, 153.529, 593, 460, 0),
(6, 9, 75, 1, 164.617, 567, 486, 0),
(6, 10, 50, 1, 161.077, 433, 495, 0),
(6, 11, 50, 1, 186.668, 673, 432, 0),
(6, 12, 50, 1, 223.294, 613, 529, 0),
(6, 13, 50, 1, 333.917, 800, 508, 0),
(6, 14, 10, 0.2, 131.858, 557, 459, 0),
(6, 15, 10, 0.2, 75.405, 396, 390, 0),
(6, 16, 10, 0.2, 189.16, 273, 424, 0),
(6, 17, 10, 0.2, 184.202, 695, 402, 0),
(6, 18, 10, 0.2, 154.83, 461, 497, 0),
(6, 19, 10, 0.2, 91.353, 512, 431, 0),
(7, 0, 250, 0.25, 273.176, 283, 561, 0),
(7, 1, 250, 0.25, 336.059, 702, 620, 0),
(7, 2, 250, 0.25, 316.374, 782, 521, 0),
(7, 3, 120, 0.5, 327.082, 150, 488, 0),
(7, 4, 120, 0.5, 238.325, 739, 434, 0),
(7, 5, 120, 0.5, 151.032, 297, 391, 0),
(7, 6, 120, 0.5, 203.174, 423, 540, 0),
(7, 7, 100, 0.4, 203.742, 500, 549, 0),
(7, 8, 75, 1, 58.987, 520, 391, 0),
(7, 9, 75, 1, 53.8, 390, 348, 0),
(7, 10, 75, 1, 56.52, 448, 391, 0),
(7, 11, 50, 1, 347.281, 272, 629, 0),
(7, 12, 50, 1, 289.294, 450, 627, 0),
(7, 13, 50, 1, 236.651, 251, 467, 0),
(7, 14, 50, 1, 181.958, 274, 405, 0),
(7, 15, 10, 0.2, 198.489, 464, 541, 0),
(7, 16, 10, 0.2, 142.805, 364, 450, 0),
(7, 17, 10, 0.2, 305.631, 705, 572, 0),
(7, 18, 10, 0.2, 89.19, 449, 429, 0),
(7, 19, 10, 0.2, 231.871, 270, 487, 0),
(7, 20, 10, 0.2, 95.685, 346, 365, 0),
(7, 21, 10, 0.2, 58.605, 578, 352, 0),
(8, 0, 250, 0.25, 307.661, 742, 552, 0),
(8, 1, 250, 0.25, 351.076, 739, 612, 0),
(8, 2, 250, 0.25, 247.505, 729, 477, 0),
(8, 3, 250, 0.25, 279.262, 360, 608, 0),
(8, 4, 120, 0.5, 267.389, 566, 599, 0),
(8, 5, 120, 0.5, 252.825, 535, 591, 0),
(8, 6, 120, 0.5, 226.456, 267, 476, 0),
(8, 7, 120, 0.5, 171.955, 528, 510, 0),
(8, 8, 100, 0.4, 119.558, 456, 464, 0),
(8, 9, 100, 0.4, 346.137, 129, 496, 0),
(8, 10, 75, 1, 289.694, 548, 622, 0),
(8, 11, 75, 1, 242.469, 350, 552, 0),
(8, 12, 75, 1, 306.624, 271, 580, 0),
(8, 13, 50, 1, 158.462, 293, 391, 0),
(8, 14, 50, 1, 189.887, 612, 491, 0),
(8, 15, 50, 1, 219.454, 296, 489, 0),
(8, 16, 50, 1, 151.297, 665, 380, 0),
(8, 17, 10, 0.2, 57.747, 426, 388, 0),
(8, 18, 10, 0.2, 259.49, 608, 576, 0),
(8, 19, 10, 0.2, 278.247, 493, 621, 0),
(8, 20, 10, 0.2, 76.23, 557, 396, 0),
(8, 21, 10, 0.2, 168.572, 365, 481, 0),
(8, 22, 10, 0.2, 77.616, 453, 418, 0),
(8, 23, 10, 0.2, 53.297, 503, 394, 0),
(9, 0, 250, 0.25, 243.21, 290, 529, 0),
(9, 1, 250, 0.25, 284.606, 195, 491, 0),
(9, 2, 250, 0.25, 210.722, 281, 478, 0),
(9, 3, 250, 0.25, 279.675, 412, 623, 0),
(9, 4, 120, 0.5, 228.015, 477, 571, 0),
(9, 5, 120, 0.5, 295.949, 787, 466, 0),
(9, 6, 120, 0.5, 293.13, 630, 603, 0),
(9, 7, 120, 0.5, 199.931, 698, 427, 0),
(9, 8, 120, 0.5, 252.356, 741, 457, 0),
(9, 9, 100, 0.4, 301.396, 296, 598, 0),
(9, 10, 100, 0.4, 258.779, 659, 551, 0),
(9, 11, 75, 1, 201.499, 252, 406, 0),
(9, 12, 75, 1, 107.291, 602, 393, 0),
(9, 13, 75, 1, 321.255, 693, 595, 0),
(9, 14, 50, 1, 282.005, 478, 621, 0),
(9, 15, 50, 1, 163.265, 579, 479, 0),
(9, 16, 50, 1, 276.44, 598, 594, 0),
(9, 17, 50, 1, 320.759, 771, 524, 0),
(9, 18, 10, 0.2, 42.721, 499, 384, 0),
(9, 19, 10, 0.2, 109.791, 631, 364, 0),
(9, 20, 10, 0.2, 178.132, 329, 468, 0),
(9, 21, 10, 0.2, 217.215, 616, 525, 0),
(9, 22, 10, 0.2, 144.79, 411, 476, 0),
(9, 23, 10, 0.2, 263.732, 253, 515, 0),
(9, 24, 10, 0.2, 133.499, 494, 476, 0),
(9, 25, 10, 0.2, 180.248, 279, 417, 0),
(10, 0, 250, 0.25, 368.617, 839, 532, 0),
(10, 1, 250, 0.25, 329.742, 143, 495, 0),
(10, 2, 250, 0.25, 341.523, 166, 546, 0),
(10, 3, 250, 0.25, 213.55, 545, 556, 0),
(10, 4, 120, 0.5, 216.028, 624, 519, 0),
(10, 5, 120, 0.5, 213.065, 294, 484, 0),
(10, 6, 120, 0.5, 158.822, 382, 479, 0),
(10, 7, 120, 0.5, 241.921, 369, 564, 0),
(10, 8, 120, 0.5, 330.117, 659, 630, 0),
(10, 9, 100, 0.4, 187.179, 662, 456, 0),
(10, 10, 100, 0.4, 319.216, 714, 586, 0),
(10, 11, 75, 1, 197.632, 384, 518, 0),
(10, 12, 75, 1, 97.486, 382, 402, 0),
(10, 13, 75, 1, 226.047, 666, 496, 0),
(10, 14, 50, 1, 92.604, 458, 430, 0),
(10, 15, 50, 1, 353.625, 268, 634, 0),
(10, 16, 50, 1, 162.634, 621, 451, 0),
(10, 17, 50, 1, 242.532, 329, 541, 0),
(10, 18, 10, 0.2, 164.668, 307, 428, 0),
(10, 19, 10, 0.2, 254.447, 642, 553, 0),
(10, 20, 10, 0.2, 134.587, 455, 476, 0),
(10, 21, 10, 0.2, 178.223, 675, 422, 0),
(10, 22, 10, 0.2, 192.431, 507, 534, 0),
(10, 23, 10, 0.2, 319.472, 266, 597, 0),
(10, 24, 10, 0.2, 85.556, 542, 415, 0),
(10, 25, 10, 0.2, 56.201, 385, 352, 0),
(10, 26, 10, 0.2, 59.196, 436, 394, 0),
(11, 0, 250, 0.25, 282.88, 227, 526, 0),
(11, 1, 250, 0.25, 226.651, 219, 421, 0),
(11, 2, 250, 0.25, 290.455, 642, 602, 0),
(11, 3, 250, 0.25, 295.016, 786, 479, 0),
(11, 4, 250, 0.25, 374.599, 143, 570, 0),
(11, 5, 120, 0.5, 274.928, 660, 566, 0),
(11, 6, 120, 0.5, 362.282, 769, 592, 0),
(11, 7, 120, 0.5, 159.353, 375, 476, 0),
(11, 8, 120, 0.5, 206.875, 328, 503, 0),
(11, 9, 120, 0.5, 326.082, 308, 629, 0),
(11, 10, 100, 0.4, 324.59, 724, 585, 0),
(11, 11, 100, 0.4, 137.423, 410, 471, 0),
(11, 12, 75, 1, 338.8, 798, 519, 0),
(11, 13, 75, 1, 236.771, 339, 540, 0),
(11, 14, 75, 1, 102.251, 489, 441, 0),
(11, 15, 50, 1, 250.079, 487, 589, 0),
(11, 16, 50, 1, 117.298, 396, 435, 0),
(11, 17, 50, 1, 267.81, 266, 527, 0),
(11, 18, 50, 1, 132.481, 533, 464, 0),
(11, 19, 10, 0.2, 127.507, 353, 422, 0),
(11, 20, 10, 0.2, 72.771, 427, 405, 0),
(11, 21, 10, 0.2, 88.029, 573, 399, 0),
(11, 22, 10, 0.2, 269.18, 318, 570, 0),
(11, 23, 10, 0.2, 217.793, 683, 474, 0),
(11, 24, 10, 0.2, 128.376, 492, 471, 0),
(11, 25, 10, 0.2, 92.724, 613, 361, 0),
(11, 26, 10, 0.2, 180.993, 538, 517, 0),
(11, 27, 10, 0.2, 298.431, 188, 493, 0),
(12, 0, 250, 0.25, 248.209, 669, 536, 0),
(12, 1, 250, 0.25, 259.188, 766, 443, 0),
(12, 2, 250, 0.25, 322.756, 183, 537, 0),
(12, 3, 250, 0.25, 253.867, 523, 601, 0),
(12, 4, 250, 0.25, 227.759, 695, 486, 0),
(12, 5, 120, 0.5, 326.566, 771, 539, 0),
(12, 6, 120, 0.5, 234.833, 552, 569, 0),
(12, 7, 120, 0.5, 285.07, 487, 628, 0),
(12, 8, 120, 0.5, 184.032, 335, 480, 0),
(12, 9, 120, 0.5, 168.224, 448, 509, 0),
(12, 10, 100, 0.4, 191.194, 470, 537, 0),
(12, 11, 100, 0.4, 274.975, 338, 590, 0),
(12, 12, 75, 1, 348.682, 718, 611, 0),
(12, 13, 75, 1, 362.882, 108, 479, 0),
(12, 14, 75, 1, 370.815, 826, 535, 0),
(12, 15, 50, 1, 289.579, 698, 552, 0),
(12, 16, 50, 1, 323.545, 625, 634, 0),
(12, 17, 50, 1, 358.139, 247, 626, 0),
(12, 18, 50, 1, 126.601, 368, 428, 0),
(12, 19, 10, 0.2, 271.498, 240, 513, 0),
(12, 20, 10, 0.2, 65.763, 466, 408, 0),
(12, 21, 10, 0.2, 81.045, 590, 373, 0),
(12, 22, 10, 0.2, 128.603, 634, 394, 0),
(12, 23, 10, 0.2, 43.282, 516, 380, 0),
(12, 24, 10, 0.2, 96.665, 343, 362, 0),
(12, 25, 10, 0.2, 97.461, 418, 428, 0),
(12, 26, 10, 0.2, 96.511, 618, 360, 0),
(12, 27, 10, 0.2, 122.526, 444, 462, 0),
(12, 28, 10, 0.2, 134.914, 311, 383, 0),
(13, 0, 250, 0.25, 278.209, 203, 491, 0),
(13, 1, 250, 0.25, 329.671, 256, 611, 0),
(13, 2, 250, 0.25, 259.661, 529, 606, 0),
(13, 3, 250, 0.25, 314.516, 723, 578, 0),
(13, 4, 250, 0.25, 271.55, 241, 524, 0),
(13, 5, 120, 0.5, 168.905, 428, 506, 0),
(13, 6, 120, 0.5, 217.912, 384, 544, 0),
(13, 7, 120, 0.5, 274.551, 670, 559, 0),
(13, 8, 120, 0.5, 357.837, 728, 620, 0),
(13, 9, 120, 0.5, 209.426, 710, 426, 0),
(13, 10, 120, 0.5, 260.694, 747, 463, 0),
(13, 11, 100, 0.4, 286.835, 338, 603, 0),
(13, 12, 100, 0.4, 182.203, 591, 502, 0),
(13, 13, 75, 1, 74.27, 540, 399, 0),
(13, 14, 75, 1, 322.418, 622, 634, 0),
(13, 15, 75, 1, 295.622, 171, 454, 0),
(13, 16, 50, 1, 258.775, 714, 495, 0),
(13, 17, 50, 1, 290.413, 439, 627, 0),
(13, 18, 50, 1, 73.981, 452, 410, 0),
(13, 19, 50, 1, 191.491, 555, 519, 0),
(13, 20, 10, 0.2, 313.616, 672, 604, 0),
(13, 21, 10, 0.2, 133.163, 632, 404, 0),
(13, 22, 10, 0.2, 220.24, 632, 519, 0),
(13, 23, 10, 0.2, 134.246, 571, 455, 0),
(13, 24, 10, 0.2, 201.092, 657, 476, 0),
(13, 25, 10, 0.2, 167.202, 652, 433, 0),
(13, 26, 10, 0.2, 228.77, 409, 563, 0),
(13, 27, 10, 0.2, 194.526, 292, 456, 0),
(13, 28, 10, 0.2, 251.841, 569, 582, 0),
(13, 29, 10, 0.2, 203.812, 322, 495, 0),
(13, 30, 10, 0.2, 142.516, 366, 451, 0),
(14, 0, 250, 0.25, 284.746, 286, 577, 0),
(14, 1, 250, 0.25, 242.757, 611, 564, 0),
(14, 2, 250, 0.25, 252.815, 419, 597, 0),
(14, 3, 250, 0.25, 287.761, 748, 517, 0),
(14, 4, 250, 0.25, 374.937, 820, 567, 0),
(14, 5, 250, 0.25, 374.567, 102, 514, 0),
(14, 6, 120, 0.5, 171.94, 501, 514, 0),
(14, 7, 120, 0.5, 333.627, 257, 608, 0),
(14, 8, 120, 0.5, 303.764, 676, 590, 0),
(14, 9, 120, 0.5, 301.782, 201, 515, 0),
(14, 10, 120, 0.5, 237.308, 452, 579, 0),
(14, 11, 120, 0.5, 285.483, 384, 615, 0),
(14, 12, 100, 0.4, 363.2, 758, 607, 0),
(14, 13, 100, 0.4, 355.236, 844, 492, 0),
(14, 14, 75, 1, 211.142, 631, 504, 0),
(14, 15, 75, 1, 335.726, 183, 540, 0),
(14, 16, 75, 1, 149.369, 527, 483, 0),
(14, 17, 75, 1, 283.147, 707, 536, 0),
(14, 18, 50, 1, 154.775, 322, 424, 0),
(14, 19, 50, 1, 303.111, 599, 622, 0),
(14, 20, 50, 1, 330.597, 661, 625, 0),
(14, 21, 50, 1, 203.819, 535, 537, 0),
(14, 22, 10, 0.2, 182.153, 296, 442, 0),
(14, 23, 10, 0.2, 254.1, 208, 443, 0),
(14, 24, 10, 0.2, 55.228, 463, 397, 0),
(14, 25, 10, 0.2, 65.132, 497, 407, 0),
(14, 26, 10, 0.2, 104.502, 419, 436, 0),
(14, 27, 10, 0.2, 251.841, 310, 545, 0),
(14, 28, 10, 0.2, 288.778, 192, 482, 0),
(14, 29, 10, 0.2, 168.657, 376, 487, 0),
(14, 30, 10, 0.2, 223.602, 309, 510, 0),
(14, 31, 10, 0.2, 258.029, 706, 508, 0),
(14, 32, 10, 0.2, 287.241, 467, 630, 0),
(15, 0, 250, 0.25, 292.405, 597, 623, 0),
(15, 1, 250, 0.25, 301.618, 662, 604, 0),
(15, 2, 250, 0.25, 324.138, 191, 548, 0),
(15, 3, 250, 0.25, 280.766, 789, 446, 0),
(15, 4, 250, 0.25, 268.527, 356, 595, 0),
(15, 5, 250, 0.25, 313.255, 239, 578, 0),
(15, 6, 120, 0.5, 270.538, 512, 612, 0),
(15, 7, 120, 0.5, 313.852, 717, 573, 0),
(15, 8, 120, 0.5, 372.409, 221, 630, 0),
(15, 9, 120, 0.5, 352.8, 771, 577, 0),
(15, 10, 120, 0.5, 201.168, 428, 539, 0),
(15, 11, 120, 0.5, 206.595, 341, 511, 0),
(15, 12, 100, 0.4, 141.386, 633, 420, 0),
(15, 13, 100, 0.4, 217.6, 650, 507, 0),
(15, 14, 75, 1, 215.754, 511, 553, 0),
(15, 15, 75, 1, 237.708, 440, 574, 0),
(15, 16, 75, 1, 71.698, 459, 409, 0),
(15, 17, 75, 1, 375.264, 105, 499, 0),
(15, 18, 50, 1, 112.572, 466, 451, 0),
(15, 19, 50, 1, 273.687, 389, 600, 0),
(15, 20, 50, 1, 119.664, 444, 455, 0),
(15, 21, 50, 1, 157.723, 440, 493, 0),
(15, 22, 10, 0.2, 243.806, 583, 569, 0),
(15, 23, 10, 0.2, 79.72, 520, 417, 0),
(15, 24, 10, 0.2, 219.978, 366, 539, 0),
(15, 25, 10, 0.2, 206.557, 311, 490, 0),
(15, 26, 10, 0.2, 138.695, 315, 396, 0),
(15, 27, 10, 0.2, 86.12, 426, 419, 0),
(15, 28, 10, 0.2, 153.067, 362, 461, 0),
(15, 29, 10, 0.2, 164.844, 387, 488, 0),
(15, 30, 10, 0.2, 82.165, 383, 388, 0),
(15, 31, 10, 0.2, 59.188, 539, 387, 0),
(15, 32, 10, 0.2, 187.639, 294, 448, 0),
(15, 33, 10, 0.2, 126.108, 541, 459, 0),
(16, 0, 250, 0.25, 341.636, 134, 503, 0),
(16, 1, 250, 0.25, 296.476, 336, 617, 0),
(16, 2, 250, 0.25, 279.366, 629, 596, 0),
(16, 3, 250, 0.25, 244.529, 657, 540, 0),
(16, 4, 250, 0.25, 330.679, 820, 492, 0),
(16, 5, 250, 0.25, 258.105, 543, 602, 0),
(16, 6, 120, 0.5, 203.377, 339, 506, 0),
(16, 7, 120, 0.5, 354.043, 810, 535, 0),
(16, 8, 120, 0.5, 249.641, 448, 591, 0),
(16, 9, 120, 0.5, 280.001, 443, 621, 0),
(16, 10, 120, 0.5, 289.665, 202, 497, 0),
(16, 11, 120, 0.5, 320.742, 237, 577, 0),
(16, 12, 100, 0.4, 106.026, 477, 452, 0),
(16, 13, 100, 0.4, 113.011, 611, 402, 0),
(16, 14, 100, 0.4, 202.126, 684, 454, 0),
(16, 15, 75, 1, 342.603, 703, 614, 0),
(16, 16, 75, 1, 294.929, 401, 625, 0),
(16, 17, 75, 1, 261.22, 726, 485, 0),
(16, 18, 75, 1, 297.808, 764, 496, 0),
(16, 19, 50, 1, 243.378, 307, 528, 0),
(16, 20, 50, 1, 138.952, 428, 471, 0),
(16, 21, 50, 1, 166.568, 360, 471, 0),
(16, 22, 50, 1, 327.742, 737, 569, 0),
(16, 23, 10, 0.2, 186.969, 294, 447, 0),
(16, 24, 10, 0.2, 170.619, 463, 513, 0),
(16, 25, 10, 0.2, 260.346, 333, 568, 0),
(16, 26, 10, 0.2, 178.611, 406, 510, 0),
(16, 27, 10, 0.2, 158.652, 391, 483, 0),
(16, 28, 10, 0.2, 37.404, 489, 380, 0),
(16, 29, 10, 0.2, 190.339, 614, 495, 0),
(16, 30, 10, 0.2, 291.266, 231, 532, 0),
(16, 31, 10, 0.2, 151.618, 611, 450, 0),
(16, 32, 10, 0.2, 230.777, 388, 559, 0),
(16, 33, 10, 0.2, 107.891, 578, 420, 0),
(16, 34, 10, 0.2, 226.518, 285, 494, 0),
(16, 35, 10, 0.2, 228.756, 501, 571, 0),
(17, 0, 250, 0.25, 265.529, 184, 438, 0),
(17, 1, 250, 0.25, 311.011, 711, 583, 0),
(17, 2, 250, 0.25, 270.969, 422, 616, 0),
(17, 3, 250, 0.25, 354.834, 152, 550, 0),
(17, 4, 250, 0.25, 353.713, 218, 613, 0),
(17, 5, 250, 0.25, 318.931, 758, 552, 0),
(17, 6, 250, 0.25, 252.374, 553, 594, 0),
(17, 7, 120, 0.5, 214.218, 721, 417, 0),
(17, 8, 120, 0.5, 334.216, 814, 495, 0),
(17, 9, 120, 0.5, 375.415, 792, 588, 0),
(17, 10, 120, 0.5, 267.51, 329, 574, 0),
(17, 11, 120, 0.5, 229.369, 378, 554, 0),
(17, 12, 120, 0.5, 367.112, 751, 614, 0),
(17, 13, 120, 0.5, 300.89, 784, 480, 0),
(17, 14, 100, 0.4, 298.485, 645, 605, 0),
(17, 15, 100, 0.4, 151.347, 578, 474, 0),
(17, 16, 100, 0.4, 142.021, 652, 397, 0),
(17, 17, 75, 1, 245.909, 603, 559, 0),
(17, 18, 75, 1, 311.54, 172, 486, 0),
(17, 19, 75, 1, 243.279, 467, 582, 0),
(17, 20, 75, 1, 163.353, 375, 476, 0),
(17, 21, 50, 1, 234.061, 619, 538, 0),
(17, 22, 50, 1, 300.736, 283, 581, 0),
(17, 23, 50, 1, 297.618, 331, 604, 0),
(17, 24, 50, 1, 259.284, 363, 576, 0),
(17, 25, 10, 0.2, 61.197, 508, 401, 0),
(17, 26, 10, 0.2, 247.459, 696, 503, 0),
(17, 27, 10, 0.2, 291.407, 254, 553, 0),
(17, 28, 10, 0.2, 155.762, 401, 484, 0),
(17, 29, 10, 0.2, 101.924, 376, 408, 0),
(17, 30, 10, 0.2, 261.679, 501, 604, 0),
(17, 31, 10, 0.2, 182.081, 608, 489, 0),
(17, 32, 10, 0.2, 162.079, 486, 505, 0),
(17, 33, 10, 0.2, 203.655, 296, 473, 0),
(17, 34, 10, 0.2, 133.229, 365, 439, 0),
(17, 35, 10, 0.2, 96.862, 590, 396, 0),
(17, 36, 10, 0.2, 153.813, 308, 412, 0),
(17, 37, 10, 0.2, 103.481, 526, 440, 0),
(18, 0, 250, 0.25, 254.322, 689, 528, 0),
(18, 1, 250, 0.25, 358.206, 225, 624, 0),
(18, 2, 250, 0.25, 290.199, 660, 592, 0),
(18, 3, 250, 0.25, 328.814, 722, 597, 0),
(18, 4, 250, 0.25, 297.72, 737, 543, 0),
(18, 5, 250, 0.25, 262.18, 442, 610, 0),
(18, 6, 250, 0.25, 355.47, 124, 513, 0),
(18, 7, 120, 0.5, 279.597, 597, 602, 0),
(18, 8, 120, 0.5, 223.558, 576, 550, 0),
(18, 9, 120, 0.5, 347.825, 207, 587, 0),
(18, 10, 120, 0.5, 274.8, 358, 595, 0),
(18, 11, 120, 0.5, 325.247, 300, 624, 0),
(18, 12, 120, 0.5, 194.992, 704, 408, 0),
(18, 13, 120, 0.5, 246.556, 320, 545, 0),
(18, 14, 100, 0.4, 264.054, 486, 610, 0),
(18, 15, 100, 0.4, 322.989, 188, 537, 0),
(18, 16, 100, 0.4, 134.688, 654, 380, 0),
(18, 17, 75, 1, 151.544, 528, 485, 0),
(18, 18, 75, 1, 233.063, 706, 465, 0),
(18, 19, 75, 1, 156.058, 415, 485, 0),
(18, 20, 75, 1, 365.124, 829, 521, 0),
(18, 21, 50, 1, 342.453, 749, 578, 0),
(18, 22, 50, 1, 258.189, 583, 580, 0),
(18, 23, 50, 1, 207.54, 360, 518, 0),
(18, 24, 50, 1, 186.817, 579, 505, 0),
(18, 25, 10, 0.2, 51.978, 506, 392, 0),
(18, 26, 10, 0.2, 305.571, 794, 473, 0),
(18, 27, 10, 0.2, 233.42, 264, 483, 0),
(18, 28, 10, 0.2, 276.767, 199, 471, 0),
(18, 29, 10, 0.2, 280.838, 553, 616, 0),
(18, 30, 10, 0.2, 70.843, 563, 385, 0),
(18, 31, 10, 0.2, 81.917, 405, 404, 0),
(18, 32, 10, 0.2, 126.644, 443, 466, 0),
(18, 33, 10, 0.2, 108.918, 330, 364, 0),
(18, 34, 10, 0.2, 49.871, 466, 392, 0),
(18, 35, 10, 0.2, 189.198, 490, 532, 0),
(18, 36, 10, 0.2, 80.753, 452, 421, 0),
(18, 37, 10, 0.2, 157.227, 650, 420, 0),
(18, 38, 10, 0.2, 279.654, 264, 546, 0),
(19, 0, 250, 0.25, 269.717, 552, 612, 0),
(19, 1, 250, 0.25, 271.162, 294, 566, 0),
(19, 2, 250, 0.25, 298.37, 329, 616, 0),
(19, 3, 250, 0.25, 319.621, 778, 531, 0),
(19, 4, 250, 0.25, 290.435, 205, 513, 0),
(19, 5, 250, 0.25, 339.079, 219, 595, 0),
(19, 6, 250, 0.25, 363.202, 860, 488, 0),
(19, 7, 120, 0.5, 215.255, 245, 429, 0),
(19, 8, 120, 0.5, 264.013, 477, 607, 0),
(19, 9, 120, 0.5, 314.921, 645, 620, 0),
(19, 10, 120, 0.5, 279.476, 619, 593, 0),
(19, 11, 120, 0.5, 292.077, 392, 624, 0),
(19, 12, 120, 0.5, 238.771, 595, 559, 0),
(19, 13, 120, 0.5, 326.666, 164, 508, 0),
(19, 14, 100, 0.4, 123.517, 466, 469, 0),
(19, 15, 100, 0.4, 159.887, 288, 399, 0),
(19, 16, 100, 0.4, 217.753, 434, 560, 0),
(19, 17, 75, 1, 184.402, 637, 466, 0),
(19, 18, 75, 1, 188.776, 577, 508, 0),
(19, 19, 75, 1, 344.886, 710, 612, 0),
(19, 20, 75, 1, 220.701, 667, 488, 0),
(19, 21, 50, 1, 169.98, 556, 496, 0),
(19, 22, 50, 1, 257.205, 625, 561, 0),
(19, 23, 50, 1, 284.512, 760, 479, 0),
(19, 24, 50, 1, 328.418, 147, 478, 0),
(19, 25, 10, 0.2, 121.173, 584, 432, 0),
(19, 26, 10, 0.2, 229.865, 693, 481, 0),
(19, 27, 10, 0.2, 224.459, 387, 552, 0),
(19, 28, 10, 0.2, 244.774, 255, 490, 0),
(19, 29, 10, 0.2, 244.611, 520, 585, 0),
(19, 30, 10, 0.2, 93.108, 413, 421, 0),
(19, 31, 10, 0.2, 272.846, 677, 552, 0),
(19, 32, 10, 0.2, 46.562, 440, 382, 0),
(19, 33, 10, 0.2, 196.557, 463, 539, 0),
(19, 34, 10, 0.2, 168.948, 318, 446, 0),
(19, 35, 10, 0.2, 300.495, 240, 553, 0),
(19, 36, 10, 0.2, 173.78, 532, 511, 0),
(19, 37, 10, 0.2, 76.903, 457, 418, 0),
(19, 38, 10, 0.2, 95.041, 361, 384, 0),
(19, 39, 10, 0.2, 215.772, 305, 497, 0),
(20, 0, 250, 0.25, 342.316, 183, 566, 0),
(20, 1, 250, 0.25, 361.17, 108, 498, 0),
(20, 2, 250, 0.25, 356.063, 849, 493, 0),
(20, 3, 250, 0.25, 273.991, 411, 617, 0),
(20, 4, 250, 0.25, 329.011, 159, 517, 0),
(20, 5, 250, 0.25, 311.922, 652, 621, 0),
(20, 6, 250, 0.25, 280.042, 743, 511, 0),
(20, 7, 250, 0.25, 267.053, 486, 617, 0),
(20, 8, 120, 0.5, 226.856, 644, 519, 0),
(20, 9, 120, 0.5, 280.918, 698, 546, 0),
(20, 10, 120, 0.5, 324.253, 259, 598, 0),
(20, 11, 120, 0.5, 203.182, 527, 542, 0),
(20, 12, 120, 0.5, 252.063, 321, 552, 0),
(20, 13, 120, 0.5, 330.62, 779, 536, 0),
(20, 14, 120, 0.5, 331.097, 732, 583, 0),
(20, 15, 100, 0.4, 166.819, 386, 493, 0),
(20, 16, 100, 0.4, 117.172, 384, 436, 0),
(20, 17, 100, 0.4, 261.928, 376, 591, 0),
(20, 18, 75, 1, 366.822, 818, 539, 0),
(20, 19, 75, 1, 360.977, 214, 605, 0),
(20, 20, 75, 1, 297.025, 453, 635, 0),
(20, 21, 75, 1, 358.346, 767, 583, 0),
(20, 22, 50, 1, 93.069, 414, 417, 0),
(20, 23, 50, 1, 159.661, 353, 458, 0),
(20, 24, 50, 1, 257.734, 540, 591, 0),
(20, 25, 50, 1, 306.042, 730, 546, 0),
(20, 26, 10, 0.2, 89.2, 554, 413, 0),
(20, 27, 10, 0.2, 136.902, 436, 475, 0),
(20, 28, 10, 0.2, 190.653, 274, 428, 0),
(20, 29, 10, 0.2, 302.875, 688, 581, 0),
(20, 30, 10, 0.2, 249.928, 248, 490, 0),
(20, 31, 10, 0.2, 50.648, 534, 380, 0),
(20, 32, 10, 0.2, 182.652, 444, 523, 0),
(20, 33, 10, 0.2, 159.427, 537, 495, 0),
(20, 34, 10, 0.2, 51.021, 395, 356, 0),
(20, 35, 10, 0.2, 125.957, 499, 468, 0),
(20, 36, 10, 0.2, 251.453, 615, 564, 0),
(20, 37, 10, 0.2, 193.628, 617, 497, 0),
(20, 38, 10, 0.2, 59.053, 464, 401, 0),
(20, 39, 10, 0.2, 70.221, 498, 412, 0),
(20, 40, 10, 0.2, 288.604, 181, 465, 0);
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
  b jsonb; b_x numeric[]; b_y numeric[]; b_r numeric[]; b_t numeric[]; b_ids int[]; prev_bt numeric;
  o_x numeric; o_y numeric; o_blast numeric; k int;
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

    -- powder barrels that went off on this level, in time order. The hook is empty when one goes off
    -- (it is on its way to the barrel), so nothing within the blast can be delivered after it.
    if lv ? 'blasts' and (jsonb_typeof(lv -> 'blasts') is distinct from 'array' or jsonb_array_length(lv -> 'blasts') > 10) then
      raise exception '%', bad;
    end if;
    b_x := '{}'; b_y := '{}'; b_r := '{}'; b_t := '{}'; b_ids := '{}'; prev_bt := 0;
    for b in select e.value from jsonb_array_elements(coalesce(lv -> 'blasts', '[]'::jsonb)) with ordinality as e(value, idx) order by e.idx loop
      if jsonb_typeof(b -> 'id') is distinct from 'number' or jsonb_typeof(b -> 't') is distinct from 'number'
         or (b ->> 'id') !~ '^[0-9]{1,2}$' then
        raise exception '%', bad;
      end if;
      v_id := (b ->> 'id')::int;
      v_t := (b ->> 't')::numeric;
      o_blast := null;
      select o.x, o.y, o.blast into o_x, o_y, o_blast from games.goldhook_objects o where o.level = i and o.id = v_id;
      if o_blast is null or o_blast <= 0 or v_id = any (b_ids) or v_t <= 0 or v_t > v_seconds + 0.001 or v_t < prev_bt then
        raise exception '%', bad;
      end if;
      for k in 1 .. coalesce(array_length(b_t, 1), 0) loop
        if b_t[k] < v_t and sqrt((o_x - b_x[k]) ^ 2 + (o_y - b_y[k]) ^ 2) <= b_r[k] then raise exception '%', bad; end if;
      end loop;
      b_ids := b_ids || v_id; b_x := b_x || o_x; b_y := b_y || o_y; b_r := b_r || o_blast; b_t := b_t || v_t;
      prev_bt := v_t;
    end loop;

    earned := 0; prev_t := 0; seen := '{}';
    for c in select e.value from jsonb_array_elements(lv -> 'catches') with ordinality as e(value, idx) order by e.idx loop
      if jsonb_typeof(c -> 'id') is distinct from 'number' or jsonb_typeof(c -> 't') is distinct from 'number'
         or (c ->> 'id') !~ '^[0-9]{1,2}$' then
        raise exception '%', bad;
      end if;
      v_id := (c ->> 'id')::int;
      v_t := (c ->> 't')::numeric;
      v_points := null;
      select o.points, o.speed_mul, o.travel, o.x, o.y, o.blast into v_points, v_mul, v_travel, o_x, o_y, o_blast
      from games.goldhook_objects o where o.level = i and o.id = v_id;
      if v_points is null or o_blast > 0 or v_id = any (seen) or v_t <= 0 or v_t > v_seconds + 0.001 or v_t < prev_t then
        raise exception '%', bad;
      end if;
      for k in 1 .. coalesce(array_length(b_t, 1), 0) loop
        if v_t > b_t[k] and sqrt((o_x - b_x[k]) ^ 2 + (o_y - b_y[k]) ^ 2) <= b_r[k] then raise exception '%', bad; end if;
      end loop;
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
