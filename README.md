# Runtime Ledger

An irrigation tune-up and water-usage audit tool. Walk a property zone by
zone, record heads/nozzles/schedule/condition, and get gallons-per-zone and
gallons-per-property totals plus a printable client report.

## What's in this version

- Properties and visits saved to a real cloud database (Firebase Firestore) --
  works across your own devices, not just one browser.
- Full zone walkthrough: schedule (with multiple run cycles for cycle-soak
  systems), head/nozzle groups with a built-in flow lookup table, soil/sun/
  slope, an issue checklist (severity + fixed-today/needs-follow-up), an
  overall valve condition check, and a backflow-preventer/filter check.
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

## File map

- `index.html` -- page shell
- `styles.css` -- all visual styling
- `firebase-init.js` -- Firebase project connection + anonymous sign-in
- `db.js` -- reading/writing properties and visits in Firestore
- `nozzles.js` -- the built-in nozzle/head flow lookup tables and dropdown
  option lists (edit this file to add nozzle models or adjust flow values)
- `calc.js` -- all the math (GPM, gallons, flags) -- no UI code
- `app.js` -- the actual app: screens, forms, and button behavior
- `firestore.rules` -- paste into the Firebase console; not used by the
  website directly
