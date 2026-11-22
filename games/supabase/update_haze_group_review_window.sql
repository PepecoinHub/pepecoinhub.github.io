-- Fix: "This group review is invalid or expired" in Haze for long airdrops (2026-11-22).
-- Airdrops longer than 10 minutes give the host 12 hours to review, but Haze accepts a review valid for at most
-- ~31 minutes. Each review now gets its own 30-minute window inside the host's deadline. Safe to run again.
-- Run in Supabase SQL Editor (one Run). Same function as in update_haze_groups.sql.
create or replace function public.gry_haze_group_review(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=games.haze_groups_require_user();g games.haze_groups;
begin
 select * into g from games.haze_groups where id=p_id and owner=u for update;
 if not found then raise exception 'Only the host can review this payout.';end if;
 perform games.haze_group_seal(p_id);select * into g from games.haze_groups where id=p_id;
 if g.state<>'ready' or g.submitted_txid is not null or g.expires_at<=clock_timestamp() then raise exception 'This payout is not ready, expired, or already submitted. Follow its status in chat.';end if;
 -- Haze accepts a review that is valid for at most ~31 minutes. Long airdrops give the host 12 hours, so each review
 -- gets its own 30-minute window inside that deadline; the stored window (used by group-check) is unchanged.
 return games.haze_group_manifest(p_id)||jsonb_build_object(
   'created_at',date_trunc('milliseconds',clock_timestamp()-interval '30 seconds'),
   'expires_at',least(g.expires_at,date_trunc('milliseconds',clock_timestamp()+interval '30 minutes')));
end $$;
