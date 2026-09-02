/* ── gallery assets ─────────────────────────────────────────────────────────
   The cards in the cloudline carousel.

   These shots were the quick-bites story player's slides until that player was
   removed. They are the work itself, so they now ride the carousel instead of
   sitting behind a pill that had to be pressed to find them. The eight
   procedural artworks that used to live here came from the reference file and
   were only ever standing in for real work — they are gone with it.

   The carousel wraps over N * STEP world units, and roughly fifteen units are
   on screen at once. Three shots would make the loop 17.6 units, so a card
   would slide back into frame almost as soon as it left. Tripling the set puts
   the repeat at 52.9 units and a full screen between one shot and its next
   instance, which is what keeps the loop from reading as a loop. The textures
   are cached per src, so the three files are decoded once however many times
   they appear. */

const WORK = [
  { src: 'images/bite-cash-ledger.jpg',
    label: 'Three phone screens showing a driver cash-balance ledger in green, amber and red states, each with a deposit prompt' },
  { src: 'images/bite-prompt-logs.jpg',
    label: 'Two views of a prompt-ops console for an airline support agent — a filtered run log with success, failure and pending states, and a trace timeline opened to one span’s input, output and metadata' },
  { src: 'images/bite-routing-config.jpg',
    label: 'Two payment routing setup screens — a volume-based configuration splitting traffic across Adyen, Stripe and Authorize.net by percentage, and a rule-based builder with conditions and fallback routing' }
];

const PROJECTS = WORK.concat(WORK, WORK);

export { PROJECTS, WORK };
