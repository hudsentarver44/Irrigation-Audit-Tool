// calc.js
// Pure calculation functions -- no DOM, no Firebase. Given plain data
// objects (as stored in Firestore) they compute flow, gallons, and flags.

import { HEAD_TYPES, ZONE_SIZE_BUCKETS, PLANT_TARGETS } from "./nozzles.js";

export function headUnitGPM(head) {
  const def = HEAD_TYPES[head.type];
  if (!def) return 0;
  if (def.manualFlow) {
    let gpm = Number(head.flow) || 0;
    if (def.isGPH) gpm = gpm / 60;
    return gpm;
  }
  const opt = (def.specOptions || []).find((o) => o.value === head.spec);
  const full = opt ? opt.gpm : 0;
  const arc = Number(head.arc) || 360;
  return full * (arc / 360);
}

export function headGroupGPM(head) {
  return headUnitGPM(head) * (Number(head.qty) || 0);
}

export function zoneTotalGPM(zone) {
  return (zone.heads || []).reduce((s, h) => s + headGroupGPM(h), 0);
}

export function zoneHeadCount(zone) {
  return (zone.heads || []).reduce((s, h) => s + (Number(h.qty) || 0), 0);
}

export function cycleDaysCount(cycle) {
  return (cycle.days || []).length;
}

export function cycleGalPerWeek(zone, cycle) {
  return zoneTotalGPM(zone) * (Number(cycle.minutes) || 0) * cycleDaysCount(cycle);
}

export function zoneRunMinutesPerWeek(zone) {
  return (zone.runCycles || []).reduce(
    (s, c) => s + (Number(c.minutes) || 0) * cycleDaysCount(c),
    0
  );
}

export function zoneGalPerWeek(zone) {
  return (zone.runCycles || []).reduce((s, c) => s + cycleGalPerWeek(zone, c), 0);
}

export function zoneGalPerMonth(zone) {
  return zoneGalPerWeek(zone) * 4.345;
}

export function zoneGalPerSeason(zone, seasonWeeks) {
  return zoneGalPerWeek(zone) * (Number(seasonWeeks) || 26);
}

// Rough estimated inches/week, used ONLY to decide the severe over/under
// flag -- never displayed as an output figure itself.
export function zoneEstimatedInchesPerWeek(zone) {
  const bucket = ZONE_SIZE_BUCKETS[zone.sizeCategory];
  if (!bucket) return null;
  const gpm = zoneTotalGPM(zone);
  if (gpm <= 0) return 0;
  const precipInHr = (gpm * 96.3) / bucket.sqft;
  const hoursPerWeek = zoneRunMinutesPerWeek(zone) / 60;
  return precipInHr * hoursPerWeek;
}

// Only fires on a SEVERE miss: roughly double the top of the target range
// (overwatering) or roughly half the bottom of it (underwatering).
export function zoneWaterFlag(zone) {
  const inches = zoneEstimatedInchesPerWeek(zone);
  if (inches == null) return null;
  const target = PLANT_TARGETS[zone.plantType] || PLANT_TARGETS.turf_cool;
  if (inches > target.high * 2) {
    return { level: "over", label: "Significantly overwatering" };
  }
  if (inches < target.low * 0.5) {
    return { level: "under", label: "Significantly underwatering" };
  }
  return null;
}

const MAJOR_HEAD_TYPES = ["spray", "rotor", "mp"];
export function zoneMixedHeadFlag(zone) {
  const types = new Set(
    (zone.heads || [])
      .filter((h) => (Number(h.qty) || 0) > 0)
      .map((h) => h.type)
  );
  const majors = [...types].filter((t) => MAJOR_HEAD_TYPES.includes(t));
  return majors.length > 1;
}

export function zoneFlags(zone) {
  const flags = [];
  const water = zoneWaterFlag(zone);
  if (water) flags.push(water);
  if (zoneMixedHeadFlag(zone)) {
    flags.push({ level: "mixed", label: "Mixed head types sharing one zone" });
  }
  return flags;
}

export function auditTotals(audit) {
  const zones = audit.zones || [];
  return {
    zoneCount: zones.length,
    headCount: zones.reduce((s, z) => s + zoneHeadCount(z), 0),
    totalGPM: zones.reduce((s, z) => s + zoneTotalGPM(z), 0),
    galPerWeek: zones.reduce((s, z) => s + zoneGalPerWeek(z), 0),
    galPerMonth: zones.reduce((s, z) => s + zoneGalPerMonth(z), 0),
    galPerSeason: zones.reduce((s, z) => s + zoneGalPerSeason(z, audit.seasonWeeks), 0),
  };
}

export function estimateCost(gallons, ratePerKGal) {
  const rate = Number(ratePerKGal);
  if (!rate) return null;
  return (gallons / 1000) * rate;
}

export function fmtGal(n) {
  return Math.round(n).toLocaleString("en-US");
}

export function fmtMoney(n) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
