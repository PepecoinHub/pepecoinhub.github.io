import fs from 'node:fs';import path from 'node:path';
// Only host/account scaffolding is fictional. Install the actual PH chat/me
// RPC bodies, so mutes, hidden messages, text limits and grading run in SQL.
export function chatFixture(source){
 const pick=(file,name)=>{const text=fs.readFileSync(path.join(source,file),'utf8'),start=text.indexOf('create or replace function public.'+name+'('),end=text.indexOf('end $$;',start);if(start<0||end<0)throw Error('Missing PH RPC fixture: '+name);return text.slice(start,end+7);};
 return `
 alter table games.profiles add column nick_key text generated always as (lower(nick)) stored;
 alter table games.profiles add column discord_id text default 'fixture-discord';
 alter table games.lobby_chat add column ip_hash text;
 alter table games.lobby_mutes add column reason text;
 create table games.lobby_ip_mutes(ip_hash text primary key,until timestamptz,reason text);
 create function games.client_ip_hash() returns text language plpgsql stable as $$declare hd json;begin begin hd:=nullif(current_setting('request.headers',true),'')::json;exception when others then hd:=null;end;return nullif(hd->>'cf-connecting-ip','');end$$;
 create function games.is_host_user(u uuid) returns boolean language sql as $$select false$$;
 create function games.lobby_cleanup() returns void language sql as $$select$$;
 create function games.nick_key(t text) returns text language sql as $$select lower(t)$$;
 create function games.norm(t text) returns text language sql as $$select lower(regexp_replace(t,'[^a-zA-Z0-9]','','g'))$$;
 create function games.clean_text(t text) returns text language sql as $$select t$$;
 ${pick('games/supabase/schema.sql','gry_me')}
 ${pick('games/supabase/update_open_chat.sql','gry_lobby_chat')}
 ${pick('games/supabase/update_open_chat.sql','gry_lobby_say')}
 ${pick('games/supabase/update_lobby_who.sql','gry_lobby_who')}
 `;
}
