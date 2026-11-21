-- Haze mobile test, step 2: lewisbong can also link a wallet and send a direct PEP tip from the iOS app.
-- Still limited to the same account (allowed_users unchanged) and the https return address. Web stays open.
-- Scopes are fixed at consent: Lew must disconnect and reconnect Discord in HazeWallet afterwards.
update games.community_clients
set scopes = array['profile:read','chat:read','chat:write','wallet:link','tips:read','tips:write']
where id = 'haze-native';
select id, enabled, scopes, allowed_users, redirect_uri from games.community_clients where id = 'haze-native';
