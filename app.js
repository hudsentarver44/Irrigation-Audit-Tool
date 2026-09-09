// app.js -- main application: state, rendering, event handlers.
//
// firebase-init.js and db.js are loaded with a dynamic import() inside
// init(), not a static import here. A static import that depends on a
// network-fetched module (the Firebase SDK, from gstatic.com) would fail
// the ENTIRE app.js module -- and everything in it -- the moment that
// network fetch fails, even briefly, leaving a blank page with no way to
// recover. A dynamic import turns that into an ordinary catchable promise
// rejection instead, so a bad connection shows a retry screen rather than
// silently freezing on "Loading...".
let Store = null;
import {
  HEAD_TYPES,
  HEAD_TYPE_ORDER,
  HEAD_BRANDS,
  nozzleOptionsFor,
  ARC_PRESETS,
  ZONE_SIZE_BUCKETS,
  PLANT_TARGETS,
  SOIL_TYPES,
  SUN_EXPOSURES,
  SLOPES,
  DAYS,
  ISSUE_TYPES,
  SEVERITIES,
  VALVE_ISSUES,
  BACKFLOW_FILTER_STATES,
} from "./nozzles.js";
import {
  zoneTotalGPM,
  zoneHeadCount,
  zoneGalPerWeek,
  zoneGalPerMonth,
  zoneGalPerSeason,
  zoneFlags,
  auditTotals,
  estimateCost,
  fmtGal,
  fmtMoney,
  headUnitGPM,
} from "./calc.js";

const el = document.getElementById("app");
const banner = document.getElementById("banner");

const state = {
  ready: false,
  properties: [],
  audits: [], // audits for the currently open property
  route: { page: "properties" },
  draftAudit: null,
  draftProperty: null,
  busy: false,
  err: null,
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// ---------- path get/set for data-bind syncing ----------
function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}
function syncDraftFromDOM(rootId, draftKey) {
  const root = document.getElementById(rootId);
  if (!root || !state[draftKey]) return;
  root.querySelectorAll("[data-bind]").forEach((input) => {
    const path = input.getAttribute("data-bind");
    let val;
    if (input.type === "checkbox") val = input.checked;
    else if (input.type === "number") val = input.value === "" ? "" : Number(input.value);
    else val = input.value;
    try {
      setPath(state[draftKey], path, val);
    } catch (e) {
      /* path not found yet -- ignore */
    }
  });
}

// Patches just the live GPM/gallons/flag figures in the audit editor from
// whatever is currently typed, WITHOUT a full re-render -- typing in a
// number field would otherwise lose focus/cursor position every keystroke
// if we re-rendered the whole form on every input event. Structural
// changes (add/remove/toggle) still go through syncDraftFromDOM + render().
function livePreview() {
  if (!state.draftAudit) return;
  const root = document.getElementById("auditForm");
  if (!root) return;
  const clone = JSON.parse(JSON.stringify(state.draftAudit));
  root.querySelectorAll("[data-bind]").forEach((input) => {
    const path = input.getAttribute("data-bind");
    let val;
    if (input.type === "checkbox") val = input.checked;
    else if (input.type === "number") val = input.value === "" ? "" : Number(input.value);
    else val = input.value;
    try {
      setPath(clone, path, val);
    } catch (e) {}
  });
  const psi = clone.staticPressurePsi;
  clone.zones.forEach((z, zi) => {
    const card = root.querySelector(`.zone-card[data-zone-index="${zi}"]`);
    if (!card) return;
    const totalEl = card.querySelector(".zone-live-total");
    if (totalEl) {
      totalEl.innerHTML = `Zone flow: <strong>${zoneTotalGPM(z, psi).toFixed(2)} GPM</strong> &middot; ${fmtGal(zoneGalPerWeek(z, psi))} gal/week`;
    }
    const headRows = card.querySelectorAll(".head-row");
    z.heads.forEach((h, hi) => {
      const gpmEl = headRows[hi] && headRows[hi].querySelector(".head-gpm");
      if (gpmEl) {
        const gpm = headUnitGPM(h, psi) * (Number(h.qty) || 0);
        gpmEl.textContent = `${gpm.toFixed(2)} GPM for this group`;
      }
    });
    let flagRow = card.querySelector(".flag-row");
    const flags = zoneFlags(z, psi);
    const flagHtml = flags.map((f) => `<span class="flag flag-${f.level}">${esc(f.label)}</span>`).join("");
    if (flagRow) {
      flagRow.innerHTML = flagHtml;
    } else if (flags.length && totalEl) {
      flagRow = document.createElement("div");
      flagRow.className = "flag-row";
      flagRow.innerHTML = flagHtml;
      totalEl.after(flagRow);
    }
  });
}

// ---------- local draft backup (crash/reload safety net) ----------
function backupDraft() {
  try {
    if (state.draftAudit) {
      localStorage.setItem("draftAuditBackup", JSON.stringify(state.draftAudit));
    }
  } catch (e) {}
}
function loadDraftBackup() {
  try {
    const raw = localStorage.getItem("draftAuditBackup");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function clearDraftBackup() {
  try {
    localStorage.removeItem("draftAuditBackup");
  } catch (e) {}
}

// ---------- factories ----------
function newRunCycle() {
  return { id: uid(), days: [], startTime: "06:00", minutes: 10 };
}
function newHead() {
  const brand = HEAD_BRANDS.spray[0].id;
  const spec = nozzleOptionsFor("spray", brand)[0].id;
  return { id: uid(), type: "spray", brand, spec, arc: 360, qty: 1, flow: 0 };
}
function newIssue(type) {
  return { id: uid(), type, severity: "Minor", fixed: false };
}
function newZone() {
  return {
    id: uid(),
    name: "",
    sizeCategory: "medium",
    plantType: "turf_cool",
    soilType: "Loam",
    sunExposure: "Full Sun",
    slope: "Flat",
    runCycles: [newRunCycle()],
    heads: [newHead()],
    issues: [],
    repairsNote: "",
    zoneNote: "",
  };
}
function newAudit(property) {
  return {
    propertyId: property.id,
    propertyName: property.name,
    technicianName: "",
    date: todayStr(),
    staticPressurePsi: "",
    seasonWeeks: 26,
    valveIssues: [],
    backflowFilterStatus: "Present",
    notes: "",
    zones: [newZone()],
  };
}
function newProperty() {
  return {
    name: "",
    address: "",
    contactName: "",
    contactPhone: "",
    waterSource: "culinary",
    waterRatePerKGal: "",
    notes: "",
  };
}

// ---------- navigation ----------
async function go(route) {
  state.route = route;
  state.err = null;
  await render();
}

// ---------- init ----------
async function init() {
  el.innerHTML = '<main class="page"><p class="loading">Loading&hellip;</p></main>';
  try {
    const [{ whenReady }, dbModule] = await Promise.all([
      import("./firebase-init.js"),
      import("./db.js"),
    ]);
    Store = dbModule;
    await whenReady();
    state.ready = true;
    state.properties = await Store.listProperties();
    const backup = loadDraftBackup();
    if (backup) {
      state.recoveredDraft = backup;
    }
    await render();
  } catch (e) {
    console.error(e);
    el.innerHTML = `
      <main class="page">
        <div class="notice">
          <strong>Couldn't connect.</strong>
          <p>Check your internet connection, then try again.</p>
          <button class="btn primary" onclick="App.retryInit()">Retry</button>
        </div>
      </main>`;
  }
}

// ---------- render dispatcher ----------
async function render() {
  const r = state.route;
  if (r.page === "properties") el.innerHTML = viewProperties();
  else if (r.page === "newProperty") el.innerHTML = viewPropertyForm();
  else if (r.page === "property") el.innerHTML = await viewPropertyDetail(r.propertyId);
  else if (r.page === "editProperty") el.innerHTML = viewPropertyForm(r.propertyId);
  else if (r.page === "auditEditor") el.innerHTML = viewAuditEditor();
  else if (r.page === "report") el.innerHTML = await viewReport(r.auditId);
  else el.innerHTML = "<p>Not found.</p>";
}

// =====================================================================
// PROPERTIES LIST
// =====================================================================
function viewProperties() {
  const recover = state.recoveredDraft
    ? `<div class="notice">
        <strong>Unsaved audit found</strong> for ${esc(state.recoveredDraft.propertyName)} from a previous session.
        <button class="btn small" onclick="App.resumeDraft()">Resume it</button>
        <button class="btn small ghost" onclick="App.discardDraftBackup()">Discard</button>
       </div>`
    : "";

  const rows = state.properties
    .map(
      (p) => `
      <button class="card list-row" onclick="App.openProperty('${p.id}')">
        <div class="row-main">
          <div class="row-title">${esc(p.name) || "(unnamed property)"}</div>
          <div class="row-sub">${esc(p.address || "")}</div>
        </div>
        <span class="tag ${p.waterSource === "secondary" ? "tag-amber" : "tag-teal"}">${p.waterSource === "secondary" ? "Secondary" : "Culinary"}</span>
      </button>`
    )
    .join("");

  return `
    <header class="topbar">
      <img class="brand-logo" src="./storm-logo.png" alt="Storm Sprinklers" />
    </header>
    <main class="page">
      <div class="page-head">
        <h1>Properties</h1>
        <button class="btn primary" onclick="App.newProperty()">+ New Property</button>
      </div>
      ${recover}
      ${rows || '<p class="empty">No properties yet. Add your first one to get started.</p>'}
    </main>`;
}

function viewPropertyForm(propertyId) {
  const editing = !!propertyId;
  const p = editing
    ? state.properties.find((x) => x.id === propertyId)
    : newProperty();
  state.draftProperty = { ...p };

  return `
    <header class="topbar">
      <button class="btn ghost" onclick="App.back()">&larr; Back</button>
      <img class="brand-logo" src="./storm-logo.png" alt="Storm Sprinklers" />
    </header>
    <main class="page">
      <h1>${editing ? "Edit Property" : "New Property"}</h1>
      <div id="propertyForm" class="form-card">
        <label>Property / site name
          <input data-bind="name" value="${esc(p.name)}" placeholder="e.g. Smith Residence" />
        </label>
        <label>Address
          <input data-bind="address" value="${esc(p.address)}" placeholder="Street, city" />
        </label>
        <div class="grid-2">
          <label>Client contact name
            <input data-bind="contactName" value="${esc(p.contactName)}" />
          </label>
          <label>Client phone
            <input data-bind="contactPhone" value="${esc(p.contactPhone)}" />
          </label>
        </div>
        <label>Water source
          <select data-bind="waterSource">
            <option value="culinary" ${p.waterSource === "culinary" ? "selected" : ""}>Culinary</option>
            <option value="secondary" ${p.waterSource === "secondary" ? "selected" : ""}>Secondary</option>
          </select>
        </label>
        <label>Water rate ($ per 1,000 gallons) <span class="optional">optional</span>
          <input data-bind="waterRatePerKGal" type="number" step="0.01" value="${esc(p.waterRatePerKGal)}" />
        </label>
        <label>Notes
          <textarea data-bind="notes" rows="2">${esc(p.notes)}</textarea>
        </label>
        <div class="form-actions">
          <button class="btn primary" onclick="App.saveProperty(${editing ? `'${propertyId}'` : "null"})">Save Property</button>
          ${editing ? `<button class="btn danger ghost" onclick="App.removeProperty('${propertyId}')">Delete Property</button>` : ""}
        </div>
      </div>
    </main>`;
}

// =====================================================================
// PROPERTY DETAIL
// =====================================================================
async function viewPropertyDetail(propertyId) {
  const p = state.properties.find((x) => x.id === propertyId);
  if (!p) return "<p>Property not found.</p>";
  state.audits = await Store.listAuditsForProperty(propertyId);

  const auditRows = state.audits
    .map((a) => {
      const t = auditTotals(a);
      return `
      <button class="card list-row" onclick="App.openReport('${a.id}')">
        <div class="row-main">
          <div class="row-title">${esc(a.date)} &middot; ${esc(a.technicianName || "Unnamed tech")}</div>
          <div class="row-sub">${t.zoneCount} zones &middot; ${fmtGal(t.galPerWeek)} gal/week</div>
        </div>
        <span class="chev">&rsaquo;</span>
      </button>`;
    })
    .join("");

  return `
    <header class="topbar">
      <button class="btn ghost" onclick="App.go({page:'properties'})">&larr; Properties</button>
      <img class="brand-logo" src="./storm-logo.png" alt="Storm Sprinklers" />
    </header>
    <main class="page">
      <div class="page-head">
        <div>
          <h1>${esc(p.name) || "(unnamed property)"}</h1>
          <p class="sub">${esc(p.address || "")}</p>
        </div>
        <div class="btn-row">
          <button class="btn" onclick="App.go({page:'editProperty', propertyId:'${p.id}'})">Edit</button>
          <button class="btn primary" onclick="App.startAudit('${p.id}')">+ New Audit</button>
        </div>
      </div>
      <div class="tag-row">
        <span class="tag ${p.waterSource === "secondary" ? "tag-amber" : "tag-teal"}">${p.waterSource === "secondary" ? "Secondary water" : "Culinary water"}</span>
        ${p.waterRatePerKGal ? `<span class="tag">$${esc(p.waterRatePerKGal)}/1,000 gal</span>` : ""}
      </div>
      <h2 class="section-head">Past Visits</h2>
      ${auditRows || '<p class="empty">No visits recorded yet.</p>'}
    </main>`;
}

// =====================================================================
// AUDIT EDITOR
// =====================================================================
function viewAuditEditor() {
  const a = state.draftAudit;
  const psi = a.staticPressurePsi;

  const zonesHtml = a.zones.map((z, zi) => zoneCardHtml(z, zi, psi)).join("");

  return `
    <header class="topbar">
      <button class="btn ghost" onclick="App.exitAuditEditor()">&larr; Cancel</button>
      <img class="brand-logo" src="./storm-logo.png" alt="Storm Sprinklers" />
    </header>
    <main class="page" id="auditForm">
      <div class="page-head">
        <h1>Tune-Up Visit &mdash; ${esc(a.propertyName)}</h1>
        <button class="btn primary" onclick="App.saveAuditNow()">Save Visit</button>
      </div>

      <section class="form-card">
        <div class="grid-2">
          <label>Date
            <input type="date" data-bind="date" value="${esc(a.date)}" />
          </label>
          <label>Technician
            <input data-bind="technicianName" value="${esc(a.technicianName)}" placeholder="Your name" />
          </label>
        </div>
        <div class="grid-2">
          <label>Static pressure (PSI) <span class="optional">optional</span> <span class="hint">adjusts nozzle GPM to actual field pressure</span>
            <input type="number" oninput="App.livePreview()" data-bind="staticPressurePsi" value="${esc(a.staticPressurePsi)}" />
          </label>
          <label>Season length (weeks/year system runs)
            <input type="number" data-bind="seasonWeeks" value="${esc(a.seasonWeeks)}" />
          </label>
        </div>

        <label>Overall valve condition <span class="hint">tap all that apply</span></label>
        <div class="chip-row">
          ${VALVE_ISSUES.map(
            (v) => `<button type="button" class="chip ${a.valveIssues.includes(v.key) ? "on" : ""}" onclick="App.toggleValveIssue('${v.key}')">${v.label}</button>`
          ).join("")}
        </div>

        <label>Backflow Preventer / Filter</label>
        <div class="chip-row">
          ${BACKFLOW_FILTER_STATES.map(
            (st) => `<button type="button" class="chip solo ${a.backflowFilterStatus === st ? "on" : ""}" onclick="App.setBackflowStatus('${st}')">${st}</button>`
          ).join("")}
        </div>

        <label>Visit notes
          <textarea data-bind="notes" rows="2">${esc(a.notes)}</textarea>
        </label>
      </section>

      <div class="page-head">
        <h2 class="section-head">Zones</h2>
        <button class="btn" onclick="App.addZone()">+ Add Zone</button>
      </div>
      ${zonesHtml}
    </main>`;
}

function zoneCardHtml(z, zi, measuredPsi) {
  const gpm = zoneTotalGPM(z, measuredPsi);
  const galWeek = zoneGalPerWeek(z, measuredPsi);

  const cyclesHtml = z.runCycles
    .map((c, ci) => {
      const dayChips = DAYS.map(
        (d) =>
          `<button type="button" class="chip xs ${c.days.includes(d.key) ? "on" : ""}" onclick="App.toggleCycleDay(${zi},${ci},'${d.key}')">${d.label}</button>`
      ).join("");
      return `
      <div class="cycle-row">
        <div class="chip-row">${dayChips}</div>
        <div class="grid-3">
          <label>Start time
            <input type="time" data-bind="zones.${zi}.runCycles.${ci}.startTime" value="${esc(c.startTime)}" />
          </label>
          <label>Minutes
            <input type="number" oninput="App.livePreview()" data-bind="zones.${zi}.runCycles.${ci}.minutes" value="${esc(c.minutes)}" />
          </label>
          <button type="button" class="btn danger ghost small" onclick="App.removeCycle(${zi},${ci})">Remove cycle</button>
        </div>
      </div>`;
    })
    .join("");

  const headsHtml = z.heads
    .map((h, hi) => headRowHtml(h, zi, hi, measuredPsi))
    .join("");

  const issuesHtml = ISSUE_TYPES.map((it) => {
    const existing = z.issues.find((i) => i.type === it.key);
    return `
    <div class="issue-row">
      <label class="issue-check">
        <input type="checkbox" ${existing ? "checked" : ""} onchange="App.toggleIssue(${zi},'${it.key}')" />
        ${it.label}
      </label>
      ${
        existing
          ? `<div class="issue-controls">
              <select onchange="App.setIssueSeverity(${zi},'${it.key}',this.value)">
                ${SEVERITIES.map((s) => `<option value="${s}" ${existing.severity === s ? "selected" : ""}>${s}</option>`).join("")}
              </select>
              <label class="fixed-toggle">
                <input type="checkbox" ${existing.fixed ? "checked" : ""} onchange="App.toggleIssueFixed(${zi},'${it.key}')" />
                Fixed today
              </label>
            </div>`
          : ""
      }
    </div>`;
  }).join("");

  const flags = zoneFlags(z, measuredPsi);
  const flagsHtml = flags.length
    ? `<div class="flag-row">${flags.map((f) => `<span class="flag flag-${f.level}">${esc(f.label)}</span>`).join("")}</div>`
    : "";

  return `
    <section class="form-card zone-card" data-zone-index="${zi}">
      <div class="zone-head">
        <input class="zone-name" data-bind="zones.${zi}.name" value="${esc(z.name)}" placeholder="Zone name / number" />
        <button class="btn danger ghost small" onclick="App.removeZone(${zi})">Remove Zone</button>
      </div>

      <div class="grid-4">
        <label>Size <span class="hint">rough estimate</span>
          <select onchange="App.livePreview()" data-bind="zones.${zi}.sizeCategory">
            ${Object.entries(ZONE_SIZE_BUCKETS)
              .map(([k, v]) => `<option value="${k}" ${z.sizeCategory === k ? "selected" : ""}>${v.label}</option>`)
              .join("")}
          </select>
        </label>
        <label>Plant type
          <select onchange="App.livePreview()" data-bind="zones.${zi}.plantType">
            ${Object.entries(PLANT_TARGETS)
              .map(([k, v]) => `<option value="${k}" ${z.plantType === k ? "selected" : ""}>${v.label}</option>`)
              .join("")}
          </select>
        </label>
        <label>Soil
          <select data-bind="zones.${zi}.soilType">
            ${SOIL_TYPES.map((s) => `<option ${z.soilType === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </label>
        <label>Sun exposure
          <select data-bind="zones.${zi}.sunExposure">
            ${SUN_EXPOSURES.map((s) => `<option ${z.sunExposure === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </label>
      </div>
      <label class="inline-slope">Slope
        <select data-bind="zones.${zi}.slope">
          ${SLOPES.map((s) => `<option ${z.slope === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </label>

      <h3 class="sub-head">Schedule</h3>
      ${cyclesHtml}
      <button type="button" class="btn small" onclick="App.addCycle(${zi})">+ Add run cycle (cycle-soak)</button>

      <h3 class="sub-head">Heads &amp; Nozzles</h3>
      <div class="heads-table">${headsHtml}</div>
      <button type="button" class="btn small" onclick="App.addHead(${zi})">+ Add head group</button>

      <div class="zone-live-total">Zone flow: <strong>${gpm.toFixed(2)} GPM</strong> &middot; ${fmtGal(galWeek)} gal/week</div>
      ${flagsHtml}

      <h3 class="sub-head">Issues Found</h3>
      ${issuesHtml}

      <label>Repairs made today
        <textarea data-bind="zones.${zi}.repairsNote" rows="2">${esc(z.repairsNote)}</textarea>
      </label>
      <label>Zone notes
        <textarea data-bind="zones.${zi}.zoneNote" rows="2">${esc(z.zoneNote)}</textarea>
      </label>
    </section>`;
}

function headRowHtml(h, zi, hi, measuredPsi) {
  const def = HEAD_TYPES[h.type];

  const brandField = def.hasBrand
    ? `<label>Brand
        <select onchange="App.setHeadBrand(${zi},${hi},this.value)">
          ${HEAD_BRANDS[h.type].map((b) => `<option value="${b.id}" ${h.brand === b.id ? "selected" : ""}>${b.label}</option>`).join("")}
        </select>
      </label>`
    : "";

  const specOptions = def.hasBrand ? nozzleOptionsFor(h.type, h.brand) : [];
  const specField = def.manualFlow
    ? `<label>${def.flowLabel}
        <input type="number" step="0.01" oninput="App.livePreview()" data-bind="zones.${zi}.heads.${hi}.flow" value="${esc(h.flow)}" />
      </label>`
    : `<label>${def.specLabel}
        <select onchange="App.livePreview()" data-bind="zones.${zi}.heads.${hi}.spec">
          ${specOptions.map((o) => `<option value="${o.id}" ${h.spec === o.id ? "selected" : ""}>${o.label}</option>`).join("")}
        </select>
      </label>`;

  const arcField = def.hasArc
    ? `<div>
        <label>Arc</label>
        <div class="chip-row">
          ${ARC_PRESETS.map((a) => `<button type="button" class="chip xs ${Number(h.arc) === a.value ? "on" : ""}" onclick="App.setHeadArc(${zi},${hi},${a.value})">${a.label}</button>`).join("")}
          <input type="number" class="arc-custom" oninput="App.livePreview()" data-bind="zones.${zi}.heads.${hi}.arc" value="${esc(h.arc)}" title="custom degrees" />
        </div>
      </div>`
    : "";

  const gpm = headUnitGPM(h, measuredPsi) * (Number(h.qty) || 0);

  return `
    <div class="head-row">
      <div class="${def.hasBrand ? "grid-5" : "grid-4"}">
        <label>Type
          <select onchange="App.setHeadType(${zi},${hi},this.value)">
            ${HEAD_TYPE_ORDER.map((k) => `<option value="${k}" ${h.type === k ? "selected" : ""}>${HEAD_TYPES[k].label}</option>`).join("")}
          </select>
        </label>
        ${brandField}
        ${specField}
        <label>Qty
          <input type="number" min="0" oninput="App.livePreview()" data-bind="zones.${zi}.heads.${hi}.qty" value="${esc(h.qty)}" />
        </label>
        <button type="button" class="btn danger ghost small" onclick="App.removeHead(${zi},${hi})">Remove</button>
      </div>
      ${arcField}
      <div class="head-gpm">${gpm.toFixed(2)} GPM for this group</div>
    </div>`;
}

// =====================================================================
// REPORT
// =====================================================================
async function viewReport(auditId) {
  const a = await Store.getAudit(auditId);
  if (!a) return "<p>Visit not found.</p>";
  const property = state.properties.find((p) => p.id === a.propertyId) || (await Store.getProperty(a.propertyId));
  const totals = auditTotals(a);
  const cost = estimateCost(totals.galPerMonth, property && property.waterRatePerKGal);
  const seasonCost = estimateCost(totals.galPerSeason, property && property.waterRatePerKGal);
  const psi = a.staticPressurePsi;

  const zonesHtml = a.zones
    .map((z) => {
      const gpm = zoneTotalGPM(z, psi);
      const flags = zoneFlags(z, psi);
      const heads = z.heads
        .filter((h) => (Number(h.qty) || 0) > 0)
        .map((h) => {
          const def = HEAD_TYPES[h.type];
          let specLabel;
          if (def.manualFlow) {
            specLabel = `${h.flow} ${def.isGPH ? "GPH" : "GPM"}`;
          } else {
            const brandLabel = (HEAD_BRANDS[h.type] || []).find((b) => b.id === h.brand);
            const nozLabel = nozzleOptionsFor(h.type, h.brand).find((o) => o.id === h.spec);
            specLabel = `${brandLabel ? brandLabel.label + " " : ""}${nozLabel ? nozLabel.label : h.spec}`;
          }
          const arc = def.hasArc ? `${h.arc}&deg;` : "";
          return `<tr><td>${h.qty}&times;</td><td>${def.label}</td><td>${specLabel}</td><td>${arc}</td></tr>`;
        })
        .join("");

      const issues = z.issues
        .map((i) => {
          const label = (ISSUE_TYPES.find((t) => t.key === i.type) || {}).label || i.type;
          return `<li><span class="sev sev-${i.severity.toLowerCase()}">${i.severity}</span> ${label} &mdash; ${i.fixed ? "fixed today" : "needs follow-up"}</li>`;
        })
        .join("");

      return `
      <div class="report-zone">
        <h3>${esc(z.name) || "Zone"}</h3>
        <table class="report-table">
          <thead><tr><th>Qty</th><th>Type</th><th>Spec</th><th>Arc</th></tr></thead>
          <tbody>${heads || "<tr><td colspan=4>No heads recorded</td></tr>"}</tbody>
        </table>
        <p class="report-line">Flow: <strong>${gpm.toFixed(2)} GPM</strong> &middot; ${fmtGal(zoneGalPerWeek(z, psi))} gal/week &middot; ${fmtGal(zoneGalPerMonth(z, psi))} gal/month &middot; ${fmtGal(zoneGalPerSeason(z, a.seasonWeeks, psi))} gal/season</p>
        ${flags.length ? `<p class="report-line">${flags.map((f) => `<span class="flag flag-${f.level}">${esc(f.label)}</span>`).join(" ")}</p>` : ""}
        ${issues ? `<ul class="report-issues">${issues}</ul>` : ""}
        ${z.repairsNote ? `<p class="report-line"><em>Repairs made: ${esc(z.repairsNote)}</em></p>` : ""}
      </div>`;
    })
    .join("");

  return `
    <header class="topbar no-print">
      <button class="btn ghost" onclick="App.openProperty('${a.propertyId}')">&larr; Back</button>
      <img class="brand-logo" src="./storm-logo.png" alt="Storm Sprinklers" />
      <div class="btn-row">
        <button class="btn" onclick="App.editAudit('${auditId}')">Edit</button>
        <button class="btn primary" onclick="window.print()">Print / Save as PDF</button>
      </div>
    </header>
    <main class="page report">
      <div class="report-header">
        <h1>${esc(property ? property.name : a.propertyName)}</h1>
        <p>${esc(property ? property.address : "")}</p>
        <p class="report-meta">Visit date: ${esc(a.date)} &middot; Technician: ${esc(a.technicianName || "-")}</p>
        ${a.staticPressurePsi ? `<p class="report-meta">Static pressure: ${esc(a.staticPressurePsi)} PSI</p>` : ""}
      </div>

      <div class="report-checks">
        <span class="tag">Backflow Preventer / Filter: ${esc(a.backflowFilterStatus)}</span>
        <span class="tag">Valves: ${a.valveIssues.length ? a.valveIssues.map((k) => (VALVE_ISSUES.find((v) => v.key === k) || {}).label).join(", ") : "Good, no issues"}</span>
      </div>

      <div class="report-totals">
        <div class="stat"><span>${totals.zoneCount}</span>Zones</div>
        <div class="stat"><span>${totals.headCount}</span>Heads</div>
        <div class="stat"><span>${fmtGal(totals.galPerWeek)}</span>Gal/week</div>
        <div class="stat"><span>${fmtGal(totals.galPerMonth)}</span>Gal/month</div>
        <div class="stat"><span>${fmtGal(totals.galPerSeason)}</span>Gal/season</div>
        ${cost != null ? `<div class="stat"><span>${fmtMoney(cost)}</span>Est. cost/month</div>` : ""}
      </div>
      ${seasonCost != null ? `<p class="report-line">Estimated seasonal water cost: <strong>${fmtMoney(seasonCost)}</strong> (${a.seasonWeeks} week season)</p>` : ""}

      <h2 class="section-head">Zone Detail</h2>
      ${zonesHtml}

      ${a.notes ? `<h2 class="section-head">Visit Notes</h2><p>${esc(a.notes)}</p>` : ""}
      <p class="report-footer">Generated by Storm Sprinklers.</p>
    </main>`;
}

// =====================================================================
// ACTIONS (exposed as window.App)
// =====================================================================
const App = {
  go,
  retryInit() {
    init();
  },
  livePreview,
  back() {
    go({ page: "properties" });
  },
  newProperty() {
    go({ page: "newProperty" });
  },
  openProperty(id) {
    go({ page: "property", propertyId: id });
  },
  async saveProperty(id) {
    syncDraftFromDOM("propertyForm", "draftProperty");
    const data = state.draftProperty;
    if (!data.name) {
      alert("Please enter a property name.");
      return;
    }
    if (id) {
      await Store.updateProperty(id, data);
    } else {
      id = await Store.createProperty(data);
    }
    state.properties = await Store.listProperties();
    go({ page: "property", propertyId: id });
  },
  async removeProperty(id) {
    if (!confirm("Delete this property? This cannot be undone.")) return;
    await Store.deleteProperty(id);
    state.properties = await Store.listProperties();
    go({ page: "properties" });
  },

  startAudit(propertyId) {
    const property = state.properties.find((p) => p.id === propertyId);
    state.draftAudit = newAudit(property);
    backupDraft();
    go({ page: "auditEditor" });
  },
  async editAudit(auditId) {
    const a = await Store.getAudit(auditId);
    a.zones.forEach((z) => {
      if (!z.runCycles) z.runCycles = [];
      if (!z.heads) z.heads = [];
      if (!z.issues) z.issues = [];
    });
    state.draftAudit = a;
    state.editingAuditId = auditId;
    backupDraft();
    go({ page: "auditEditor" });
  },
  exitAuditEditor() {
    if (!confirm("Discard changes to this visit?")) return;
    const pid = state.draftAudit.propertyId;
    state.draftAudit = null;
    state.editingAuditId = null;
    clearDraftBackup();
    go({ page: "property", propertyId: pid });
  },
  resumeDraft() {
    state.draftAudit = state.recoveredDraft;
    state.recoveredDraft = null;
    go({ page: "auditEditor" });
  },
  discardDraftBackup() {
    state.recoveredDraft = null;
    clearDraftBackup();
    render();
  },

  async saveAuditNow() {
    syncDraftFromDOM("auditForm", "draftAudit");
    const a = state.draftAudit;
    if (!a.technicianName) {
      if (!confirm("No technician name entered -- save anyway?")) return;
    }
    let id = state.editingAuditId;
    if (id) {
      await Store.saveAudit(id, a);
    } else {
      id = await Store.createAudit(a);
    }
    state.draftAudit = null;
    state.editingAuditId = null;
    clearDraftBackup();
    go({ page: "report", auditId: id });
  },

  openReport(auditId) {
    go({ page: "report", auditId });
  },

  addZone() {
    syncDraftFromDOM("auditForm", "draftAudit");
    state.draftAudit.zones.push(newZone());
    backupDraft();
    render();
  },
  removeZone(zi) {
    syncDraftFromDOM("auditForm", "draftAudit");
    if (!confirm("Remove this zone?")) return;
    state.draftAudit.zones.splice(zi, 1);
    backupDraft();
    render();
  },
  addCycle(zi) {
    syncDraftFromDOM("auditForm", "draftAudit");
    state.draftAudit.zones[zi].runCycles.push(newRunCycle());
    backupDraft();
    render();
  },
  removeCycle(zi, ci) {
    syncDraftFromDOM("auditForm", "draftAudit");
    state.draftAudit.zones[zi].runCycles.splice(ci, 1);
    backupDraft();
    render();
  },
  toggleCycleDay(zi, ci, dayKey) {
    syncDraftFromDOM("auditForm", "draftAudit");
    const days = state.draftAudit.zones[zi].runCycles[ci].days;
    const idx = days.indexOf(dayKey);
    if (idx === -1) days.push(dayKey);
    else days.splice(idx, 1);
    backupDraft();
    render();
  },
  addHead(zi) {
    syncDraftFromDOM("auditForm", "draftAudit");
    state.draftAudit.zones[zi].heads.push(newHead());
    backupDraft();
    render();
  },
  removeHead(zi, hi) {
    syncDraftFromDOM("auditForm", "draftAudit");
    state.draftAudit.zones[zi].heads.splice(hi, 1);
    backupDraft();
    render();
  },
  setHeadType(zi, hi, type) {
    syncDraftFromDOM("auditForm", "draftAudit");
    const h = state.draftAudit.zones[zi].heads[hi];
    h.type = type;
    const def = HEAD_TYPES[type];
    if (def.hasBrand) {
      h.brand = HEAD_BRANDS[type][0].id;
      h.spec = nozzleOptionsFor(type, h.brand)[0].id;
    }
    backupDraft();
    render();
  },
  setHeadBrand(zi, hi, brand) {
    syncDraftFromDOM("auditForm", "draftAudit");
    const h = state.draftAudit.zones[zi].heads[hi];
    h.brand = brand;
    h.spec = nozzleOptionsFor(h.type, brand)[0].id;
    backupDraft();
    render();
  },
  setHeadArc(zi, hi, arc) {
    syncDraftFromDOM("auditForm", "draftAudit");
    state.draftAudit.zones[zi].heads[hi].arc = arc;
    backupDraft();
    render();
  },

  toggleIssue(zi, type) {
    syncDraftFromDOM("auditForm", "draftAudit");
    const zone = state.draftAudit.zones[zi];
    const idx = zone.issues.findIndex((i) => i.type === type);
    if (idx === -1) zone.issues.push(newIssue(type));
    else zone.issues.splice(idx, 1);
    backupDraft();
    render();
  },
  setIssueSeverity(zi, type, severity) {
    syncDraftFromDOM("auditForm", "draftAudit");
    const issue = state.draftAudit.zones[zi].issues.find((i) => i.type === type);
    if (issue) issue.severity = severity;
    backupDraft();
  },
  toggleIssueFixed(zi, type) {
    syncDraftFromDOM("auditForm", "draftAudit");
    const issue = state.draftAudit.zones[zi].issues.find((i) => i.type === type);
    if (issue) issue.fixed = !issue.fixed;
    backupDraft();
  },

  toggleValveIssue(key) {
    syncDraftFromDOM("auditForm", "draftAudit");
    const a = state.draftAudit;
    const idx = a.valveIssues.indexOf(key);
    if (idx === -1) {
      // "Good Condition" and actual issues are mutually exclusive: picking
      // one clears the other.
      if (key === "good") a.valveIssues = ["good"];
      else a.valveIssues = a.valveIssues.filter((k) => k !== "good").concat(key);
    } else {
      a.valveIssues.splice(idx, 1);
    }
    backupDraft();
    render();
  },
  setBackflowStatus(status) {
    syncDraftFromDOM("auditForm", "draftAudit");
    state.draftAudit.backflowFilterStatus = status;
    backupDraft();
    render();
  },
};

window.App = App;
init();
