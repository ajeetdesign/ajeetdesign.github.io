/* ══════════════════════════════════════════════════════════════════════
   ANALYTICS — a tiny, provider-agnostic event wrapper.

   Every call site on the site calls track(name, props); swapping analytics
   providers later means editing the three lines below, not every call
   site. See the Analytics Event Plan for what fires where and why.

   Wired to Plausible today. The two-line stub is Plausible's own
   documented pattern: it defines window.plausible as a queue SYNCHRONOUSLY,
   before the real script (loaded `defer`, elsewhere in <head>) has finished
   loading — so a track() call made during page parse is queued and flushed
   once the real script arrives, rather than silently dropped because
   window.plausible didn't exist yet. If the real script never loads at all
   (ad-blocked, or no Plausible account registered for this domain yet),
   calls just queue forever and go nowhere — no error, nothing visible to a
   visitor.

   data-domain on the script tag in each page's <head> has to match exactly
   what's registered in Plausible. The site is served from the custom
   domain in CNAME — www.ajeet.work. Change it in all three places
   (index.html, about.html, case.html) together if the domain changes. */
window.plausible = window.plausible || function () {
  (window.plausible.q = window.plausible.q || []).push(arguments);
};
window.track = function (name, props) {
  try { window.plausible(name, props ? { props: props } : undefined); } catch (e) {}
};
