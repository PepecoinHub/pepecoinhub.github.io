# Start bety Fren Passport (czwartek 12 XI 2026)

Wklejaj w Supabase → SQL Editor → **New query**, każdy plik osobno, **dokładnie w tej kolejności**:

1. `1_season.sql`: data startu sezonu (poniedziałek 16 XI, 00:00 czasu polskiego)
2. `2_passport.sql`: paszport
3. `3_avatar.sql`: kreator awatarów
4. `4_public.sql`: podgląd paszportów innych graczy
5. `5a_awards.sql` → `5b_awards.sql` → `5c_awards.sql` → `5d_awards.sql`: stemple (cztery części jednego pliku)

Jeśli Supabase pokaże „Potential issues detected”, wybierz **Run and enable RLS**.

Każdy plik można bezpiecznie odpalić drugi raz (np. gdy coś przerwało wklejanie).

## Co się dzieje

- **Beta (czw–ndz):** serwer daje tylko **Pond Pioneer**: każdemu, kto ma Discorda w chwili odpalenia 5d, i każdemu, kto do niedzieli 23:59 otworzy PondOS zalogowany Discordem. Nic innego się nie liczy: stemple, sekrety, serie dni, liczniki.
- **Poniedziałek 00:00:** wszystko rusza samo, nie trzeba nic odpalać. Wszyscy startują od zera: stare rekordy (YEET, listy, dni w Guesserze, wyniki arcade) nie dają stempli.
- **Frog of the Week:** pierwszy tydzień liczony to 16–22 XI. Remis na szczycie = brak zwycięzcy.
- Jeśli wcześniej były wgrane testowe wersje tych plików, 5d czyści zapisane stemple i sekrety (zostawia Pond Pioneer i zapisane wyglądy awatarów).

## Sprawdzenie po wszystkim

```sql
select games.passport_open() as sezon_otwarty,
       (select count(*) from games.passport_badges where badge_id = 'pond_pioneer') as pioneerow;
```

W becie `sezon_otwarty` ma być `false`, a `pioneerow` > 0.

Ten folder to kopie plików `update_passport_season.sql`, `update_fren_passport.sql`, `update_fren_avatar.sql`, `update_passport_public.sql` i `update_passport_awards.sql` (ostatni podzielony na 4 części).
