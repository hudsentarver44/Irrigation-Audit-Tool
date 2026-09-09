# Runtime Ledger

An irrigation tune-up and water-usage audit tool. Walk a property zone by
zone, record heads/nozzles/schedule/condition, and get gallons-per-zone and
gallons-per-property totals plus a printable client report.

## What's in this version

- Properties and visits saved to a real cloud database (Firebase Firestore) --
  works across your own devices, not just one browser.
- Full zone walkthrough: schedule (with multiple run cycles for cycle-soak
  systems), head/nozzle groups, soil/sun/slope, an issue checklist
  (severity + fixed-today/needs-follow-up), an overall valve condition
  check, and a single backflow-preventer/filter check (same 3 states --
  Present/Missing/Leaking -- regardless of culinary vs. secondary water).
- Head entry is brand-aware: pick the head type (rotor/spray/rotary), then
  the actual brand/model on the ground (Hunter, Rain Bird, K-Rain, Toro),
  then the specific nozzle -- each with its own real published GPM, radius,
  and rated pressure, so the flow math reflects what's actually installed
  instead of a generic guess. See `nozzles.js` for the full data and its
  source notes.
- If you enter the visit's static pressure reading, every head's GPM is
  adjusted for that actual field pressure (not just the nozzle's catalog
  rating), using the standard square-root pressure/flow relationship.
  Leave it blank to use each nozzle's rated GPM as-is.
- Rotor GPM does not change when you adjust arc (a gear-driven rotor has
  one continuously-rotating stream -- arc changes coverage, not flow).
  Spray and rotary/MP-style nozzles genuinely do flow less at a smaller
  arc, so those scale as expected.
- Automatic flags: mismatched head types sharing a zone, and a
  severely-over/under-watering flag based on a rough zone-size estimate (no
  measuring required).
- A printable, client-facing report per visit. "PDF" = your browser's own
  Print -> Save as PDF, so no extra software is needed.

## Not in this version yet (on purpose)

- **Photos** -- deferred until Firebase Storage (and its billing plan) is
  turned on. Adding it later is a small, additive change.
- **Real technician logins** -- right now technician is just a free-text
  name per visit. The data already has a place for it, so adding real
  accounts later doesn't require restructuring anything.
- **Distribution uniformity / catch-cup testing** -- not planned.

## One-time setup (you've likely already done most of this)

1. Firebase project created, with **Firestore** and **Anonymous
   Authentication** turned on (console.firebase.google.com).
2. Paste the contents of `firestore.rules` (in this repo) into Firebase
   console -> Firestore Database -> Rules -> publish. Without this, reads
   and writes will fail.
3. GitHub Pages turned on for this repo (Settings -> Pages -> Deploy from a
   branch -> `main` / `/ (root)`). Needs at least one commit to exist first.
4. Your Firebase web config lives in `firebase-init.js`. It's fine that
   it's visible in the code -- these values are meant to be public. Real
   protection is the Firestore rules from step 2.

## Making changes later

This is plain HTML/CSS/JavaScript -- no build step. Edit a file, upload it
to this repo (GitHub's "Add file -> Upload files," or edit directly in the
browser with the pencil icon on a file), and GitHub Pages republishes
automatically within a minute or two.

## Branding

Colors, fonts, and the logo in the top bar/report are matched to
stormsprinklers.com: navy (`#102341`) for headers and structural text,
coral pink (`#f17388`) for primary buttons, with sky blue and light grey as
supporting accents -- all as CSS variables at the top of `styles.css`, so a
brand refresh later just means changing values in one place. The status
colors (good/warn/urgent -- green/amber/red) are left alone on purpose,
since those need to read as "ok / caution / problem" regardless of brand.
`storm-logo.png` is the logo file shown in the top bar and on the printed
report; swap that file (same name) to update it.

## File map

- `index.html` -- page shell
- `styles.css` -- all visual styling, including the brand color/font variables
- `storm-logo.png` -- the logo shown in the top bar and printed report
- `firebase-init.js` -- Firebase project connection + anonymous sign-in
- `db.js` -- reading/writing properties and visits in Firestore
- `nozzles.js` -- the built-in nozzle/head flow lookup tables (by head type
  -> brand -> nozzle) and dropdown option lists. Edit this file to add
  nozzle models, add a brand, or adjust a flow/pressure/radius value. A
  comment at the top of the file flags which brands' numbers come from
  clean multi-point manufacturer charts vs. which (mainly Toro, and
  K-Rain's ranged charts) are best-effort estimates worth double-checking
  against the manufacturer's own spec sheet if precision matters for a
  specific job.
- `calc.js` -- all the math (GPM, gallons, flags) -- no UI code
- `app.js` -- the actual app: screens, forms, and button behavior
- `firestore.rules` -- paste into the Firebase console; not used by the
  website directly
