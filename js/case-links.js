/* Where each case study currently lives — declared here and nowhere else.

   A key in this table means the write-up is still hosted outside this site:
     · index.html points that project's card straight at the URL, opens it in a
       new tab, and swaps the arrow for the leaves-the-site glyph
     · case.html redirects anyone who reaches its internal URL to the same place
   so a project has exactly one destination however a reader arrives at it.

   No key means the study is internal: it renders from cases.enc.json in the
   overlay, the way Porter does. Bringing one in-house is therefore a one-line
   change — delete its line here, and both pages re-wire themselves. Nothing
   else in either file names these URLs, so there is no second copy to drift.

   Loaded as a plain script before the wiring in both pages, so it has to stay
   an ordinary global rather than a module export.

   Keys must match the data-case attribute on the card in index.html and the
   ?id= parameter case.html reads:
     porter               — internal, renders from cases.enc.json
     porter-uae-earnings  — no internal study exists
     porter-uae-cash      — no internal study exists
     juspay               — internal, renders from cases.enc.json

   WARNING while this table is empty: the two porter-uae cards point at ids that
   cases.enc.json does not carry, and case.html falls back to the Porter study
   for an id it does not recognise. So until their URLs are filled in below,
   clicking card 02 or 03 opens the Porter case study. Adding their lines fixes
   it — the redirect fires before the fallback is ever reached. */
window.CASE_LINKS = {
  /* Awaiting the live URLs. Add as:
       'porter-uae-earnings': 'https://…',
       'porter-uae-cash':     'https://…',
       juspay:                'https://…', */
};
