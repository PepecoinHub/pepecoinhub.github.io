// PEP Games connection settings. Both values are PUBLIC by design (anyone can see them in the browser);
// the data is protected by database policies and server functions, not by hiding these keys.
// Leave both empty to run without a server: only "Play vs bot" works and the lobby says multiplayer is coming soon.
// NEVER put a "secret" or "service_role" key here.
window.PEP_GRY = {
  supabaseUrl: '',   // e.g. 'https://abcdefghijkl.supabase.co'
  supabaseKey: '',   // e.g. 'sb_publishable_...'
  discord: false,    // switch to true once Discord login is set up in Supabase
};
