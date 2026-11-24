// Nami's Supabase project, for the Reads pages and the article editor.
// The publishable key is the public one that already ships inside the app:
// it can only do what the database's row level security allows anyone to
// do (read published articles, sign in). It is not the secret key.
window.NAMI_CONFIG = {
  supabaseUrl: "https://kqvizwbvbhzjixzrptqx.supabase.co",
  publishableKey: "sb_publishable_WwWOY2lUJH12GG7EV6Swsw_yt2IrgST",
  // The site's own address: namiarticles.meliolabs.io once that is set up,
  // and the GitHub address before then (which forwards there afterwards).
  site: location.hostname === "meliodeveloper.github.io"
    ? "https://meliodeveloper.github.io/nami-privacy"
    : location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? location.origin + (location.pathname.startsWith("/nami-privacy/") ? "/nami-privacy" : "")
    : "https://namiarticles.meliolabs.io",
  // Every address the Reads pages have had, so a link to an article written
  // with any of them stays inside the site.
  sites: ["https://namiarticles.meliolabs.io", "https://meliodeveloper.github.io/nami-privacy"],
  appStore: "https://apps.apple.com/gb/app/id6761417773"
};
