/* Blog back end. Leave both empty to run the blog in demo mode (posts stay in the browser).
   Fill in from Supabase: Project settings > API. The anon key is public by design; every table is protected by RLS. */
window.IMRC_BLOG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  // Cloudflare Turnstile SITE key (public). The SECRET key goes in Supabase: Auth > Attack Protection > CAPTCHA.
  turnstileSiteKey: ""
};
