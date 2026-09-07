/* ── gallery assets ─────────────────────────────────────────────────────────
   The cards in the cloudline carousel.

   These shots were the quick-bites story player's slides until that player was
   removed. They are the work itself, so they now ride the carousel instead of
   sitting behind a pill that had to be pressed to find them. The eight
   procedural artworks that used to live here came from the reference file and
   were only ever standing in for real work — they are gone with it.

   Each shot ships in TWO variants, because the two surfaces want opposite
   things from the same asset:

     src    — the full composition, 2048x1152, exactly the texture canvas
              curved-gallery.js draws into (a 1:1 pixel match, nothing resampled
              on the way to the card). The carousel is a browsing surface: the
              card is only ~637 CSS px wide and nobody reads UI at that size, so
              it shows the shot as composed, backdrop and all.
     detail — the same shot cropped to its UI, 1920x1080, for the modal. That is
              where the work is actually looked at, and there the backdrop is
              just dead space pushing the product smaller. Cropping buys
              1.06–1.38x depending on how much air the export carried.

   Both are 16:9 and must stay that way: the card geometry is 16:9, so anything
   else is silently cover-cropped, and .bitm-shot boxes the modal at 16:9 too.
   Only `src` is loaded up front (lazily, when the leg approaches); a `detail`
   is fetched when its card is opened, so the second set costs a visitor
   nothing unless they click.

   Order alternates desktop and mobile so no two neighbours read as the same
   shape, and spreads the backdrops rather than running the cool ones together.

   The carousel wraps over N * STEP world units, and roughly fifteen units are
   on screen at once. Three shots made the loop 17.6 units, so a card slid back
   into frame almost as soon as it left, and the set had to be tripled to push
   the repeat out. Eight put it at 47 units on their own — over two screens
   between one shot and its next instance — so the padding is gone. */

const WORK = [
  { src: 'images/bite-prompt-ops.jpg?v=3',
    detail: 'images/bite-prompt-ops-detail.jpg?v=1', title: 'Prompt Ops',
    label: 'A prompt-ops console for an airline support agent — a run log filtered down to success, failure and pending states, beside a trace timeline opened to one span’s input, output and metadata' },
  { src: 'images/bite-booking-flow.jpg?v=3',
    detail: 'images/bite-booking-flow-detail.jpg?v=1', title: 'Booking Flow',
    label: 'Three screens from a logistics booking flow — vehicle categories and rewards on the home screen, a picker comparing capacity, price and pickup time, and a review step carrying loading help and proof-of-delivery add-ons' },
  { src: 'images/bite-call-audits.jpg?v=3',
    detail: 'images/bite-call-audits-detail.jpg?v=1', title: 'Call Audits',
    label: 'A call-audit template builder — the violations a template watches for, scoring rules for non-critical and not-applicable answers, the escalation each violation triggers, and the teams it applies to' },
  { src: 'images/bite-loan-offers.jpg?v=3',
    detail: 'images/bite-loan-offers-detail.jpg?v=1', title: 'Loan Offers',
    label: 'Three screens from an in-app lending journey — the offer splash naming its participating lenders, a bank-statement step offering account-aggregator consent instead of a manual upload, and three EMI offers compared side by side' },
  { src: 'images/bite-lender-config.jpg?v=3',
    detail: 'images/bite-lender-config-detail.jpg?v=1', title: 'Lender Config',
    label: 'A lending console for lead distribution — active lenders ranked by drag with their share of leads, the inactive ones waiting to be switched on, and a primer on what a soft integration changes before it is turned on' },
  { src: 'images/bite-coin-rewards.jpg?v=3',
    detail: 'images/bite-coin-rewards-detail.jpg?v=1', title: 'Coin Rewards',
    label: 'Three screens turning earned coins into gift cards — a catalogue browsable by category, a purchase sheet with preset and custom amounts against a coin balance, and the redeemed card with its code and PIN' },
  { src: 'images/bite-connector-setup.jpg?v=3',
    detail: 'images/bite-connector-setup-detail.jpg?v=1', title: 'Connector Setup',
    label: 'A four-step wizard for connecting a payment processor — credentials, webhooks, payment methods and a summary — with each field explained at the point it is asked for' },
  { src: 'images/bite-checkout-sdk.jpg?v=3',
    detail: 'images/bite-checkout-sdk-detail.jpg?v=1', title: 'Checkout SDK',
    label: 'A drop-in checkout in two themes — a light sheet grouping card entry, wallets, pay-later and crypto by type, and a dark variant leading with express wallets above the shopper’s saved cards' }
];

const PROJECTS = WORK;

export { PROJECTS, WORK };
