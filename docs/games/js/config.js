// PEP Games connection settings. Both values are PUBLIC by design (anyone can see them in the browser);
// the data is protected by database policies and server functions, not by hiding these keys.
// With both empty there is no server: only "Play vs bot" works and the lobby says multiplayer is coming soon.
// NEVER put a "secret" or "service_role" key here.
window.PEP_GRY = {
  supabaseUrl: 'https://azbwciqfbsdpwubznncg.supabase.co',
  supabaseKey: 'sb_publishable_GRByiqlX6v67phR8xcM6VA_6eXXwTKX',
  discord: false,    // switch to true once Discord login is set up in Supabase
};
