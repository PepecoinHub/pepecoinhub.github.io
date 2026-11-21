-- Haze community install, part 4 of 5. Run IN ORDER after the tip/group SQL. Repeatable; everything stays OFF.
begin;
create or replace function public.community_v1_rpc(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m text:=p_args->>'method';a jsonb:=coalesce(p_args->'args','{}'::jsonb);required text;fields text[];s games.community_sessions;r jsonb;
begin
 required:=case m when 'gry_me' then 'profile:read' when 'gry_lobby_chat' then 'chat:read' when 'gry_lobby_who' then 'chat:read' when 'gry_lobby_say' then 'chat:write'
 when 'gry_haze_status' then 'tips:read' when 'gry_haze_chat' then 'tips:read' when 'gry_haze_link_begin' then 'wallet:link' when 'gry_haze_tip_begin' then 'tips:write'
 when 'gry_haze_groups' then 'groups:read' when 'gry_haze_group_create' then 'groups:write' when 'gry_haze_group_join' then 'groups:write' when 'gry_haze_group_review' then 'groups:write' when 'gry_haze_group_cancel' then 'groups:write' else null end;
 if required is null then raise exception 'Method is outside community-v1.';end if;
 fields:=case m when 'gry_lobby_chat' then array['p_after','p_visitor'] when 'gry_lobby_who' then array['p_visitor'] when 'gry_lobby_say' then array['p_text','p_nick']
 when 'gry_haze_chat' then array['p_messages'] when 'gry_haze_tip_begin' then array['p_message','p_amount','p_reaction','p_note'] when 'gry_haze_group_create' then array['p_options']
 when 'gry_haze_group_join' then array['p_id'] when 'gry_haze_group_review' then array['p_id'] when 'gry_haze_group_cancel' then array['p_id'] else array[]::text[] end;
 if not games.community_v1_keys(a,fields) then raise exception 'Unsupported community arguments.';end if;
 s:=games.community_v1_context(p_args->>'access_hash',p_args->>'origin',required);perform games.community_v1_budget(s.user_id);
 begin
 -- Existing PH RPCs see only the verified token owner's identity, with no host
 -- or service-role claims supplied by the client. No arbitrary SQL/function name.
 -- No caller network: every community request reaches PostgREST from PH's Edge egress IP, shared by all Haze
 -- users. Without this, an IP-based chat mute (blocked words, host mute) of one user would silence all of them
 -- and every message would carry the same ip_hash. Moderation stays per account (lobby_mutes by user_id).
 perform set_config('request.headers','{}',true);
 perform set_config('request.jwt.claim.sub',s.user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',s.user_id::text,'role','authenticated')::text,true);
 case m
 when 'gry_me' then r:=public.gry_me();
 when 'gry_lobby_chat' then r:=public.gry_lobby_chat(coalesce((a->>'p_after')::bigint,0),a->>'p_visitor');
 when 'gry_lobby_who' then r:=public.gry_lobby_who(a->>'p_visitor');
 when 'gry_lobby_say' then r:=public.gry_lobby_say(a->>'p_text',a->>'p_nick');
 when 'gry_haze_status' then r:=public.gry_haze_status();
 when 'gry_haze_link_begin' then r:=public.gry_haze_link_begin();
 when 'gry_haze_chat' then r:=public.gry_haze_chat(array(select jsonb_array_elements_text(a->'p_messages')::bigint));
 when 'gry_haze_tip_begin' then r:=public.gry_haze_tip_begin((a->>'p_message')::bigint,a->>'p_amount',a->>'p_reaction',a->>'p_note');
 when 'gry_haze_groups' then r:=public.gry_haze_groups();
 when 'gry_haze_group_create' then r:=public.gry_haze_group_create(a->'p_options');
 when 'gry_haze_group_join' then r:=public.gry_haze_group_join((a->>'p_id')::uuid);
 when 'gry_haze_group_review' then r:=public.gry_haze_group_review((a->>'p_id')::uuid);
 when 'gry_haze_group_cancel' then r:=public.gry_haze_group_cancel((a->>'p_id')::uuid);
 end case;
 exception when others then return jsonb_build_object('__community_error',SQLERRM);
 end;
 return r;
end $$;
create or replace function public.community_v1_verify(p_args jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m text:=p_args->>'method';a jsonb:=p_args->'args';required text;fields text[];s games.community_sessions;
begin
 required:=case m when 'haze_link_context' then 'wallet:link' when 'haze_link_finish' then 'wallet:link'
 when 'haze_tip_context' then 'tips:read' when 'haze_tip_confirm' then 'tips:read'
 when 'haze_group_context' then 'groups:read' when 'haze_group_confirm' then 'groups:read' else null end;
 fields:=case m when 'haze_link_context' then array['p_nonce'] when 'haze_link_finish' then array['p_nonce','p_address']
 when 'haze_tip_context' then array['p_intent','p_txid'] when 'haze_group_context' then array['p_intent','p_txid']
 when 'haze_tip_confirm' then array['p_intent','p_txid','p_vout','p_block','p_time'] when 'haze_group_confirm' then array['p_intent','p_txid','p_block','p_time'] else array[]::text[] end;
 if required is null or not games.community_v1_keys(a,fields) then raise exception 'Unsupported community verification.';end if;
 s:=games.community_v1_context(p_args->>'access_hash',p_args->>'origin',required);perform games.community_v1_budget(s.user_id);
 begin
 case m
 when 'haze_link_context' then return public.haze_link_context(s.user_id,a->>'p_nonce');
 when 'haze_link_finish' then return public.haze_link_finish(s.user_id,a->>'p_nonce',a->>'p_address');
 when 'haze_tip_context' then return public.haze_tip_context(s.user_id,(a->>'p_intent')::uuid,a->>'p_txid');
 when 'haze_tip_confirm' then return public.haze_tip_confirm(s.user_id,(a->>'p_intent')::uuid,a->>'p_txid',(a->>'p_vout')::integer,a->>'p_block',(a->>'p_time')::bigint);
 when 'haze_group_context' then return public.haze_group_context(s.user_id,(a->>'p_intent')::uuid,a->>'p_txid');
 when 'haze_group_confirm' then return public.haze_group_confirm(s.user_id,(a->>'p_intent')::uuid,a->>'p_txid',a->>'p_block',(a->>'p_time')::bigint);
 end case;
 exception when others then return jsonb_build_object('__community_error',SQLERRM);
 end;
end $$;
commit;
