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

   `src` is 16:9 and must stay that way — the card geometry is 16:9, so anything
   else is silently cover-cropped by paint().

   `detail` no longer has to be. A card may carry `ratio` (e.g. '4 / 3'), which
   index.html sets on .bitm-shot when the card opens; without it the modal falls
   back to 16:9 and the card renders exactly as it always did. That is what lets
   the deck migrate one bite at a time. 4:3 exists because the modal panel is
   much taller than a 16:9 box in that column — a 16:9 detail leaves the bottom
   third of the card empty. NOT 1:1: the shot's width is fixed by the grid, so a
   square frame cannot make the UI bigger, it only trades backdrop for nothing.

   `year` and `company` render as a small uppercase tag above the modal title
   (`YEAR · COMPANY`). Both are optional and either may be empty — the line
   hides itself rather than showing a stray separator — so a bite with no
   attribution simply has none.

   Bites composed from separate background + transparent-UI sources are built by
   `compose-bites.py` at the repo root, which writes both variants from one pair
   of files. Bites still on a single flat export keep their old 16:9 `detail`.
   Only `src` is loaded up front (lazily, when the leg approaches); a `detail`
   is fetched when its card is opened, so the second set costs a visitor
   nothing unless they click.

   ORDER IS CHRONOLOGICAL, newest first — 2026 down to 2021. That is the spine;
   do not resort on any other basis.

   Where two bites share a year the tie is broken to alternate desktop and
   mobile, so no two neighbours read as the same shape. 2023 and 2022 are both
   pairs, and using them that way takes the same-shape adjacencies from four
   down to two (the 2026/2025-26 pair at the head and the lone 2021 at the
   tail, neither of which has a partner to swap with). The carousel loops, so
   the last card neighbours the first.

   The carousel wraps over N * STEP world units, and roughly fifteen units are
   on screen at once. Three shots made the loop 17.6 units, so a card slid back
   into frame almost as soon as it left, and the set had to be tripled to push
   the repeat out. Eight put it at 47 units on their own — over two screens
   between one shot and its next instance — so the padding is gone. */

const WORK = [
  { src: 'images/bite-coin-rewards.jpg?v=5',
    detail: 'images/bite-coin-rewards-detail.jpg?v=3', ratio: '4 / 3', year: '2026', company: 'Porter', title: 'Porter Coin redemption program using Vouchers',
    label: 'Designed a gift card redemption experience for the Booker persona, enabling users to redeem Porter Coins across 20+ brands. The feature saw meaningful uptake among Bookers, creating a new way for customers to turn their accumulated Coins into rewards.' },
  { src: 'images/bite-booking-flow.jpg?v=5',
    detail: 'images/bite-booking-flow-detail.jpg?v=3', ratio: '4 / 3', year: '2025-26', company: 'Porter', title: 'Reimagined the Porter Customer App',
    label: 'Reimagined the customer app using our new design system, while working within the constraint of not creating any new APIs. The redesign improved booking flow conversion, reduced the time taken to search for locations, improved signup conversion, and increased the addition of value-added services.' },
  { src: 'images/bite-prompt-ops.jpg?v=5',
    detail: 'images/bite-prompt-ops-detail.jpg?v=3', ratio: '4 / 3', year: '2025', company: 'Design task', title: 'Filters for logs and span',
    label: 'A prompt-ops console for an airline support agent — a run log filtered down to success, failure and pending states, beside a trace timeline opened to one span’s input, output and metadata' },
  { src: 'images/bite-checkout-sdk.jpg?v=5',
    detail: 'images/bite-checkout-sdk-detail.jpg?v=3', ratio: '4 / 3', year: '2023', company: 'Juspay', title: 'Multi platform SDK for Payments',
    label: 'Designed a scalable Checkout SDK for merchants across Android, iOS, and web. Built as an experience optimised kit, it allows merchants to enable their preferred payment methods and deliver a consistent checkout experience across platforms.' },
  { src: 'images/bite-connector-setup.jpg?v=5',
    detail: 'images/bite-connector-setup-detail.jpg?v=3', ratio: '4 / 3', year: '2023', company: 'Juspay', title: 'Improved payment connectors setup',
    label: 'A four-step wizard for connecting a payment processor — credentials, webhooks, payment methods and a summary — with each field explained at the point it is asked for' },
  { src: 'images/bite-loan-offers.jpg?v=5',
    detail: 'images/bite-loan-offers-detail.jpg?v=3', ratio: '4 / 3', year: '2022', company: 'Juspay', title: 'Increased conversion of credit SDK',
    label: 'Three screens from an in-app lending journey — the offer splash naming its participating lenders, a bank-statement step offering account-aggregator consent instead of a manual upload, and three EMI offers compared side by side' },
  { src: 'images/bite-lender-config.jpg?v=5',
    detail: 'images/bite-lender-config-detail.jpg?v=3', ratio: '4 / 3', year: '2022', company: 'Juspay', title: 'Merchant Lenders configuration on FinOps',
    label: 'A lending console for lead distribution — active lenders ranked by drag with their share of leads, the inactive ones waiting to be switched on, and a primer on what a soft integration changes before it is turned on' },
  { src: 'images/bite-call-audits.jpg?v=5',
    detail: 'images/bite-call-audits-detail.jpg?v=3', ratio: '4 / 3', year: '2021', company: 'Convin.ai', title: 'Improved AI call audit process for Convin',
    label: 'A call-audit template builder — the violations a template watches for, scoring rules for non-critical and not-applicable answers, the escalation each violation triggers, and the teams it applies to' }
];

const PROJECTS = WORK;

export { PROJECTS, WORK };
