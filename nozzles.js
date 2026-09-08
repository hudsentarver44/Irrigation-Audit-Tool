// nozzles.js
// Built-in nozzle/head flow lookup tables. Values are typical published
// manufacturer nominal full-circle GPM figures (Hunter/Rain Bird style
// product lines) at standard rated pressure. They're starting defaults,
// not measured values -- every head can still be overridden by hand.

export const SPRAY_GPM = [
  { value: "4", label: "4 ft radius", gpm: 0.90 },
  { value: "6", label: "6 ft radius", gpm: 1.30 },
  { value: "8", label: "8 ft radius", gpm: 1.80 },
  { value: "10", label: "10 ft radius", gpm: 2.40 },
  { value: "12", label: "12 ft radius", gpm: 3.00 },
  { value: "15", label: "15 ft radius", gpm: 3.90 },
  { value: "17", label: "17 ft radius", gpm: 4.50 },
];

export const ROTOR_NOZZLES = [
  { value: "0.5", label: "#0.5 nozzle (~0.5 GPM)", gpm: 0.5 },
  { value: "1.0", label: "#1.0 nozzle (~1.0 GPM)", gpm: 1.0 },
  { value: "1.5", label: "#1.5 nozzle (~1.5 GPM)", gpm: 1.5 },
  { value: "2.0", label: "#2.0 nozzle (~2.0 GPM)", gpm: 2.0 },
  { value: "2.5", label: "#2.5 nozzle (~2.5 GPM)", gpm: 2.5 },
  { value: "3.0", label: "#3.0 nozzle (~3.0 GPM)", gpm: 3.0 },
  { value: "4.0", label: "#4.0 nozzle (~4.0 GPM)", gpm: 4.0 },
  { value: "5.0", label: "#5.0 nozzle (~5.0 GPM)", gpm: 5.0 },
  { value: "6.0", label: "#6.0 nozzle (~6.0 GPM)", gpm: 6.0 },
  { value: "8.0", label: "#8.0 nozzle (~8.0 GPM)", gpm: 8.0 },
  { value: "10.0", label: "#10.0 nozzle (~10.0 GPM)", gpm: 10.0 },
];

export const MP_MODELS = [
  { value: "mp_corner", label: "MP Corner (~5-13 ft)", gpm: 0.23 },
  { value: "mp_800sr", label: "MP800SR (~5-8 ft)", gpm: 0.39 },
  { value: "mp_1000", label: "MP1000 (~8-15 ft)", gpm: 0.41 },
  { value: "mp_2000", label: "MP2000 (~13-21 ft)", gpm: 0.99 },
  { value: "mp_3000", label: "MP3000 (~22-30 ft)", gpm: 1.90 },
  { value: "mp_3500", label: "MP3500 (~31-35 ft)", gpm: 2.94 },
];

// Head type registry. `manualFlow` types skip nozzle lookup + arc math and
// take a direct flow number from the technician.
export const HEAD_TYPES = {
  spray: { key: "spray", label: "Fixed Spray", hasArc: true, specLabel: "Radius", specOptions: SPRAY_GPM },
  rotor: { key: "rotor", label: "Rotor (gear-driven)", hasArc: true, specLabel: "Nozzle", specOptions: ROTOR_NOZZLES },
  mp: { key: "mp", label: "Rotary Nozzle (MP Rotator-style)", hasArc: true, specLabel: "Model", specOptions: MP_MODELS },
  bubbler: { key: "bubbler", label: "Bubbler", manualFlow: true, flowLabel: "Flow (GPM per emitter)", isGPH: false },
  drip: { key: "drip", label: "Drip / Micro-emitter", manualFlow: true, flowLabel: "Flow (GPH per emitter)", isGPH: true },
  custom: { key: "custom", label: "Custom / Measured", manualFlow: true, flowLabel: "Flow (GPM, measured)", isGPH: false },
};

export const HEAD_TYPE_ORDER = ["spray", "rotor", "mp", "bubbler", "drip", "custom"];

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
  turf_cool: { label: "Turf (cool-season)", low: 1.0, high: 1.5 },
  turf_warm: { label: "Turf (warm-season)", low: 0.75, high: 1.25 },
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

export const VALVE_ISSUES = [
  { key: "old_worn", label: "Old / worn" },
  { key: "leaking", label: "Leaking" },
  { key: "buried", label: "Buried / hard to access" },
  { key: "not_shutting_off", label: "Not shutting off fully" },
];

export const BACKFLOW_FILTER_STATES = ["Present", "Missing", "Leaking"];
