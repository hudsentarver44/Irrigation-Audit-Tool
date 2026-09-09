// calc.js
// Pure calculation functions -- no DOM, no Firebase. Given plain data
// objects (as stored in Firestore) they compute flow, gallons, and flags.

import { HEAD_TYPES, NOZZLES, ZONE_SIZE_BUCKETS, PLANT_TARGETS } from "./nozzles.js";

// Standard orifice pressure-flow approximation: GPM scales with the square
// root of the pressure ratio. Not exact for every nozzle across its whole
// range, but far closer than ignoring the visit's measured pressure
// entirely. Returns 1 (no adjustment) if either pressure is missing/zero.
function pressureFactor(ratedPsi, measuredPsi) {
  const p = Number(measuredPsi);
  const rated = Number(ratedPsi);
  if (!rated || !p || p <= 0) return 1;
  return Math.sqrt(p / rated);
}

// measuredPsi is the visit's static pressure reading (audit.staticPressurePsi).
// Passing it in adjusts nozzle GPM for actual field pressure; omitting it
// (undefined/"") leaves nozzles at their catalog-rated GPM.
export function headUnitGPM(head, measuredPsi) {
  const def = HEAD_TYPES[head.type];
  if (!def) return 0;
  if (def.manualFlow) {
    let gpm = Number(head.flow) || 0;
    if (def.isGPH) gpm = gpm / 60;
    return gpm;
  }
  const byBrand = NOZZLES[head.type] || {};
  const list = byBrand[head.brand] || byBrand.other || [];
  const noz = list.find((n) => n.id === head.spec) || list[0];
  if (!noz) return 0;

  let gpm = noz.gpm * pressureFactor(noz.ratedPsi, measuredPsi);

  // Gear-driven rotors have a single continuously-rotating stream: arc
  // changes coverage/precip rate, not the nozzle's GPM, so nozzles with no
  // `referenceArc` are never arc-scaled. Fixed sprays and multi-stream
  // rotary/MP-style nozzles ARE manufactured close to proportional to arc
  // size, so those scale from their full-circle (or other reference-arc)
  // rated GPM down to the head's actual arc.
  if (noz.referenceArc) {
    const arc = Number(head.arc) || 360;
    gpm = gpm * (arc / noz.referenceArc);
  }
  return gpm;
}

export function headGroupGPM(head, measuredPsi) {
  return headUnitGPM(head, measuredPsi) * (Number(head.qty) || 0);
}

export function zoneTotalGPM(zone, measuredPsi) {
  return (zone.heads || []).reduce((s, h) => s + headGroupGPM(h, measuredPsi), 0);
}

export function zoneHeadCount(zone) {
  return (zone.heads || []).reduce((s, h) => s + (Number(h.qty) || 0), 0);
}

export function cycleDaysCount(cycle) {
  return (cycle.days || []).length;
}

export function cycleGalPerWeek(zone, cycle, measuredPsi) {
  return zoneTotalGPM(zone, measuredPsi) * (Number(cycle.minutes) || 0) * cycleDaysCount(cycle);
}

export function zoneRunMinutesPerWeek(zone) {
  return (zone.runCycles || []).reduce(
    (s, c) => s + (Number(c.minutes) || 0) * cycleDaysCount(c),
    0
  );
}

export function zoneGalPerWeek(zone, measuredPsi) {
  return (zone.runCycles || []).reduce((s, c) => s + cycleGalPerWeek(zone, c, measuredPsi), 0);
}

export function zoneGalPerMonth(zone, measuredPsi) {
  return zoneGalPerWeek(zone, measuredPsi) * 4.345;
}

export function zoneGalPerSeason(zone, seasonWeeks, measuredPsi) {
  return zoneGalPerWeek(zone, measuredPsi) * (Number(seasonWeeks) || 26);
}

// Rough estimated inches/week, used ONLY to decide the severe over/under
// flag -- never displayed as an output figure itself.
export function zoneEstimatedInchesPerWeek(zone, measuredPsi) {
  const bucket = ZONE_SIZE_BUCKETS[zone.sizeCategory];
  if (!bucket) return null;
  const gpm = zoneTotalGPM(zone, measuredPsi);
  if (gpm <= 0) return 0;
  const precipInHr = (gpm * 96.3) / bucket.sqft;
  const hoursPerWeek = zoneRunMinutesPerWeek(zone) / 60;
  return precipInHr * hoursPerWeek;
}

// Only fires on a SEVERE miss: roughly double the top of the target range
// (overwatering) or roughly half the bottom of it (underwatering).
export function zoneWaterFlag(zone, measuredPsi) {
  const inches = zoneEstimatedInchesPerWeek(zone, measuredPsi);
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

export function zoneFlags(zone, measuredPsi) {
  const flags = [];
  const water = zoneWaterFlag(zone, measuredPsi);
  if (water) flags.push(water);
  if (zoneMixedHeadFlag(zone)) {
    flags.push({ level: "mixed", label: "Mixed head types sharing one zone" });
  }
  return flags;
}

export function auditTotals(audit) {
  const zones = audit.zones || [];
  const psi = audit.staticPressurePsi;
  return {
    zoneCount: zones.length,
    headCount: zones.reduce((s, z) => s + zoneHeadCount(z), 0),
    totalGPM: zones.reduce((s, z) => s + zoneTotalGPM(z, psi), 0),
    galPerWeek: zones.reduce((s, z) => s + zoneGalPerWeek(z, psi), 0),
    galPerMonth: zones.reduce((s, z) => s + zoneGalPerMonth(z, psi), 0),
    galPerSeason: zones.reduce((s, z) => s + zoneGalPerSeason(z, audit.seasonWeeks, psi), 0),
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
