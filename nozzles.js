// nozzles.js
// Built-in nozzle/head flow lookup tables, keyed by head type -> brand ->
// nozzle. Values come from published manufacturer nozzle-performance charts
// at (or near) each product line's own recommended/rated pressure -- not
// measured values. Every head can still be overridden by hand in the field.
//
// Data confidence varies by source document quality:
//  - Hunter PGP Ultra, Rain Bird 5000, Rain Bird 3500, Rain Bird 1800 (MPR),
//    Hunter Pro-Spray, and Rain Bird R-VAN come from clean multi-point
//    manufacturer charts.
//  - K-Rain (Pro Plus rotor + KV spray) charts publish a pressure RANGE
//    (e.g. 30-60 psi) rather than one clean point per pressure, so the GPM
//    values below are a reasonable midpoint estimate, not a verbatim chart
//    row.
//  - Toro rotor (570/T-Series) and Toro spray/rotary figures were the
//    hardest to extract cleanly from Toro's PDFs; they're a best-effort
//    approximation. If a Toro reading looks off in the field, override the
//    head's flow by hand or adjust the numbers below.
//
// GPM scaling rules (see calc.js):
//  - True gear-driven ROTORS have one continuously-rotating stream, so
//    changing the arc changes coverage/precip rate but NOT the nozzle's
//    GPM. Rotor entries have no `referenceArc` and are never arc-scaled.
//  - Fixed SPRAY nozzles and multi-stream ROTARY/MP-style nozzles are
//    manufactured per-arc (more/bigger streams for a bigger arc), so their
//    GPM genuinely is close to proportional to arc size. Their entries
//    store the GPM at a `referenceArc` (360 = full circle) and calc.js
//    scales that down for smaller arcs.
//  - Every nozzle also stores `ratedPsi`, the pressure the chart GPM was
//    measured at. calc.js scales GPM for the visit's measured static
//    pressure using GPM_actual = GPM_rated x sqrt(measuredPsi / ratedPsi),
//    the standard orifice approximation -- not exact, but far closer than
//    ignoring pressure entirely.

export const HEAD_BRANDS = {
  rotor: [
    { id: "hunter-pgp-ultra", label: "Hunter PGP Ultra" },
    { id: "rainbird-5000", label: "Rain Bird 5000" },
    { id: "rainbird-3500", label: "Rain Bird 3500" },
    { id: "krain-proplus", label: "K-Rain Pro Plus" },
    { id: "toro-rotor", label: "Toro rotor (570/T-Series)" },
    { id: "other", label: "Other / not sure" },
  ],
  spray: [
    { id: "hunter-prospray", label: "Hunter Pro-Spray" },
    { id: "rainbird-1800", label: "Rain Bird 1800 series" },
    { id: "krain-spray", label: "K-Rain spray" },
    { id: "toro-spray", label: "Toro spray" },
    { id: "other", label: "Other / not sure" },
  ],
  mp: [
    { id: "hunter-mprotator", label: "Hunter MP Rotator" },
    { id: "rainbird-rvan", label: "Rain Bird R-VAN / Rain Curtain" },
    { id: "toro-precision-rotating", label: "Toro Precision (rotating)" },
    { id: "other", label: "Other / not sure" },
  ],
};

// NOZZLES[headType][brandId] = [{ id, label, gpm, radius, ratedPsi, referenceArc? }]
export const NOZZLES = {
  rotor: {
    "hunter-pgp-ultra": [
      { id: "sr-0.5", label: "#0.5 SR (~18 ft)", gpm: 0.50, radius: 18, ratedPsi: 50 },
      { id: "sr-1.0", label: "#1.0 SR (~18 ft)", gpm: 1.00, radius: 18, ratedPsi: 50 },
      { id: "sr-1.5", label: "#1.5 SR (~25 ft)", gpm: 1.50, radius: 25, ratedPsi: 50 },
      { id: "1.5", label: "#1.5 (~31 ft)", gpm: 1.5, radius: 31, ratedPsi: 45 },
      { id: "2.0", label: "#2.0 (~34 ft)", gpm: 2.0, radius: 34, ratedPsi: 45 },
      { id: "2.5", label: "#2.5 (~35 ft)", gpm: 2.5, radius: 35, ratedPsi: 45 },
      { id: "3.0", label: "#3.0 (~38 ft)", gpm: 3.0, radius: 38, ratedPsi: 45 },
      { id: "4.0", label: "#4.0 (~40 ft)", gpm: 4.0, radius: 40, ratedPsi: 45 },
      { id: "5.0", label: "#5.0 (~42 ft)", gpm: 5.0, radius: 42, ratedPsi: 45 },
      { id: "6.0", label: "#6.0 (~43 ft)", gpm: 6.0, radius: 43, ratedPsi: 45 },
      { id: "8.0", label: "#8.0 (~44 ft)", gpm: 8.0, radius: 44, ratedPsi: 45 },
    ],
    "rainbird-5000": [
      { id: "1.0la", label: "1.0 LA (~29 ft)", gpm: 1.05, radius: 29, ratedPsi: 45 },
      { id: "1.5", label: "1.5 (~35 ft)", gpm: 1.54, radius: 35, ratedPsi: 45 },
      { id: "1.5la", label: "1.5 LA (~31 ft)", gpm: 1.58, radius: 31, ratedPsi: 45 },
      { id: "2.0", label: "2.0 (~37 ft)", gpm: 2.07, radius: 37, ratedPsi: 45 },
      { id: "2.0la", label: "2.0 LA (~32 ft)", gpm: 2.02, radius: 32, ratedPsi: 45 },
      { id: "2.5", label: "2.5 (~37 ft)", gpm: 2.51, radius: 37, ratedPsi: 45 },
      { id: "3.0", label: "3.0 (~40 ft)", gpm: 3.09, radius: 40, ratedPsi: 45 },
      { id: "3.0la", label: "3.0 LA (~35 ft)", gpm: 3.07, radius: 35, ratedPsi: 45 },
      { id: "4.0", label: "4.0 (~42 ft)", gpm: 4.01, radius: 42, ratedPsi: 45 },
      { id: "5.0", label: "5.0 (~45 ft)", gpm: 5.09, radius: 45, ratedPsi: 45 },
      { id: "6.0", label: "6.0 (~46 ft)", gpm: 6.01, radius: 46, ratedPsi: 45 },
      { id: "8.0", label: "8.0 (~47 ft)", gpm: 8.03, radius: 47, ratedPsi: 45 },
    ],
    "rainbird-3500": [
      { id: "0.75", label: "0.75 (~17 ft)", gpm: 0.77, radius: 17, ratedPsi: 45 },
      { id: "1.0", label: "1.0 (~21 ft)", gpm: 1.06, radius: 21, ratedPsi: 45 },
      { id: "1.5", label: "1.5 (~24 ft)", gpm: 1.48, radius: 24, ratedPsi: 45 },
      { id: "2.0", label: "2.0 (~27 ft)", gpm: 1.93, radius: 27, ratedPsi: 45 },
      { id: "3.0", label: "3.0 (~31 ft)", gpm: 3.00, radius: 31, ratedPsi: 45 },
      { id: "4.0", label: "4.0 (~35 ft)", gpm: 4.13, radius: 35, ratedPsi: 45 },
    ],
    "krain-proplus": [
      { id: "0.5", label: "#0.5 (~29 ft)", gpm: 0.65, radius: 29, ratedPsi: 45 },
      { id: "0.75", label: "#0.75 (~30 ft)", gpm: 0.85, radius: 30, ratedPsi: 45 },
      { id: "1.0", label: "#1.0 (~33 ft)", gpm: 1.55, radius: 33, ratedPsi: 45 },
      { id: "2.0", label: "#2.0 (~40 ft)", gpm: 2.85, radius: 40, ratedPsi: 45 },
      { id: "2.5", label: "#2.5 (~39 ft)", gpm: 3.00, radius: 39, ratedPsi: 45 },
      { id: "3.0", label: "#3.0 (~40 ft)", gpm: 4.30, radius: 40, ratedPsi: 45 },
      { id: "4.0", label: "#4.0 (~46 ft)", gpm: 5.15, radius: 46, ratedPsi: 45 },
      { id: "6.0", label: "#6.0 (~47 ft)", gpm: 6.30, radius: 47, ratedPsi: 45 },
      { id: "8.0", label: "#8.0 (~46 ft)", gpm: 9.00, radius: 46, ratedPsi: 45 },
    ],
    "toro-rotor": [
      { id: "2", label: "#2 (~38 ft)", gpm: 1.7, radius: 38, ratedPsi: 50 },
      { id: "3", label: "#3 (~42 ft)", gpm: 2.6, radius: 42, ratedPsi: 50 },
      { id: "4.5", label: "#4.5 (~45 ft)", gpm: 4.3, radius: 45, ratedPsi: 50 },
      { id: "6", label: "#6 (~48 ft)", gpm: 6.2, radius: 48, ratedPsi: 50 },
      { id: "7.5", label: "#7.5 (~50 ft)", gpm: 8.5, radius: 50, ratedPsi: 50 },
      { id: "9", label: "#9 (~53 ft)", gpm: 13.0, radius: 53, ratedPsi: 50 },
    ],
    other: [{ id: "generic", label: "Generic / not sure (~3.0 GPM, 35 ft)", gpm: 3.0, radius: 35, ratedPsi: 45 }],
  },
  spray: {
    "hunter-prospray": [
      { id: "6a", label: "6A (6 ft)", gpm: 1.26, radius: 6, ratedPsi: 30, referenceArc: 360 },
      { id: "8a", label: "8A (8 ft)", gpm: 1.76, radius: 8, ratedPsi: 30, referenceArc: 360 },
      { id: "10a", label: "10A (10 ft)", gpm: 2.00, radius: 10, ratedPsi: 30, referenceArc: 360 },
      { id: "12a", label: "12A (12 ft)", gpm: 2.52, radius: 12, ratedPsi: 30, referenceArc: 360 },
      { id: "15a", label: "15A (15 ft)", gpm: 3.72, radius: 15, ratedPsi: 30, referenceArc: 360 },
      { id: "17a", label: "17A (17 ft)", gpm: 4.60, radius: 17, ratedPsi: 30, referenceArc: 360 },
    ],
    "rainbird-1800": [
      { id: "5f", label: "5F (5 ft)", gpm: 0.41, radius: 5, ratedPsi: 30, referenceArc: 360 },
      { id: "8f", label: "8F (8 ft)", gpm: 1.05, radius: 8, ratedPsi: 30, referenceArc: 360 },
      { id: "10f", label: "10F (10 ft)", gpm: 1.58, radius: 10, ratedPsi: 30, referenceArc: 360 },
      { id: "12f", label: "12F (12 ft)", gpm: 2.60, radius: 12, ratedPsi: 30, referenceArc: 360 },
      { id: "15f", label: "15F (15 ft)", gpm: 3.70, radius: 15, ratedPsi: 30, referenceArc: 360 },
    ],
    "krain-spray": [
      { id: "kv8", label: "KV-8 (8 ft)", gpm: 2.30, radius: 8, ratedPsi: 30, referenceArc: 360 },
      { id: "kv10", label: "KV-10 (12 ft)", gpm: 3.50, radius: 12, ratedPsi: 30, referenceArc: 360 },
      { id: "kv12", label: "KV-12 (13 ft)", gpm: 3.90, radius: 13, ratedPsi: 30, referenceArc: 360 },
      { id: "kv15", label: "KV-15 (16 ft)", gpm: 5.30, radius: 16, ratedPsi: 30, referenceArc: 360 },
      { id: "kv17", label: "KV-17 (17 ft)", gpm: 5.40, radius: 17, ratedPsi: 30, referenceArc: 360 },
    ],
    "toro-spray": [
      { id: "p5", label: "5 ft radius", gpm: 0.41, radius: 5, ratedPsi: 30, referenceArc: 360 },
      { id: "p8", label: "8 ft radius", gpm: 1.05, radius: 8, ratedPsi: 30, referenceArc: 360 },
      { id: "p10", label: "10 ft radius", gpm: 1.58, radius: 10, ratedPsi: 30, referenceArc: 360 },
      { id: "p12", label: "12 ft radius", gpm: 2.60, radius: 12, ratedPsi: 30, referenceArc: 360 },
      { id: "p15", label: "15 ft radius", gpm: 3.70, radius: 15, ratedPsi: 30, referenceArc: 360 },
    ],
    other: [{ id: "generic", label: "Generic / not sure (10 ft)", gpm: 1.6, radius: 10, ratedPsi: 30, referenceArc: 360 }],
  },
  mp: {
    "hunter-mprotator": [
      { id: "mp1000", label: "MP1000 (8-15 ft)", gpm: 0.60, radius: 12, ratedPsi: 40, referenceArc: 360 },
      { id: "mp2000", label: "MP2000 (13-21 ft)", gpm: 1.00, radius: 17, ratedPsi: 40, referenceArc: 360 },
      { id: "mp3000", label: "MP3000 (22-30 ft)", gpm: 2.40, radius: 26, ratedPsi: 40, referenceArc: 360 },
      { id: "mp3500", label: "MP3500 (31-35 ft)", gpm: 5.00, radius: 33, ratedPsi: 40, referenceArc: 360 },
      { id: "mpcorner", label: "MP Corner (8-15 ft)", gpm: 1.92, radius: 11, ratedPsi: 40, referenceArc: 360 },
    ],
    "rainbird-rvan": [
      { id: "rvan14", label: "R-VAN14 (8-14 ft)", gpm: 1.25, radius: 14, ratedPsi: 45, referenceArc: 360 },
      { id: "rvan18", label: "R-VAN18 (13-18 ft)", gpm: 2.10, radius: 18, ratedPsi: 45, referenceArc: 360 },
      { id: "rvan24", label: "R-VAN24 (17-24 ft)", gpm: 3.70, radius: 24, ratedPsi: 45, referenceArc: 360 },
    ],
    "toro-precision-rotating": [
      { id: "prn", label: "PRN (14-26 ft, adjustable)", gpm: 3.09, radius: 22.9, ratedPsi: 45, referenceArc: 360 },
    ],
    other: [{ id: "generic", label: "Generic / not sure (15 ft)", gpm: 1.0, radius: 15, ratedPsi: 40, referenceArc: 360 }],
  },
};

// Head type registry. `manualFlow` types skip nozzle lookup + arc math and
// take a direct flow number from the technician. `hasBrand` types show a
// brand selector before the nozzle-spec selector.
export const HEAD_TYPES = {
  spray: { key: "spray", label: "Fixed Spray", hasArc: true, hasBrand: true, specLabel: "Nozzle" },
  rotor: { key: "rotor", label: "Rotor (gear-driven)", hasArc: true, hasBrand: true, specLabel: "Nozzle" },
  mp: { key: "mp", label: "Rotary Nozzle (MP Rotator-style)", hasArc: true, hasBrand: true, specLabel: "Nozzle" },
  bubbler: { key: "bubbler", label: "Bubbler", manualFlow: true, flowLabel: "Flow (GPM per emitter)", isGPH: false },
  drip: { key: "drip", label: "Drip / Micro-emitter", manualFlow: true, flowLabel: "Flow (GPH per emitter)", isGPH: true },
  custom: { key: "custom", label: "Custom / Measured", manualFlow: true, flowLabel: "Flow (GPM, measured)", isGPH: false },
};

export const HEAD_TYPE_ORDER = ["spray", "rotor", "mp", "bubbler", "drip", "custom"];

// Helper: nozzle list for a given head type + brand, with a safe fallback.
export function nozzleOptionsFor(headType, brand) {
  const byBrand = NOZZLES[headType];
  if (!byBrand) return [];
  return byBrand[brand] || byBrand.other || [];
}

export const ARC_PRESETS = [
  { value: 360, label: "Full (360°)" },
  { value: 270, label: "270°" },
  { value: 180, label: "Half (180°)" },
  { value: 120, label: "Third (120°)" },
  { value: 90, label: "Quarter (90°)" },
];

// Rough zone-size buckets: a fast tap instead of measuring. Values are the
// assumed midpoint square footage used only to estimate whether a zone is
// severely over/under watered -- never shown to the user as a "fact".
export const ZONE_SIZE_BUCKETS = {
  small: { label: "Small (planter/strip)", sqft: 300 },
  medium: { label: "Medium (typical lawn zone)", sqft: 1000 },
  large: { label: "Large (big yard)", sqft: 2500 },
  xlarge: { label: "Extra Large (commercial)", sqft: 5000 },
};

// Typical seasonal water-need targets, inches per week. Editable defaults,
// not a precise regional ET feed -- used only to flag SEVERE deviation.
export const PLANT_TARGETS = {
  turf_cool: { label: "Grass (cool-season)", low: 1.0, high: 1.5 },
  turf_warm: { label: "Grass (warm-season)", low: 0.75, high: 1.25 },
  shrub_bed: { label: "Shrub bed", low: 0.5, high: 1.0 },
  tree_drip: { label: "Tree / drip planting", low: 0.3, high: 0.6 },
  xeriscape: { label: "Xeriscape / rock", low: 0.1, high: 0.3 },
};

export const SOIL_TYPES = ["Clay", "Loam", "Sandy"];
export const SUN_EXPOSURES = ["Full Sun", "Partial Sun/Shade", "Full Shade"];
export const SLOPES = ["Flat", "Moderate", "Steep"];

export const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export const ISSUE_TYPES = [
  { key: "broken_head", label: "Broken/missing head" },
  { key: "clogged_nozzle", label: "Clogged nozzle" },
  { key: "misting", label: "Misting/fogging (high pressure)" },
  { key: "runoff", label: "Runoff/pooling" },
  { key: "sunken_tilted", label: "Sunken/tilted head" },
  { key: "vegetation_block", label: "Vegetation blocking spray" },
  { key: "coverage_gap", label: "Dry spots/coverage gap" },
];

export const SEVERITIES = ["Minor", "Moderate", "Urgent"];

// "good" is mutually exclusive with the other valve issues (see
// App.toggleValveIssue in app.js) -- picking it clears any issue chips,
// and picking an issue clears "good".
export const VALVE_ISSUES = [
  { key: "good", label: "Good Condition" },
  { key: "old_worn", label: "Old / worn" },
  { key: "leaking", label: "Leaking" },
  { key: "buried", label: "Buried / hard to access" },
  { key: "not_shutting_off", label: "Not shutting off fully" },
];

// Always shown, regardless of water source -- same 3 states either way.
export const BACKFLOW_FILTER_STATES = ["Present", "Missing", "Leaking"];
