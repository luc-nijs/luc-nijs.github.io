// Draws the map, reads the sheet live and filters the list on the agenda page.
// Leaflet itself (the global L) is loaded by the page.
import { SHEET_CSV_URL, CONFIG, esc, colorFor, yearOf, placeOf, prettyDate, onlineMark, placed, coordKey, listHtml, countText, prepare, recordsFromCSV } from '../lib/lectures.js';

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------- map
const map = L.map("lecture-map", {
  scrollWheelZoom: false,
  maxBounds: [[-85, -180], [85, 180]],
  maxBoundsViscosity: 1.0,
  worldCopyJump: false,
  minZoom: 1
}).setView(CONFIG.initialView, CONFIG.initialZoom);

map.on("click", () => map.scrollWheelZoom.enable());

const TILE_SOURCES = [
  { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
  { url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }
];
let tileLayer = null;

function useTiles(i) {
  if (tileLayer) map.removeLayer(tileLayer);
  const src = TILE_SOURCES[i];
  let loadedAny = false;
  tileLayer = L.tileLayer(src.url, {
    attribution: src.attribution, maxZoom: 19,
    noWrap: true, bounds: [[-85.06, -180], [85.06, 180]]
  });
  tileLayer.on("tileload", () => { loadedAny = true; });
  setTimeout(() => {
    if (loadedAny) return;
    if (i + 1 < TILE_SOURCES.length) { useTiles(i + 1); return; }
    const s = $("lm-status");
    s.className = "lm-status lm-error";
    s.textContent = "The background map could not be reached; the list is unaffected.";
  }, 6000);
  tileLayer.addTo(map);
}
useTiles(0);

const cluster = L.markerClusterGroup({
  maxClusterRadius: 32, spiderfyOnMaxZoom: true, showCoverageOnHover: false
}).addTo(map);

const mapEl = $("lecture-map");
if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize()).observe(mapEl);
window.addEventListener("load",   () => map.invalidateSize());
window.addEventListener("resize", () => map.invalidateSize());
setTimeout(() => map.invalidateSize(), 300);

// ----------------------------------------------------------------- state
let records = [];
const markerByKey = new Map();     // "lat,lon" -> marker, for list -> map

// ------------------------------------------------------------- rendering
function popupHtml(items) {
  const sorted = items.slice().sort((a, b) => (yearOf(b) || 0) - (yearOf(a) || 0));
  const head = sorted[0];
  const lis = sorted.map((r) => {
    const t = r.url ? `<a href="${esc(r.url)}">${esc(r.title)}</a>` : esc(r.title);
    const meta = [prettyDate(r), r.occasion, r.kind].filter(Boolean).map(esc).join(" &middot; ");
    const people = r.people ? `<br><span class="lm-place">with ${esc(r.people)}</span>` : "";
    return `<li>${t}${onlineMark(r)}${
             meta ? `<br><span class="lm-place">${meta}</span>` : ""}${people}</li>`;
  }).join("");
  return `<div class="lm-pop"><h4>${esc(head.city || "")}</h4>
          <div class="lm-place">${esc(placeOf(head))}${
            sorted.length > 1 ? ` &middot; ${sorted.length} entries` : ""}</div>
          <ul>${lis}</ul></div>`;
}

function drawMap(recs) {
  cluster.clearLayers();
  markerByKey.clear();
  const byKey = new Map();
  for (const r of recs.filter(placed)) {
    const k = coordKey(r);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r);
  }
  for (const [k, items] of byKey) {
    const radius = 6 + Math.min(6, Math.sqrt(items.length - 1) * 3.5);
    const m = L.circleMarker([items[0].lat, items[0].lon], {
      radius, color: "#ffffff", weight: 1.5,
      fillColor: colorFor(items[0].kind), fillOpacity: .85
    })
      .bindPopup(popupHtml(items))
      .bindTooltip(`${items[0].city || ""}${items.length > 1 ? ` (${items.length})` : ""}`,
                   { direction: "top" })
      .addTo(cluster);
    markerByKey.set(k, m);
  }
  return byKey.size;
}

// Clicking a list row centres the map on it and opens its popup.
$("lm-list").addEventListener("click", (ev) => {
  if (ev.target.closest("a")) return;                 // let real links work
  const row = ev.target.closest(".lm-item");
  if (!row || !row.dataset.i) return;
  const rec = records[parseInt(row.dataset.i, 10)];
  if (!rec) return;

  for (const el of document.querySelectorAll(".lm-item.lm-on")) el.classList.remove("lm-on");
  row.classList.add("lm-on");

  if (!placed(rec)) return;              // nothing to fly to
  const marker = markerByKey.get(coordKey(rec));
  if (!marker) return;
  map.flyTo([rec.lat, rec.lon], Math.max(map.getZoom(), 6), { duration: .6 });
  // The marker may be inside a collapsed cluster; ask the cluster to reveal it.
  cluster.zoomToShowLayer(marker, () => marker.openPopup());
});

function applyFilters(fit) {
  const kind = $("lm-kind").value.toLowerCase();
  const from = parseInt($("lm-from").value, 10);
  const to   = parseInt($("lm-to").value, 10);
  const q    = $("lm-q").value.trim().toLowerCase();

  const out = records.filter((r) => {
    if (kind && String(r.kind || "").toLowerCase() !== kind) return false;
    const y = yearOf(r);
    if (!Number.isNaN(from) && y != null && y < from) return false;
    if (!Number.isNaN(to)   && y != null && y > to)   return false;
    if (q) {
      const hay = [r.title, r.city, r.country, r.kind, r.occasion, r.people,
                   r.online ? "online" : ""].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  drawMap(out);
  $("lm-list").innerHTML = listHtml(out, records);

  $("lm-count").textContent = countText(out);

  const pts = out.filter(placed).map((r) => [r.lat, r.lon]);
  if (fit && pts.length) {
    map.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: CONFIG.maxFitZoom });
  }
}

function buildControls() {
  const kinds = [...new Set(records.map((r) => r.kind).filter(Boolean))].sort();
  for (const k of kinds) {
    const o = document.createElement("option");
    o.value = k; o.textContent = k;
    $("lm-kind").appendChild(o);
  }
  const years = records.map(yearOf).filter((y) => y != null);
  const lo = years.length ? Math.min(...years) : new Date().getFullYear();
  const hi = years.length ? Math.max(...years) : lo;
  for (let y = lo; y <= hi; y++) {
    for (const id of ["lm-from", "lm-to"]) {
      const o = document.createElement("option");
      o.value = y; o.textContent = y;
      $(id).appendChild(o);
    }
  }
  $("lm-from").value = lo;
  $("lm-to").value = hi;

  // The legend lists only the recognised vocabulary. A Type cell holding
  // free text (easy to do by typing in the wrong column) would otherwise
  // mint a legend row as wide as the sentence and sit across the map.
  // Unrecognised values are collapsed into a single "other" row; they are
  // still listed individually in the Type dropdown above, which is where
  // you want to see them, because that is how you spot the mistake.
  const known = Object.keys(CONFIG.colors).filter((k) => k !== "_default");
  const shown = known.filter((k) => kinds.some((v) => v.toLowerCase() === k));
  const hasOther = kinds.some((v) => !known.includes(v.toLowerCase()));

  if (shown.length + (hasOther ? 1 : 0) > 1) {
    const legend = L.control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "lm-legend");
      const rows = shown.map((k) =>
        `<div><i style="background:${colorFor(k)}"></i>${esc(k)}</div>`);
      if (hasOther) {
        rows.push(`<div><i style="background:${CONFIG.colors._default}"></i>other</div>`);
      }
      div.innerHTML = rows.join("");
      return div;
    };
    legend.addTo(map);
  }

  for (const id of ["lm-kind", "lm-from", "lm-to"]) {
    $(id).addEventListener("change", () => applyFilters(false));
  }
  $("lm-q").addEventListener("input", () => applyFilters(false));
}

// Links open in a new tab, including the ones Leaflet adds to the map.
$("lecture-map-app").addEventListener("click", (ev) => {
  const a = ev.target.closest('a[href^="http"]');
  if (a) { a.target = "_blank"; a.rel = "noopener"; }
}, true);

function start(list, note) {
  records = prepare(list);
  if (!records.length) {
    $("lm-status").textContent = "No lectures found.";
    return;
  }
  buildControls();
  applyFilters(true);
  $("lm-status").textContent = note;
}

// Cache-bust per minute so a sheet edit is not masked by a stale copy.
fetch(SHEET_CSV_URL + "&v=" + Math.floor(Date.now() / 60000), { cache: "no-cache" })
  .then((res) => { if (!res.ok) throw new Error("HTTP " + res.status); return res.text(); })
  .then((text) => {
    const fromSheet = recordsFromCSV(text);
    if (!fromSheet.length) throw new Error("no usable rows");
    start(fromSheet, "Click an entry in the list to locate it on the map.");
  })
  .catch(() => {
    // Sheet unreachable or unusable: keep the list that was built into the page.
    start(JSON.parse($("lm-data").textContent), "Showing the saved list \u2014 the live sheet could not be read.");
  });
